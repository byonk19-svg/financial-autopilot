import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { captureException } from '@/lib/errorReporting'
import { getLoginRedirectPath } from '@/lib/loginRedirect'
import { supabase } from '@/lib/supabase'
import { useSession } from '@/lib/session'
import type {
  AlertFeedbackMap,
  AlertFeedbackRow,
  AlertRow,
  AlertSeverityFilter,
  AlertTypeFilter,
} from '@/lib/types'

function toFeedbackMerchantCanonical(merchant: string | null): string {
  const normalized = (merchant ?? '').trim().toLowerCase()
  return normalized.length > 0 ? normalized : '__unscoped__'
}

function toAlertFeedbackKey(alertType: AlertRow['alert_type'], merchantCanonical: string): string {
  return `${alertType}::${merchantCanonical}`
}

export function useAlerts() {
  const navigate = useNavigate()
  const { session, loading } = useSession()
  const [alerts, setAlerts] = useState<AlertRow[]>([])
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState('')
  const [updatingId, setUpdatingId] = useState('')
  const [bulkUpdating, setBulkUpdating] = useState<'read' | 'dismiss' | ''>('')
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [severityFilter, setSeverityFilter] = useState<AlertSeverityFilter>('all')
  const [typeFilter, setTypeFilter] = useState<AlertTypeFilter>('all')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [expandedIds, setExpandedIds] = useState<string[]>([])
  const [feedbackByKey, setFeedbackByKey] = useState<AlertFeedbackMap>({})
  const fetchVersionRef = useRef(0)

  const loadAlerts = useCallback(async () => {
    if (!session?.user) return
    const version = ++fetchVersionRef.current
    setFetching(true)
    setError('')

    let query = supabase
      .from('alerts')
      .select(
        'id, alert_type, severity, title, body, merchant_normalized, amount, reasoning, created_at, read_at, is_dismissed',
      )
      .eq('user_id', session.user.id)
      .eq('is_dismissed', false)
      .order('created_at', { ascending: false })

    if (unreadOnly) query = query.is('read_at', null)
    if (severityFilter !== 'all') query = query.eq('severity', severityFilter)
    if (typeFilter !== 'all') query = query.eq('alert_type', typeFilter)

    const { data, error: fetchError } = await query

    if (version !== fetchVersionRef.current) return

    if (fetchError) {
      captureException(fetchError, { component: 'Alerts', action: 'load-alerts' })
      setError('Could not load alerts.')
      setFetching(false)
      return
    }

    const rows = (data ?? []) as AlertRow[]
    setAlerts(rows)
    setExpandedIds((current) => current.filter((id) => rows.some((row) => row.id === id)))
    setSelectedIds((current) => {
      const visible = new Set(rows.map((row) => row.id))
      return current.filter((id) => visible.has(id))
    })

    if (rows.length === 0) {
      setFeedbackByKey({})
      setFetching(false)
      return
    }

    const alertTypes = [...new Set(rows.map((row) => row.alert_type))]
    const merchants = [
      ...new Set(rows.map((row) => toFeedbackMerchantCanonical(row.merchant_normalized))),
    ]

    const { data: feedbackData, error: feedbackError } = await supabase
      .from('alert_feedback')
      .select('alert_type, merchant_canonical, is_expected, created_at')
      .eq('user_id', session.user.id)
      .in('alert_type', alertTypes)
      .in('merchant_canonical', merchants)

    if (version !== fetchVersionRef.current) return

    if (feedbackError) {
      captureException(feedbackError, { component: 'Alerts', action: 'load-feedback' })
      setError('Could not load alert feedback.')
      setFeedbackByKey({})
      setFetching(false)
      return
    }

    const feedbackMap = ((feedbackData ?? []) as AlertFeedbackRow[]).reduce<AlertFeedbackMap>(
      (acc, row) => {
        const key = toAlertFeedbackKey(row.alert_type, row.merchant_canonical)
        acc[key] = { isExpected: row.is_expected, createdAt: row.created_at }
        return acc
      },
      {},
    )

    setFeedbackByKey(feedbackMap)
    setFetching(false)
  }, [session?.user, unreadOnly, severityFilter, typeFilter])

  useEffect(() => {
    if (loading) return
    if (!session?.user) {
      navigate(getLoginRedirectPath(), { replace: true })
      return
    }
    void loadAlerts()
  }, [loading, navigate, session, loadAlerts])

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds])
  const allVisibleSelected =
    alerts.length > 0 && alerts.every((row) => selectedIdSet.has(row.id))

  const getFeedbackKeyForAlert = useCallback((alert: AlertRow) => {
    const merchantCanonical = toFeedbackMerchantCanonical(alert.merchant_normalized)
    return toAlertFeedbackKey(alert.alert_type, merchantCanonical)
  }, [])

  const markRead = useCallback(
    async (alert: AlertRow) => {
      if (!session?.user || alert.read_at) return
      setUpdatingId(alert.id)
      setError('')
      const previousAlerts = alerts
      const previousSelectedIds = selectedIds

      const readAt = new Date().toISOString()
      setAlerts((current) =>
        current.map((row) => (row.id === alert.id ? { ...row, read_at: readAt } : row)),
      )
      setSelectedIds((current) => current.filter((id) => id !== alert.id))

      const { error: updateError } = await supabase
        .from('alerts')
        .update({ read_at: readAt })
        .eq('id', alert.id)
        .eq('user_id', session.user.id)

      if (updateError) {
        captureException(updateError, {
          component: 'Alerts',
          action: 'mark-read',
          alert_id: alert.id,
        })
        setAlerts(previousAlerts)
        setSelectedIds(previousSelectedIds)
        setError('Could not mark alert as read.')
        setUpdatingId('')
        return
      }

      setUpdatingId('')
    },
    [alerts, selectedIds, session?.user],
  )

  const dismissAlert = useCallback(
    async (alert: AlertRow) => {
      if (!session?.user) return
      setUpdatingId(alert.id)
      setError('')

      const { error: updateError } = await supabase
        .from('alerts')
        .update({ is_dismissed: true })
        .eq('id', alert.id)
        .eq('user_id', session.user.id)

      if (updateError) {
        captureException(updateError, {
          component: 'Alerts',
          action: 'dismiss-alert',
          alert_id: alert.id,
        })
        setError('Could not dismiss alert.')
        setUpdatingId('')
        return
      }

      setAlerts((current) => current.filter((row) => row.id !== alert.id))
      setSelectedIds((current) => current.filter((id) => id !== alert.id))
      setUpdatingId('')
    },
    [session?.user],
  )

  const toggleSelectAlert = useCallback((alertId: string) => {
    setSelectedIds((current) =>
      current.includes(alertId) ? current.filter((id) => id !== alertId) : [...current, alertId],
    )
  }, [])

  const toggleSelectVisible = useCallback(() => {
    const visibleIds = alerts.map((row) => row.id)
    if (visibleIds.length === 0) return

    setSelectedIds((current) => {
      if (allVisibleSelected) {
        return current.filter((id) => !visibleIds.includes(id))
      }
      const next = new Set(current)
      for (const id of visibleIds) next.add(id)
      return [...next]
    })
  }, [alerts, allVisibleSelected])

  const clearFilters = useCallback(() => {
    setUnreadOnly(false)
    setSeverityFilter('all')
    setTypeFilter('all')
  }, [])

  const toggleReasoning = useCallback((alertId: string) => {
    setExpandedIds((current) =>
      current.includes(alertId) ? current.filter((id) => id !== alertId) : [...current, alertId],
    )
  }, [])

  const removeFeedback = useCallback(
    async (alert: AlertRow) => {
      if (!session?.user) return
      const merchantCanonical = toFeedbackMerchantCanonical(alert.merchant_normalized)
      const feedbackKey = toAlertFeedbackKey(alert.alert_type, merchantCanonical)
      setUpdatingId(alert.id)
      setError('')

      const { error: deleteError } = await supabase
        .from('alert_feedback')
        .delete()
        .eq('user_id', session.user.id)
        .eq('alert_type', alert.alert_type)
        .eq('merchant_canonical', merchantCanonical)

      if (deleteError) {
        captureException(deleteError, {
          component: 'Alerts',
          action: 'remove-feedback',
          alert_id: alert.id,
        })
        setError('Could not remove feedback.')
        setUpdatingId('')
        return
      }

      setFeedbackByKey((current) => {
        const next = { ...current }
        delete next[feedbackKey]
        return next
      })
      setUpdatingId('')
    },
    [session?.user],
  )

  const submitFeedback = useCallback(
    async (alert: AlertRow, isExpected: boolean) => {
      if (!session?.user) return
      const merchantCanonical = toFeedbackMerchantCanonical(alert.merchant_normalized)
      const feedbackKey = toAlertFeedbackKey(alert.alert_type, merchantCanonical)
      const existingFeedback = feedbackByKey[feedbackKey]

      if (existingFeedback && existingFeedback.isExpected === isExpected) {
        await removeFeedback(alert)
        return
      }

      setUpdatingId(alert.id)
      setError('')

      const createdAt = new Date().toISOString()
      const { error: feedbackError } = await supabase.from('alert_feedback').upsert(
        {
          user_id: session.user.id,
          alert_type: alert.alert_type,
          merchant_canonical: merchantCanonical,
          is_expected: isExpected,
          created_at: createdAt,
        },
        { onConflict: 'user_id,alert_type,merchant_canonical' },
      )

      if (feedbackError) {
        captureException(feedbackError, {
          component: 'Alerts',
          action: isExpected ? 'feedback-expected' : 'feedback-false-positive',
          alert_id: alert.id,
        })
        setError('Could not save feedback.')
        setUpdatingId('')
        return
      }

      setFeedbackByKey((current) => ({
        ...current,
        [feedbackKey]: { isExpected, createdAt },
      }))
      setUpdatingId('')
    },
    [feedbackByKey, removeFeedback, session?.user],
  )

  const runBulkMarkRead = useCallback(async () => {
    if (!session?.user || selectedIds.length === 0) return
    setBulkUpdating('read')
    setError('')
    const readAt = new Date().toISOString()
    const targetIds = [...selectedIds]

    const { error: updateError } = await supabase
      .from('alerts')
      .update({ read_at: readAt })
      .eq('user_id', session.user.id)
      .in('id', targetIds)

    if (updateError) {
      captureException(updateError, { component: 'Alerts', action: 'bulk-mark-read' })
      setError('Could not mark selected alerts as read.')
      setBulkUpdating('')
      return
    }

    setAlerts((current) =>
      current.map((row) => (targetIds.includes(row.id) ? { ...row, read_at: readAt } : row)),
    )
    setSelectedIds([])
    void loadAlerts()
    setBulkUpdating('')
  }, [loadAlerts, selectedIds, session?.user])

  const runBulkDismiss = useCallback(async () => {
    if (!session?.user || selectedIds.length === 0) return
    setBulkUpdating('dismiss')
    setError('')
    const targetIds = [...selectedIds]

    const { error: updateError } = await supabase
      .from('alerts')
      .update({ is_dismissed: true })
      .eq('user_id', session.user.id)
      .in('id', targetIds)

    if (updateError) {
      captureException(updateError, { component: 'Alerts', action: 'bulk-dismiss' })
      setError('Could not dismiss selected alerts.')
      setBulkUpdating('')
      return
    }

    setAlerts((current) => current.filter((row) => !targetIds.includes(row.id)))
    setSelectedIds([])
    void loadAlerts()
    setBulkUpdating('')
  }, [loadAlerts, selectedIds, session?.user])

  return {
    alerts,
    fetching,
    error,
    updatingId,
    bulkUpdating,
    unreadOnly,
    setUnreadOnly,
    severityFilter,
    setSeverityFilter,
    typeFilter,
    setTypeFilter,
    selectedIds,
    selectedIdSet,
    expandedIds,
    feedbackByKey,
    allVisibleSelected,
    markRead,
    dismissAlert,
    toggleSelectAlert,
    toggleSelectVisible,
    clearFilters,
    toggleReasoning,
    getFeedbackKeyForAlert,
    removeFeedback,
    submitFeedback,
    runBulkMarkRead,
    runBulkDismiss,
  }
}
