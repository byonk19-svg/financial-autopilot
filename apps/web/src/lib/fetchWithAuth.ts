import { getAccessToken } from './auth'
import { functionUrl } from './functions'
import { supabase } from './supabase'

export class AuthExpiredError extends Error {
  constructor(message = 'Your session expired. Please log in again.') {
    super(message)
    this.name = 'AuthExpiredError'
  }
}

function withAuthHeaders(headersInit: HeadersInit | undefined, token: string): Headers {
  const headers = new Headers(headersInit ?? {})
  headers.set('Authorization', `Bearer ${token}`)

  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (anonKey && !headers.has('apikey')) {
    headers.set('apikey', anonKey)
  }

  return headers
}

export async function fetchFunctionWithAuth(name: string, init: RequestInit = {}): Promise<Response> {
  const request = async (token: string) =>
    fetch(functionUrl(name), {
      ...init,
      headers: withAuthHeaders(init.headers, token),
    })

  let token = await getAccessToken()
  if (!token) {
    await supabase.auth.signOut({ scope: 'local' })
    throw new AuthExpiredError()
  }

  let response = await request(token)

  // Retry once with a refreshed token to reduce spurious 401s from stale access tokens.
  if (response.status === 401) {
    const refreshedToken = await getAccessToken()
    if (refreshedToken && refreshedToken !== token) {
      token = refreshedToken
      response = await request(token)
    }
  }

  if (response.status === 401) {
    await supabase.auth.signOut({ scope: 'local' })
    throw new AuthExpiredError('Unauthorized. Please log in again.')
  }

  return response
}
