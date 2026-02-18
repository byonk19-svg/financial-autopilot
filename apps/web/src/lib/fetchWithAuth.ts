import { getAccessToken } from './auth'
import { functionUrl } from './functions'
import { supabase } from './supabase'

export class AuthExpiredError extends Error {
  constructor(message = 'Your session expired. Please log in again.') {
    super(message)
    this.name = 'AuthExpiredError'
  }
}

export async function fetchFunctionWithAuth(name: string, init: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken()
  if (!token) {
    await supabase.auth.signOut({ scope: 'local' })
    throw new AuthExpiredError()
  }

  const headers = new Headers(init.headers ?? {})
  if (!headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (anonKey && !headers.has('apikey')) {
    headers.set('apikey', anonKey)
  }

  const response = await fetch(functionUrl(name), {
    ...init,
    headers,
  })

  if (response.status === 401) {
    await supabase.auth.signOut({ scope: 'local' })
    throw new AuthExpiredError('Unauthorized. Please log in again.')
  }

  return response
}

