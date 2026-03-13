import { useEffect, useState } from 'react'
import { captureException } from '@/lib/errorReporting'
import { supabase } from '@/lib/supabase'
import type { SavingsBucketSummaryRpc, ShiftWeekSummaryRpc } from '@/lib/types'

export function useDashboardSupplemental(userId: string | undefined, enabled = true) {
  const [shiftSummary, setShiftSummary] = useState<ShiftWeekSummaryRpc | null>(null)
  const [savingsSummary, setSavingsSummary] = useState<SavingsBucketSummaryRpc | null>(null)
  const [shiftLoading, setShiftLoading] = useState(false)
  const [savingsLoading, setSavingsLoading] = useState(false)

  useEffect(() => {
    if (!enabled || !userId) {
      setShiftLoading(false)
      setSavingsLoading(false)
      return
    }

    let active = true

    const loadSupplemental = async () => {
      setShiftLoading(true)
      setSavingsLoading(true)

      try {
        const [shiftResult, savingsResult] = await Promise.all([
          supabase.rpc('shift_week_summary'),
          supabase.rpc('savings_bucket_summary'),
        ])

        if (!active) return
        if (shiftResult.error) throw shiftResult.error
        if (savingsResult.error) throw savingsResult.error

        setShiftSummary((shiftResult.data ?? null) as ShiftWeekSummaryRpc | null)
        setSavingsSummary((savingsResult.data ?? null) as SavingsBucketSummaryRpc | null)
      } catch (supplementalError) {
        if (!active) return
        setShiftSummary(null)
        setSavingsSummary(null)
        captureException(supplementalError, {
          component: 'useDashboard',
          action: 'load-shift-and-savings-rpcs',
        })
      } finally {
        if (active) {
          setShiftLoading(false)
          setSavingsLoading(false)
        }
      }
    }

    void loadSupplemental()

    return () => {
      active = false
    }
  }, [enabled, userId])

  return {
    shiftSummary,
    savingsSummary,
    shiftLoading,
    savingsLoading,
  }
}
