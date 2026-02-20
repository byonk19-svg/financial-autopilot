import { describe, expect, it, vi, afterEach } from 'vitest'
import { exchangeSetupToken, fetchAccounts } from './simplefin.ts'

afterEach(() => {
  vi.restoreAllMocks()
})

function encodeSetupToken(url: string): string {
  return Buffer.from(url, 'utf8').toString('base64url')
}

describe('simplefin URL safety', () => {
  it('rejects non-https claim urls', async () => {
    const token = encodeSetupToken('http://bridge.simplefin.org/setup')
    await expect(exchangeSetupToken(token)).rejects.toThrow('must use https')
  })

  it('rejects non-allowlisted hosts', async () => {
    const token = encodeSetupToken('https://example.com/setup')
    await expect(exchangeSetupToken(token)).rejects.toThrow('host is not allowed')
  })

  it('rejects non-allowlisted access urls returned by claim call', async () => {
    const token = encodeSetupToken('https://bridge.simplefin.org/setup')
    vi.stubGlobal('fetch', vi.fn(async () => new Response('https://example.com/access', { status: 200 })))

    await expect(exchangeSetupToken(token)).rejects.toThrow('host is not allowed')
  })

  it('allows fetchAccounts for allowlisted host', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ accounts: [] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })),
    )

    const payload = await fetchAccounts('https://bridge.simplefin.org/access-token', { pending: true })
    expect(payload).toEqual({ accounts: [] })
  })
})
