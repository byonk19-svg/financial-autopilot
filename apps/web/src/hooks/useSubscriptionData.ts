import { useCallback, useEffect, useState } from 'react'
import { captureException } from '@/lib/errorReporting'
import type { SubscriptionHistoryRow, SubscriptionRecord } from '@/lib/types'
import {
  fetchRecurringPatterns,
  fetchSubscriptionHistory,
} from '@/hooks/useSubscriptions.shared'

export function useSubscriptionData(userId: string | undefined) {
  const [subscriptions, setSubscriptions] = useState<SubscriptionRecord[]>([])
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState('')
  const [historyBySubscriptionId, setHistoryBySubscriptionId] = useState<
    Record<string, SubscriptionHistoryRow[]>
  >({})
  const [dailyTotalsBySubscriptionId, setDailyTotalsBySubscriptionId] = useState<
    Record<string, Record<string, number>>
  >({})
  const [historyLoadingIds, setHistoryLoadingIds] = useState<Record<string, boolean>>({})

  const loadSubscriptions = useCallback(async () => {
    if (!userId) return
    setFetching(true)
    setError('')
    try {
      const rows = await fetchRecurringPatterns()
      setSubscriptions(rows)
    } catch (loadError) {
      captureException(loadError, {
        component: 'useSubscriptions',
        action: 'load-subscriptions',
      })
      const detail = loadError instanceof Error ? loadError.message : 'Could not load subscriptions.'
      setError(detail)
    } finally {
      setFetching(false)
    }
  }, [userId])

  const loadSubscriptionHistory = useCallback(
    async (subscriptionId: string, limit = 24, forceRefresh = false): Promise<void> => {
      if (!forceRefresh && historyBySubscriptionId[subscriptionId]) {
        return
      }

      setHistoryLoadingIds((current) => ({ ...current, [subscriptionId]: true }))
      try {
        const payload = await fetchSubscriptionHistory(subscriptionId, limit)
        setHistoryBySubscriptionId((current) => ({
          ...current,
          [subscriptionId]: payload.history ?? [],
        }))
        setDailyTotalsBySubscriptionId((current) => ({
          ...current,
          [subscriptionId]: payload.daily_totals ?? {},
        }))
      } catch (historyError) {
        captureException(historyError, {
          component: 'useSubscriptions',
          action: 'load-subscription-history',
          subscription_id: subscriptionId,
        })
        const detail =
          historyError instanceof Error
            ? historyError.message
            : 'Could not load subscription transaction history.'
        setError(detail)
      } finally {
        setHistoryLoadingIds((current) => ({ ...current, [subscriptionId]: false }))
      }
    },
    [historyBySubscriptionId],
  )

  useEffect(() => {
    if (!userId) {
      setFetching(false)
      return
    }
    void loadSubscriptions()
  }, [loadSubscriptions, userId])

  return {
    subscriptions,
    setSubscriptions,
    fetching,
    error,
    setError,
    loadSubscriptions,
    loadSubscriptionHistory,
    historyBySubscriptionId,
    dailyTotalsBySubscriptionId,
    historyLoadingIds,
  }
}
