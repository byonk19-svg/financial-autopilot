import { useCallback, useState } from 'react'
import { captureException } from '@/lib/errorReporting'
import { AuthExpiredError, fetchFunctionWithAuth } from '@/lib/fetchWithAuth'

type DashboardSyncOptions = {
  onNeedsConnection: () => void
  onRefreshRequested: () => Promise<void>
  userId: string | undefined
}

export function useDashboardSync(options: DashboardSyncOptions) {
  const { onNeedsConnection, onRefreshRequested, userId } = options

  const [syncing, setSyncing] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [sessionExpired, setSessionExpired] = useState(false)
  const [syncNeedsReconnect, setSyncNeedsReconnect] = useState(false)

  const runSync = useCallback(
    async (syncRequestBody: Record<string, number>, action: string, successPrefix: string) => {
      if (!userId) return

      setSyncing(true)
      setMessage('')
      setError('')
      setSessionExpired(false)
      setSyncNeedsReconnect(false)

      try {
        const response = await fetchFunctionWithAuth('simplefin-sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(syncRequestBody),
        })

        const responsePayload = (await response.json().catch(() => ({}))) as {
          error?: string
          accountsSynced?: number
          transactionsSynced?: number
          warnings?: string[]
        }

        if (!response.ok) {
          throw new Error(responsePayload.error ?? 'Sync failed.')
        }

        const warnings = responsePayload.warnings ?? []
        const hasConnectionWarning = warnings.some((warning) => /decrypt|token|unauthorized/i.test(warning))
        if (hasConnectionWarning) {
          setMessage('')
          setError('Sync could not read your bank connection. Please reconnect SimpleFIN from the Connect page.')
          setSyncNeedsReconnect(true)
          onNeedsConnection()
          return
        }

        const warningText = warnings.length > 0 ? ` Warnings: ${warnings.slice(0, 2).join(' | ')}` : ''
        setMessage(
          `${successPrefix}. Accounts synced: ${responsePayload.accountsSynced ?? 0}, transactions synced: ${
            responsePayload.transactionsSynced ?? 0
          }.${warningText}`,
        )
        setSyncNeedsReconnect(false)
        await onRefreshRequested()
      } catch (syncError) {
        if (syncError instanceof AuthExpiredError) {
          setSessionExpired(true)
        }
        captureException(syncError, {
          component: 'useDashboard',
          action,
        })
        const detail = syncError instanceof Error ? syncError.message : 'Sync failed.'
        setError(detail)
        if (/decrypt|token|unauthorized|reconnect/i.test(detail)) {
          setSyncNeedsReconnect(true)
        }
      } finally {
        setSyncing(false)
      }
    },
    [onNeedsConnection, onRefreshRequested, userId],
  )

  const onSyncNow = useCallback(async () => {
    await runSync({}, 'sync-now', 'Sync complete')
  }, [runSync])

  const onRepairLast6Months = useCallback(async () => {
    await runSync(
      { backfill_months: 6, lookback_days: 60 },
      'sync-repair-last-6-months',
      'Repair complete',
    )
  }, [runSync])

  return {
    syncing,
    message,
    error,
    syncSessionExpired: sessionExpired,
    syncNeedsReconnect,
    onSyncNow,
    onRepairLast6Months,
  }
}
