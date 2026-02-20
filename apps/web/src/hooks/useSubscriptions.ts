import { useCallback, useEffect, useMemo, useState } from 'react'
import type {
  SubscriptionClassification,
  SubscriptionHistoryRow,
  SubscriptionRecord,
} from '@/lib/types'
import { captureException } from '@/lib/errorReporting'
import { fetchFunctionWithAuth } from '@/lib/fetchWithAuth'
import {
  hasPriceIncrease,
  parseDate,
  toMonthlyEquivalentAmount,
  toCurrency,
  toNumber,
  type DensityMode,
} from '@/lib/subscriptionFormatters'
import { supabase } from '@/lib/supabase'

type GroupedRecurringResponse = {
  ok: boolean
  grouped: Record<SubscriptionClassification, SubscriptionRecord[]>
}

type SubscriptionHistoryResponse = {
  ok: boolean
  history: SubscriptionHistoryRow[]
  daily_totals?: Record<string, number>
}

export type CadenceFilter = 'all' | 'weekly' | 'monthly' | 'annual'

const DENSITY_STORAGE_KEY = 'subscriptions_density'
export const ENABLE_RERUN_DETECTION = import.meta.env.VITE_ENABLE_RERUN_DETECTION === 'true'

export const DENSITY_LABELS: Record<DensityMode, string> = {
  comfortable: 'Comfortable',
  compact: 'Compact',
}

function normalizeClassification(value: string): SubscriptionClassification {
  if (value === 'subscription') return 'subscription'
  if (value === 'bill_loan') return 'bill_loan'
  if (value === 'transfer') return 'transfer'
  if (value === 'ignore') return 'ignore'
  return 'needs_review'
}

