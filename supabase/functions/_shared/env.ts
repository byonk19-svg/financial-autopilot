export function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getSupabaseConfig(): { url: string; anonKey: string; serviceRoleKey: string } {
  return {
    url: requireEnv("SUPABASE_URL"),
    anonKey: requireEnv("SUPABASE_ANON_KEY"),
    serviceRoleKey: requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
  };
}

function parseSimplefinKeyring(raw: string): Record<string, string> {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("SIMPLEFIN_ENC_KEYS_JSON must be a JSON object.");
    }

    const map: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (!key || typeof value !== "string" || value.trim().length === 0) {
        continue;
      }
      map[key] = value;
    }
    return map;
  } catch (error) {
    const message = error instanceof Error ? error.message : "invalid JSON";
    throw new Error(`Invalid SIMPLEFIN_ENC_KEYS_JSON: ${message}`);
  }
}

export function getSimplefinConfig(): { encKey: string; encKid: string; keyByKid: Record<string, string> } {
  const encKey = requireEnv("SIMPLEFIN_ENC_KEY");
  const encKid = (Deno.env.get("SIMPLEFIN_ENC_KID") ?? "v1").trim() || "v1";
  const keyringRaw = Deno.env.get("SIMPLEFIN_ENC_KEYS_JSON");
  const keyByKid = keyringRaw && keyringRaw.trim().length > 0 ? parseSimplefinKeyring(keyringRaw) : {};

  // Always prefer the active key/kid pair from dedicated secrets.
  keyByKid[encKid] = encKey;

  return {
    encKey,
    encKid,
    keyByKid,
  };
}

export function getCronSecret(): string | undefined {
  const value = Deno.env.get("CRON_SECRET");
  if (!value || value.trim().length === 0) {
    return undefined;
  }
  return value;
}
