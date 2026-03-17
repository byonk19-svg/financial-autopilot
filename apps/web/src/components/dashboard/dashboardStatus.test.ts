import { describe, expect, it } from 'vitest'
import {
  getDashboardStatusUi,
  getDashboardToneFromStatus,
  getDashboardToneUi,
  humanizeDashboardStatus,
} from './dashboardStatus'

describe('dashboardStatus helpers', () => {
  it('maps status strings to shared semantic tones', () => {
    expect(getDashboardToneFromStatus('succeeded')).toBe('positive')
    expect(getDashboardToneFromStatus('running')).toBe('warning')
    expect(getDashboardToneFromStatus('failed')).toBe('danger')
    expect(getDashboardToneFromStatus('unknown')).toBe('neutral')
  })

  it('returns consistent class sets for semantic tones', () => {
    expect(getDashboardToneUi('positive')).toMatchObject({
      tone: 'positive',
      badgeClassName: expect.stringContaining('emerald'),
      dotClassName: expect.stringContaining('emerald'),
    })
    expect(getDashboardToneUi('warning')).toMatchObject({
      tone: 'warning',
      textClassName: expect.stringContaining('amber'),
    })
  })

  it('humanizes status labels and preserves a fallback', () => {
    expect(humanizeDashboardStatus('last_run_failed')).toBe('Last Run Failed')
    expect(humanizeDashboardStatus(null)).toBe('Unknown')
    expect(getDashboardStatusUi('missing_data').surfaceClassName).toContain('rose')
  })
})