export function useSubscriptions(userId: string | undefined) {
  const [subscriptions, setSubscriptions] = useState<SubscriptionRecord[]>([])
  const [fetching, setFetching] = useState(true)
  const [processingId, setProcessingId] = useState('')
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [cadenceFilter, setCadenceFilter] = useState<CadenceFilter>('all')
  const [priceIncreaseOnly, setPriceIncreaseOnly] = useState(false)
  const [showIgnored, setShowIgnored] = useState(false)
  const [rerunningDetection, setRerunningDetection] = useState(false)
  const [historyBySubscriptionId, setHistoryBySubscriptionId] = useState<
    Record<string, SubscriptionHistoryRow[]>
  >({})
  const [dailyTotalsBySubscriptionId, setDailyTotalsBySubscriptionId] = useState<
    Record<string, Record<string, number>>
  >({})
  const [historyLoadingIds, setHistoryLoadingIds] = useState<Record<string, boolean>>({})
  const [density, setDensity] = useState<DensityMode>(() => {
    if (typeof window === 'undefined') return 'comfortable'
    const savedDensity = window.localStorage.getItem(DENSITY_STORAGE_KEY)
    return savedDensity === 'compact' ? 'compact' : 'comfortable'
  })

  const fetchRecurring = useCallback(async (): Promise<SubscriptionRecord[]> => {
    const response = await fetchFunctionWithAuth('recurring', {
      method: 'GET',
    })

    const payload = (await response.json().catch(() => ({}))) as
      | GroupedRecurringResponse
      | { error?: string }

    if (!response.ok) {
      throw new Error((payload as { error?: string }).error ?? 'Could not load recurring patterns.')
    }

    const grouped = (payload as GroupedRecurringResponse).grouped
    const orderedClasses: SubscriptionClassification[] = [
      'subscription',
      'bill_loan',
      'needs_review',
      'transfer',
      'ignore',
    ]

    return orderedClasses.flatMap((classification) =>
      (grouped?.[classification] ?? []).map((row) => ({
        ...row,
        classification: normalizeClassification(row.classification ?? 'needs_review'),
        is_false_positive: row.is_false_positive === true,
        user_locked: row.user_locked === true,
        is_active: true,
      })),
    )
  }, [])

  const classifyRecurring = useCallback(async (
    subscriptionId: string,
    body: { classification: SubscriptionClassification; lock?: boolean; createRule?: boolean },
  ) => {
    const response = await fetchFunctionWithAuth(`recurring/${subscriptionId}/classify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    const payload = (await response.json().catch(() => ({}))) as {
      error?: string
      recurring?: Partial<SubscriptionRecord>
    }

    if (!response.ok) {
      throw new Error(payload.error ?? 'Could not classify recurring pattern.')
    }

    return payload.recurring ?? null
  }, [])

  const loadSubscriptionHistory = useCallback(
    async (subscriptionId: string, limit = 24, forceRefresh = false): Promise<void> => {
      if (!forceRefresh && historyBySubscriptionId[subscriptionId]) {
        return
      }

      setHistoryLoadingIds((current) => ({ ...current, [subscriptionId]: true }))
      try {
        const response = await fetchFunctionWithAuth(
          `recurring/${subscriptionId}/history?limit=${Math.max(6, Math.min(48, limit))}`,
          {
            method: 'GET',
          },
        )

        const payload = (await response.json().catch(() => ({}))) as
          | SubscriptionHistoryResponse
          | { error?: string }

        if (!response.ok) {
          throw new Error(
            (payload as { error?: string }).error ?? 'Could not load subscription transaction history.',
          )
        }

        const typedPayload = payload as SubscriptionHistoryResponse
        setHistoryBySubscriptionId((current) => ({
          ...current,
          [subscriptionId]: typedPayload.history ?? [],
        }))
        setDailyTotalsBySubscriptionId((current) => ({
          ...current,
          [subscriptionId]: typedPayload.daily_totals ?? {},
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

  const loadSubscriptions = useCallback(async () => {
    if (!userId) return
    setFetching(true)
    setError('')
    try {
      const rows = await fetchRecurring()
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
  }, [fetchRecurring, userId])

  useEffect(() => {
    if (!userId) {
      setFetching(false)
      return
    }
    void loadSubscriptions()
  }, [loadSubscriptions, userId])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(DENSITY_STORAGE_KEY, density)
  }, [density])

  const markInactive = useCallback(async (subscription: SubscriptionRecord) => {
    if (!userId) return
    setProcessingId(subscription.id)
    setError('')

    const { error: updateError } = await supabase
      .from('subscriptions')
      .update({ is_active: false })
      .eq('id', subscription.id)
      .eq('user_id', userId)

    if (updateError) {
      setError('Could not mark subscription inactive.')
      setProcessingId('')
      return
    }

    setSubscriptions((current) => current.filter((row) => row.id !== subscription.id))
    setProcessingId('')
  }, [userId])

  const markFalsePositive = useCallback(
    async (subscription: SubscriptionRecord, rerunAfterMark = false) => {
      if (!userId) return
      setProcessingId(subscription.id)
      setError('')

      let previousState: SubscriptionRecord[] = []
      setSubscriptions((current) => {
        previousState = current
        return current.map((row) =>
          row.id === subscription.id
            ? {
                ...row,
                is_false_positive: true,
                classification: 'ignore',
                user_locked: true,
              }
            : row,
        )
      })

      const { error: updateError } = await supabase
        .from('subscriptions')
        .update({
          is_false_positive: true,
          classification: 'ignore',
          user_locked: true,
          classified_at: new Date().toISOString(),
          classified_by: userId,
        })
        .eq('id', subscription.id)
        .eq('user_id', userId)

      if (updateError) {
        captureException(updateError, {
          component: 'useSubscriptions',
          action: 'mark-false-positive',
          subscription_id: subscription.id,
        })
        setSubscriptions(previousState)
        setError('Could not mark this as not a subscription.')
        setProcessingId('')
        return
      }

      if (rerunAfterMark) {
        const response = await fetchFunctionWithAuth('analysis-daily', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        })
        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as { error?: string; detail?: string }
          captureException(new Error(payload.detail ?? payload.error ?? 'Could not re-run analysis.'), {
            component: 'useSubscriptions',
            action: 'rerun-after-false-positive',
            subscription_id: subscription.id,
          })
          setError(payload.detail ?? payload.error ?? 'Saved as false positive, but could not re-run analysis.')
        } else {
          await loadSubscriptions()
        }
      }

      setProcessingId('')
    },
    [loadSubscriptions, userId],
  )

  const updateNotifyDaysBefore = useCallback(
    async (subscription: SubscriptionRecord, notifyDaysBefore: number | null) => {
      if (!userId) return
      setProcessingId(subscription.id)
      setError('')

      let previousState: SubscriptionRecord[] = []
      setSubscriptions((current) => {
        previousState = current
        return current.map((row) =>
          row.id === subscription.id
            ? {
                ...row,
                notify_days_before: notifyDaysBefore,
              }
            : row,
        )
      })

      const { error: updateError } = await supabase
        .from('subscriptions')
        .update({ notify_days_before: notifyDaysBefore })
        .eq('id', subscription.id)
        .eq('user_id', userId)

      if (updateError) {
        captureException(updateError, {
          component: 'useSubscriptions',
          action: 'update-notify-days-before',
          subscription_id: subscription.id,
        })
        setSubscriptions(previousState)
        setError('Could not update reminder window.')
      }

      setProcessingId('')
    },
    [userId],
  )

  const setClassification = useCallback(async (
    subscription: SubscriptionRecord,
    classification: SubscriptionClassification,
    createRule: boolean,
  ) => {
    if (!userId) return
    setProcessingId(subscription.id)
    setError('')

    let previousState: SubscriptionRecord[] = []
    setSubscriptions((current) => {
      previousState = current
      return current.map((row) =>
        row.id === subscription.id
          ? {
              ...row,
              classification,
              user_locked: true,
            }
          : row,
      )
    })

    try {
      const recurring = await classifyRecurring(subscription.id, {
        classification,
        lock: true,
        createRule,
      })
      setSubscriptions((current) =>
        current.map((row) =>
          row.id === subscription.id
            ? {
                ...row,
                ...(recurring ?? {}),
              }
            : row,
        ),
      )
    } catch (updateError) {
      captureException(updateError, {
        component: 'useSubscriptions',
        action: 'set-classification',
        subscription_id: subscription.id,
        classification,
      })
      setSubscriptions(previousState)
      const detail = updateError instanceof Error ? updateError.message : 'Could not update classification.'
      setError(detail)
    } finally {
      setProcessingId('')
    }
  }, [classifyRecurring, userId])

  const toggleClassificationLock = useCallback(async (subscription: SubscriptionRecord) => {
    if (!userId) return
    setProcessingId(subscription.id)
    setError('')

    try {
      const nextLocked = !subscription.user_locked
      const recurring = await classifyRecurring(subscription.id, {
        classification: normalizeClassification(subscription.classification),
        lock: nextLocked,
        createRule: false,
      })
      setSubscriptions((current) =>
        current.map((row) =>
          row.id === subscription.id
            ? {
                ...row,
                user_locked: nextLocked,
                ...(recurring ?? {}),
              }
            : row,
        ),
      )
    } catch (updateError) {
      captureException(updateError, {
        component: 'useSubscriptions',
        action: 'toggle-classification-lock',
        subscription_id: subscription.id,
      })
      const detail = updateError instanceof Error ? updateError.message : 'Could not update lock state.'
      setError(detail)
    } finally {
      setProcessingId('')
    }
  }, [classifyRecurring, userId])

  const undoClassification = useCallback(async (subscription: SubscriptionRecord) => {
    if (!userId) return
    setProcessingId(subscription.id)
    setError('')

    let previousState: SubscriptionRecord[] = []
    setSubscriptions((current) => {
      previousState = current
      return current.map((row) =>
        row.id === subscription.id
          ? {
              ...row,
              classification: 'needs_review',
              user_locked: false,
              is_false_positive: false,
            }
          : row,
      )
    })

    try {
      if (subscription.is_false_positive) {
        const { error: resetError } = await supabase
          .from('subscriptions')
          .update({
            classification: 'needs_review',
            user_locked: false,
            is_false_positive: false,
            classified_at: null,
            classified_by: null,
          })
          .eq('id', subscription.id)
          .eq('user_id', userId)

        if (resetError) {
          throw resetError
        }

        setProcessingId('')
        return
      }

      const recurring = await classifyRecurring(subscription.id, {
        classification: 'needs_review',
        lock: false,
        createRule: false,
      })
      setSubscriptions((current) =>
        current.map((row) =>
          row.id === subscription.id
            ? {
                ...row,
                ...(recurring ?? {}),
              }
            : row,
        ),
      )
    } catch (undoError) {
      captureException(undoError, {
        component: 'useSubscriptions',
        action: 'undo-classification',
        subscription_id: subscription.id,
      })
      setSubscriptions(previousState)
      const detail = undoError instanceof Error ? undoError.message : 'Could not undo classification.'
      setError(detail)
    } finally {
      setProcessingId('')
    }
  }, [classifyRecurring, userId])

  const clearFilters = useCallback(() => {
    setSearchQuery('')
    setCadenceFilter('all')
    setPriceIncreaseOnly(false)
    setShowIgnored(false)
  }, [])

  const rerunDetection = useCallback(async () => {
    if (!ENABLE_RERUN_DETECTION) return
    setRerunningDetection(true)
    setError('')

    try {
      const response = await fetchFunctionWithAuth('analysis-daily', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      })

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string; detail?: string }
        throw new Error(payload.detail ?? payload.error ?? 'Could not re-run detection from this environment.')
      }

      await loadSubscriptions()
    } catch (rerunError) {
      captureException(rerunError, {
        component: 'useSubscriptions',
        action: 'rerun-detection',
      })
      setError('Could not re-run detection from this environment.')
    } finally {
      setRerunningDetection(false)
    }
  }, [loadSubscriptions])

  const allSubscriptionRows = useMemo(
    () => subscriptions.filter((row) => row.classification === 'subscription'),
    [subscriptions],
  )
  const allBillAndLoanRows = useMemo(
    () => subscriptions.filter((row) => row.classification === 'bill_loan'),
    [subscriptions],
  )
  const allReviewRows = useMemo(
    () => subscriptions.filter((row) => row.classification === 'needs_review'),
    [subscriptions],
  )

  const filteredRows = useMemo(() => {
    const search = searchQuery.trim().toLowerCase()

    return subscriptions.filter((row) => {
      const merchant = row.merchant_normalized.toLowerCase()
      const matchesSearch = search.length === 0 || merchant.includes(search)

      const matchesCadence =
        cadenceFilter === 'all'
          ? true
          : cadenceFilter === 'annual'
            ? row.cadence === 'yearly'
            : row.cadence === cadenceFilter

      const matchesIncrease =
        !priceIncreaseOnly ||
        hasPriceIncrease({
          lastAmount: row.last_amount,
          prevAmount: row.prev_amount,
        })

      const matchesIgnored = showIgnored ? true : row.classification !== 'ignore'

      return matchesSearch && matchesCadence && matchesIncrease && matchesIgnored
    })
  }, [subscriptions, searchQuery, cadenceFilter, priceIncreaseOnly, showIgnored])

  const sortByNextExpected = useCallback((a: SubscriptionRecord, b: SubscriptionRecord) => {
    const aDate = parseDate(a.next_expected_at)
    const bDate = parseDate(b.next_expected_at)
    if (aDate && bDate) return aDate.getTime() - bDate.getTime()
    if (aDate && !bDate) return -1
    if (!aDate && bDate) return 1
    return a.merchant_normalized.localeCompare(b.merchant_normalized)
  }, [])

  const reviewRows = useMemo(() => {
    return filteredRows
      .filter((row) => row.classification === 'needs_review')
      .sort((a, b) => {
        const confidenceDiff = toNumber(a.confidence) - toNumber(b.confidence)
        if (confidenceDiff !== 0) return confidenceDiff
        return sortByNextExpected(a, b)
      })
  }, [filteredRows, sortByNextExpected])

  const subscriptionRows = useMemo(
    () => filteredRows.filter((row) => row.classification === 'subscription').sort(sortByNextExpected),
    [filteredRows, sortByNextExpected],
  )
  const billAndLoanRows = useMemo(
    () => filteredRows.filter((row) => row.classification === 'bill_loan').sort(sortByNextExpected),
    [filteredRows, sortByNextExpected],
  )
  const transferRows = useMemo(
    () => filteredRows.filter((row) => row.classification === 'transfer').sort(sortByNextExpected),
    [filteredRows, sortByNextExpected],
  )
  const ignoredRows = useMemo(
    () => filteredRows.filter((row) => row.classification === 'ignore').sort(sortByNextExpected),
    [filteredRows, sortByNextExpected],
  )

  const monthlySubscriptionsTotal = useMemo(
    () =>
      allSubscriptionRows.reduce(
        (sum, row) => sum + toMonthlyEquivalentAmount({ lastAmount: row.last_amount, cadence: row.cadence }),
        0,
      ),
    [allSubscriptionRows],
  )
  const billsAndLoansTotal = useMemo(
    () => allBillAndLoanRows.reduce((sum, row) => sum + toNumber(row.last_amount), 0),
    [allBillAndLoanRows],
  )
  const nextSevenDaysSummary = useMemo(() => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const cutoff = new Date(today)
    cutoff.setDate(cutoff.getDate() + 7)

    return subscriptions.reduce(
      (acc, row) => {
        const dueDate = parseDate(row.next_expected_at)
        if (!dueDate) return acc
        if (dueDate >= today && dueDate <= cutoff) {
          acc.count += 1
          acc.amount += toNumber(row.last_amount)
        }
        return acc
      },
      { count: 0, amount: 0 },
    )
  }, [subscriptions])

  const flaggedIncreases = useMemo(
    () =>
      subscriptions.filter((row) =>
        hasPriceIncrease({
          lastAmount: row.last_amount,
          prevAmount: row.prev_amount,
        }),
      ).length,
    [subscriptions],
  )

  const hasFiltersApplied =
    searchQuery.trim().length > 0 || cadenceFilter !== 'all' || priceIncreaseOnly || showIgnored
  const isEmptyData = !fetching && subscriptions.length === 0
  const visibleRowCount =
    reviewRows.length +
    subscriptionRows.length +
    billAndLoanRows.length +
    transferRows.length +
    (showIgnored ? ignoredRows.length : 0)
  const isNoMatches = !fetching && subscriptions.length > 0 && visibleRowCount === 0

  return {
    subscriptions,
    fetching,
    processingId,
    error,
    searchQuery,
    cadenceFilter,
    priceIncreaseOnly,
    showIgnored,
    rerunningDetection,
    density,
    allSubscriptionRows,
    allBillAndLoanRows,
    allReviewRows,
    reviewRows,
    subscriptionRows,
    billAndLoanRows,
    transferRows,
    ignoredRows,
    monthlySubscriptionsTotal,
    billsAndLoansTotal,
    nextSevenDaysSummary,
    flaggedIncreases,
    hasFiltersApplied,
    isEmptyData,
    isNoMatches,
    setSearchQuery,
    setCadenceFilter,
    setPriceIncreaseOnly,
    setShowIgnored,
    setDensity,
    clearFilters,
    markInactive,
    setClassification,
    toggleClassificationLock,
    undoClassification,
    markFalsePositive,
    updateNotifyDaysBefore,
    loadSubscriptionHistory,
    rerunDetection,
    loadSubscriptions,
    historyBySubscriptionId,
    dailyTotalsBySubscriptionId,
    historyLoadingIds,
    formattedMonthlySubscriptionsTotal: toCurrency(monthlySubscriptionsTotal),
    formattedBillsAndLoansTotal: toCurrency(billsAndLoansTotal),
    formattedNextSevenDaysAmount: toCurrency(nextSevenDaysSummary.amount),
  }
}
