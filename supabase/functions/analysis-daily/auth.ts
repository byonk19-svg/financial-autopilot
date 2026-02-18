import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

export function isCronAuthorized(req: Request, cronSecret: string): boolean {
  const provided = req.headers.get("x-cron-secret");
  return Boolean(provided && provided === cronSecret);
}

export function getBearerToken(req: Request): string | null {
  const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
}

export async function resolveManualUserId(
  admin: ReturnType<typeof createClient>,
  req: Request,
): Promise<string | null> {
  const token = getBearerToken(req);
  if (!token) return null;

  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}
