import { useCallback, useEffect, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { DensityMode } from '@/lib/subscriptionFormatters'
import type { SubscriptionRecord } from '@/lib/types'
import { captureException } from '@/lib/errorReporting'
import { useSubscriptionClassificationActions } from '@/hooks/useSubscriptionClassificationActions'
import { useSubscriptionMerchantActions } from '@/hooks/useSubscriptionMerchantActions'
import {
  DENSITY_STORAGE_KEY,
  ENABLE_RERUN_DETECTION,
  rerunRecurringAnalysis,
} from '@/hooks/useSubscriptions.shared'

type SubscriptionActionsParams = {
  loadSubscriptions: () => Promise<void>
  setSharedError: Dispatch<SetStateAction<string>>
  setSubscriptions: Dispatch<SetStateAction<SubscriptionRecord[]>>
  userId: string | undefined
}

export function useSubscriptionActions(params: SubscriptionActionsParams) {
  const { loadSubscriptions, setSharedError, setSubscriptions, userId } = params

  const [processingId, setProcessingId] = useState('')
  const [rerunningDetection, setRerunningDetection] = useState(false)
  const [density, setDensity] = useState<DensityMode>(() => {
    if (typeof window === 'undefined') return 'comfortable'
    const savedDensity = window.localStorage.getItem(DENSITY_STORAGE_KEY)
    return savedDensity === 'compact' ? 'compact' : 'comfortable'
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(DENSITY_STORAGE_KEY, density)
  }, [density])

  const classificationActions = useSubscriptionClassificationActions({
    loadSubscriptions,
    setProcessingId,
    setSharedError,
    setSubscriptions,
    userId,
  })

  const merchantActions = useSubscriptionMerchantActions({
    loadSubscriptions,
    setProcessingId,
    setSharedError,
    setSubscriptions,
    userId,
  })

  const rerunDetection = useCallback(async () => {
    if (!ENABLE_RERUN_DETECTION) return
    setRerunningDetection(true)
    setSharedError('')

    try {
      await rerunRecurringAnalysis()
      await loadSubscriptions()
    } catch (rerunError) {
      captureException(rerunError, {
        component: 'useSubscriptions',
        action: 'rerun-detection',
      })
      setSharedError('Could not re-run detection from this environment.')
    } finally {
      setRerunningDetection(false)
    }
  }, [loadSubscriptions, setSharedError])

  return {
    processingId,
    rerunningDetection,
    density,
    setDensity,
    ...classificationActions,
    ...merchantActions,
    rerunDetection,
  }
}
