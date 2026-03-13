import { useCallback, useMemo, useState } from 'react'
import {
  hasPriceIncrease,
  parseDate,
  toRecurringMerchantLabel,
  toMonthlyEquivalentAmount,
  toCurrency,
  toNumber,
} from '@/lib/subscriptionFormatters'
import type { SubscriptionRecord } from '@/lib/types'
import { useSubscriptionActions } from '@/hooks/useSubscriptionActions'
import { useSubscriptionData } from '@/hooks/useSubscriptionData'
import {
  type CadenceFilter,
  DENSITY_LABELS,
  ENABLE_RERUN_DETECTION,
} from '@/hooks/useSubscriptions.shared'

export type { CadenceFilter }
export { DENSITY_LABELS, ENABLE_RERUN_DETECTION }

export function useSubscriptions(userId: string | undefined) {
  const [searchQuery, setSearchQuery] = useState('')
  const [cadenceFilter, setCadenceFilter] = useState<CadenceFilter>('all')
  const [priceIncreaseOnly, setPriceIncreaseOnly] = useState(false)
  const [showIgnored, setShowIgnored] = useState(false)

  const {
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
  } = useSubscriptionData(userId)

  const {
    processingId,
    rerunningDetection,
    density,
    setDensity,
    markInactive,
    setClassification,
    toggleClassificationLock,
    undoClassification,
    markFalsePositive,
    updateNotifyDaysBefore,
    renameMerchant,
    createWebIdSplitAliases,
    createAmountSplitRules,
    rerunDetection,
  } = useSubscriptionActions({
    loadSubscriptions,
    setSharedError: setError,
    setSubscriptions,
    userId,
  })

  const clearFilters = useCallback(() => {
    setSearchQuery('')
    setCadenceFilter('all')
    setPriceIncreaseOnly(false)
    setShowIgnored(false)
  }, [])

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
      const displayMerchant = toRecurringMerchantLabel(row.merchant_normalized).toLowerCase()
      const matchesSearch = search.length === 0 || merchant.includes(search) || displayMerchant.includes(search)

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
    renameMerchant,
    createWebIdSplitAliases,
    createAmountSplitRules,
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
