import { describe, expect, it } from 'vitest'
import { parseAccountsPayload, pickNumber, pickString, toIsoDate } from './payload.ts'

describe('simplefin-sync payload helpers', () => {
  it('parses accounts from nested payload objects', () => {
    expect(
      parseAccountsPayload({
        accounts: [{ id: 'acct_1' }, { id: 'acct_2' }],
      }),
    ).toHaveLength(2)
  })

  it('prefers the first matching string and number keys', () => {
    const record = {
      display_name: 'Checking',
      current_balance: '42.50',
    }

    expect(pickString(record, ['name', 'display_name'])).toBe('Checking')
    expect(pickNumber(record, ['balance', 'current_balance'])).toBe(42.5)
  })

  it('normalizes unix timestamps into ISO strings', () => {
    expect(toIsoDate(1_700_000_000, 'fallback')).toMatch(/^2023-/)
  })
})
