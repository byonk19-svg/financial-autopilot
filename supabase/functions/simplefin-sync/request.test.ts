import { describe, expect, it } from 'vitest'
import { getBearerToken, isCronRequest } from './request.ts'

describe('simplefin-sync request helpers', () => {
  it('extracts bearer tokens from authorization headers', () => {
    const req = new Request('https://example.com', {
      headers: {
        Authorization: 'Bearer token-123',
      },
    })

    expect(getBearerToken(req)).toBe('token-123')
  })

  it('detects authorized cron requests', () => {
    const req = new Request('https://example.com', {
      headers: {
        'x-cron-secret': 'secret-123',
      },
    })

    expect(isCronRequest(req, 'secret-123')).toBe(true)
    expect(isCronRequest(req, 'different-secret')).toBe(false)
  })
})
