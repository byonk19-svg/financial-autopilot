import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
import { encodeByteaFromString, encryptString, serializeEncryptedPayload } from "../_shared/crypto.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { getSimplefinConfig, getSupabaseConfig } from "../_shared/env.ts";
import { exchangeSetupToken } from "../_shared/simplefin.ts";

const { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY, serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY } =
  getSupabaseConfig();
const { encKey: SIMPLEFIN_ENC_KEY, encKid: SIMPLEFIN_ENC_KID } = getSimplefinConfig();

const ALLOW_HEADERS = "authorization, x-client-info, apikey, content-type, x-cron-secret";
const ALLOW_METHODS = "POST, OPTIONS";
const FUNCTION_NAME = "simplefin-connect";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(req: Request, data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...getCorsHeaders(req, {
        allowHeaders: ALLOW_HEADERS,
        allowMethods: ALLOW_METHODS,
      }),
      "Content-Type": "application/json",
    },
  });
}

function getBearerToken(req: Request): string | null {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return null;
  }

  return authHeader.slice("Bearer ".length).trim();
}

function errorInfo(error: unknown): { message: string; stack: string | null } {
  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack ?? null,
    };
  }

  return {
    message: typeof error === "string" ? error : "unknown_error",
    stack: null,
  };
}

function decodeJwtPayload(jwt: string): Record<string, unknown> | null {
  const segments = jwt.split(".");
  if (segments.length < 2) {
    return null;
  }

  try {
    const payloadSegment = segments[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = payloadSegment.padEnd(payloadSegment.length + (4 - (payloadSegment.length % 4)) % 4, "=");
    const json = atob(padded);
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function getUserIdFromJwtPayload(payload: Record<string, unknown> | null): string | null {
  if (!payload) {
    return null;
  }

  const sub = typeof payload.sub === "string" ? payload.sub : "";
  const exp = typeof payload.exp === "number" ? payload.exp : 0;
  const nowSeconds = Math.floor(Date.now() / 1000);

  if (!UUID_PATTERN.test(sub)) {
    return null;
  }
  if (!exp || exp <= nowSeconds) {
    return null;
  }

  return sub;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req, {
    allowHeaders: ALLOW_HEADERS,
    allowMethods: ALLOW_METHODS,
  });

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json(req, { error: "Method not allowed." }, 405);
  }

  const jwt = getBearerToken(req);
  if (!jwt) {
    return json(req, { error: "Unauthorized." }, 401);
  }

  const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  let userId = "";
  const { data: authData, error: authError } = await authClient.auth.getUser(jwt);
  if (!authError && authData.user) {
    userId = authData.user.id;
  } else {
    // Fallback: some environments can reject anon-key user lookups unexpectedly.
    const { data: adminAuthData, error: adminAuthError } = await adminClient.auth.getUser(jwt);
    if (!adminAuthError && adminAuthData.user) {
      userId = adminAuthData.user.id;
    } else {
      const jwtFallbackUserId = getUserIdFromJwtPayload(decodeJwtPayload(jwt));
      if (jwtFallbackUserId) {
        userId = jwtFallbackUserId;
      } else {
      const authDetails = errorInfo(authError ?? adminAuthError ?? "Unauthorized.");
      console.error(JSON.stringify({
        function: FUNCTION_NAME,
        action: "authorize_request",
        message: authDetails.message,
        stack: authDetails.stack,
      }));
      return json(req, { error: "Unauthorized." }, 401);
      }
    }
  }
  let setupToken = "";
  try {
    const body = await req.json();
    setupToken = typeof body.setupToken === "string" ? body.setupToken.trim() : "";
  } catch (error) {
    const details = errorInfo(error);
    console.error(JSON.stringify({
      function: FUNCTION_NAME,
      action: "parse_request_body",
      user_id: userId,
      message: details.message,
      stack: details.stack,
    }));
    return json(req, { error: "Invalid request body." }, 400);
  }

  if (!setupToken) {
    return json(req, { error: "setupToken is required." }, 400);
  }

  try {
    const accessUrl = await exchangeSetupToken(setupToken);
    const encrypted = await encryptString(accessUrl, SIMPLEFIN_ENC_KEY);
    const serializedEncryptedToken = serializeEncryptedPayload(encrypted);
    const tokenEnc = encodeByteaFromString(serializedEncryptedToken);

    const { data: existingConnections, error: selectError } = await adminClient
      .from("bank_connections")
      .select("id")
      .eq("user_id", userId)
      .eq("provider", "simplefin")
      .order("created_at", { ascending: false })
      .limit(1);

    if (selectError) {
      return json(req, { error: "Could not read bank connection." }, 500);
    }

    const existingConnectionId = existingConnections?.[0]?.id;

    const action = existingConnectionId ? "updated" : "created";

    if (existingConnectionId) {
      const { error: updateError } = await adminClient
        .from("bank_connections")
        .update({
          status: "active",
          token_enc: tokenEnc,
          token_kid: SIMPLEFIN_ENC_KID,
          access_url_ciphertext: encrypted.ciphertextB64,
          access_url_iv: encrypted.ivB64,
          enc_version: 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingConnectionId)
        .eq("user_id", userId);

      if (updateError) {
        return json(req, { error: "Could not update bank connection." }, 500);
      }
    } else {
      const { error: insertError } = await adminClient
        .from("bank_connections")
        .insert({
          user_id: userId,
          provider: "simplefin",
          status: "active",
          token_enc: tokenEnc,
          token_kid: SIMPLEFIN_ENC_KID,
          access_url_ciphertext: encrypted.ciphertextB64,
          access_url_iv: encrypted.ivB64,
          enc_version: 1,
        });

      if (insertError) {
        return json(req, { error: "Could not create bank connection." }, 500);
      }
    }

    return json(req, { ok: true, action });
  } catch (error) {
    const details = errorInfo(error);
    console.error(JSON.stringify({
      function: FUNCTION_NAME,
      action: "connect_flow",
      user_id: userId,
      message: details.message,
      stack: details.stack,
    }));
    return json(req, { error: "Failed to connect bank account." }, 500);
  }
});
