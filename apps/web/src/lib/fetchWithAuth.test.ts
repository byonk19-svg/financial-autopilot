import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  functionUrl: vi.fn(),
  getAccessToken: vi.fn(),
  signOut: vi.fn(),
}))

vi.mock('./auth', () => ({
  getAccessToken: mocks.getAccessToken,
}))

vi.mock('./functions', () => ({
  functionUrl: mocks.functionUrl,
}))

vi.mock('./supabase', () => ({
  supabase: {
    auth: {
      signOut: mocks.signOut,
    },
  },
}))

import { AuthExpiredError, fetchFunctionWithAuth } from './fetchWithAuth'

describe('fetchFunctionWithAuth', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    mocks.functionUrl.mockReturnValue('https://example.test/functions/v1')
    mocks.getAccessToken.mockReset()
    mocks.signOut.mockReset()
    vi.stubGlobal('fetch', vi.fn())
  })

  it('injects auth and apikey headers for function requests', async () => {
    mocks.getAccessToken.mockResolvedValue('token-1')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key')
    vi.mocked(global.fetch).mockResolvedValue(new Response('{}', { status: 200 }))

    await fetchFunctionWithAuth('analysis-daily', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })

    expect(global.fetch).toHaveBeenCalledTimes(1)
    const [, init] = vi.mocked(global.fetch).mock.calls[0]
    const headers = new Headers((init as RequestInit).headers)
    expect(headers.get('Authorization')).toBe('Bearer token-1')
    expect(headers.get('apikey')).toBe('anon-key')
    expect(headers.get('Content-Type')).toBe('application/json')
  })

  it('retries once when the first response is unauthorized and a refreshed token is available', async () => {
    mocks.getAccessToken.mockResolvedValueOnce('stale-token').mockResolvedValueOnce('fresh-token')
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(new Response('{}', { status: 401 }))
      .mockResolvedValueOnce(new Response('{}', { status: 200 }))

    const response = await fetchFunctionWithAuth('recurring')

    expect(response.status).toBe(200)
    expect(global.fetch).toHaveBeenCalledTimes(2)
    const firstHeaders = new Headers((vi.mocked(global.fetch).mock.calls[0][1] as RequestInit).headers)
    const secondHeaders = new Headers((vi.mocked(global.fetch).mock.calls[1][1] as RequestInit).headers)
    expect(firstHeaders.get('Authorization')).toBe('Bearer stale-token')
    expect(secondHeaders.get('Authorization')).toBe('Bearer fresh-token')
    expect(mocks.signOut).not.toHaveBeenCalled()
  })

  it('signs out locally and throws when auth cannot be recovered', async () => {
    mocks.getAccessToken.mockResolvedValue(null)

    await expect(fetchFunctionWithAuth('system-health')).rejects.toBeInstanceOf(AuthExpiredError)

    expect(global.fetch).not.toHaveBeenCalled()
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: 'local' })
  })
})
