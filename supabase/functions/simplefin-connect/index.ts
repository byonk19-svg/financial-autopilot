import { createClient } from "@supabase/supabase-js";
import { encryptString } from "../_shared/crypto.ts";
import { exchangeSetupToken } from "../_shared/simplefin.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const SIMPLEFIN_ENC_KEY = Deno.env.get("SIMPLEFIN_ENC_KEY");

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing Supabase environment configuration.");
}

if (!SIMPLEFIN_ENC_KEY) {
  throw new Error("Missing SIMPLEFIN_ENC_KEY.");
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function getBearerToken(req: Request): string | null {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return null;
  }

  return authHeader.slice("Bearer ".length).trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed." }, 405);
  }

  const jwt = getBearerToken(req);
  if (!jwt) {
    return json({ error: "Unauthorized." }, 401);
  }

  const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const { data: authData, error: authError } = await authClient.auth.getUser(jwt);
  if (authError || !authData.user) {
    return json({ error: "Unauthorized." }, 401);
  }

  let setupToken = "";
  try {
    const body = await req.json();
    setupToken = typeof body.setupToken === "string" ? body.setupToken.trim() : "";
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }

  if (!setupToken) {
    return json({ error: "setupToken is required." }, 400);
  }

  try {
    const accessUrl = await exchangeSetupToken(setupToken);
    const encrypted = await encryptString(accessUrl, SIMPLEFIN_ENC_KEY);
    const userId = authData.user.id;

    const { data: existingConnections, error: selectError } = await adminClient
      .from("bank_connections")
      .select("id")
      .eq("user_id", userId)
      .eq("provider", "simplefin")
      .order("created_at", { ascending: false })
      .limit(1);

    if (selectError) {
      return json({ error: "Could not read bank connection." }, 500);
    }

    const existingConnectionId = existingConnections?.[0]?.id;

    if (existingConnectionId) {
      const { error: updateError } = await adminClient
        .from("bank_connections")
        .update({
          status: "active",
          access_url_ciphertext: encrypted.ciphertextB64,
          access_url_iv: encrypted.ivB64,
          enc_version: 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingConnectionId);

      if (updateError) {
        return json({ error: "Could not update bank connection." }, 500);
      }
    } else {
      const { error: insertError } = await adminClient
        .from("bank_connections")
        .insert({
          user_id: userId,
          provider: "simplefin",
          status: "active",
          access_url_ciphertext: encrypted.ciphertextB64,
          access_url_iv: encrypted.ivB64,
          enc_version: 1,
        });

      if (insertError) {
        return json({ error: "Could not create bank connection." }, 500);
      }
    }

    return json({ ok: true });
  } catch {
    return json({ error: "Failed to connect bank account." }, 500);
  }
});
