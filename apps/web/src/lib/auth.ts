import { supabase } from './supabase'

export async function getAccessToken(): Promise<string | null> {
  const { data: current } = await supabase.auth.getSession()
  const currentSession = current.session
  if (currentSession?.access_token) {
    const expiresAtMs = (currentSession.expires_at ?? 0) * 1000
    if (!expiresAtMs || expiresAtMs > Date.now() + 60_000) return currentSession.access_token
  }
  const { data: refreshed, error } = await supabase.auth.refreshSession()
  if (!error && refreshed.session?.access_token) return refreshed.session.access_token
  return currentSession?.access_token ?? null
}
