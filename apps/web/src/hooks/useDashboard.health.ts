import { useCallback, useState } from 'react'
import { captureException } from '@/lib/errorReporting'
import { AuthExpiredError, fetchFunctionWithAuth } from '@/lib/fetchWithAuth'
import type { SystemHealthPayload } from '@/hooks/useDashboard.shared'

export function useDashboardHealth() {
  const [systemHealth, setSystemHealth] = useState<SystemHealthPayload | null>(null)
  const [healthLoading, setHealthLoading] = useState(false)
  const [healthError, setHealthError] = useState('')
  const [sessionExpired, setSessionExpired] = useState(false)

  const loadSystemHealth = useCallback(async () => {
    setHealthLoading(true)
    setHealthError('')

    try {
      const response = await fetchFunctionWithAuth('system-health', {
        method: 'GET',
      })

      const payload = (await response.json().catch(() => null)) as
        | { error?: string; detail?: string; ok?: boolean }
        | SystemHealthPayload
        | null

      if (!response.ok) {
        throw new Error(
          payload && typeof payload === 'object' && ('detail' in payload || 'error' in payload)
            ? (payload.detail ?? payload.error ?? 'Could not load system health.')
            : 'Could not load system health.',
        )
      }

      const health = (payload ?? null) as SystemHealthPayload | null
      if (!health || health.ok !== true) {
        throw new Error('Could not load system health.')
      }

      setSystemHealth(health)
    } catch (healthLoadError) {
      if (healthLoadError instanceof AuthExpiredError) {
        setSessionExpired(true)
      }
      captureException(healthLoadError, {
        component: 'useDashboard',
        action: 'load-system-health',
      })
      const detail =
        healthLoadError instanceof Error ? healthLoadError.message : 'Could not load system health.'
      setHealthError(detail)
    } finally {
      setHealthLoading(false)
    }
  }, [])

  return {
    systemHealth,
    healthLoading,
    healthError,
    healthSessionExpired: sessionExpired,
    loadSystemHealth,
  }
}
