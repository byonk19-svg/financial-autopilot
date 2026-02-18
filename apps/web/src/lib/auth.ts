import { supabase } from './supabase'

export async function getAccessToken(): Promise<string | null> {
  const { data: current } = await supabase.auth.getSession()
  const currentSession = current.session
  const expiresAtMs = (currentSession?.expires_at ?? 0) * 1000

  if (currentSession?.access_token) {
    // Use current access token while still valid to avoid unnecessary refresh attempts.
    if (!expiresAtMs || expiresAtMs > Date.now() + 5_000) return currentSession.access_token
  }

  const { data: refreshed, error } = await supabase.auth.refreshSession()
  if (!error && refreshed.session?.access_token) return refreshed.session.access_token

  // Fallback: if the current access token is still technically valid, use it.
  if (currentSession?.access_token && (!expiresAtMs || expiresAtMs > Date.now())) {
    return currentSession.access_token
  }

  // Stale refresh tokens can trap the app in an unauthorized loop.
  if (error?.message?.toLowerCase().includes('refresh token')) {
    await supabase.auth.signOut({ scope: 'local' })
  }

  return null
}
