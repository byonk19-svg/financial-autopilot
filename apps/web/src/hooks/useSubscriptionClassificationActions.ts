import { useCallback } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { SubscriptionClassification, SubscriptionRecord } from '@/lib/types'
import { captureException } from '@/lib/errorReporting'
import { supabase } from '@/lib/supabase'
import {
  classifyRecurringPattern,
  normalizeClassification,
  rerunRecurringAnalysis,
} from '@/hooks/useSubscriptions.shared'

type SubscriptionClassificationActionsParams = {
  loadSubscriptions: () => Promise<void>
  setProcessingId: Dispatch<SetStateAction<string>>
  setSharedError: Dispatch<SetStateAction<string>>
  setSubscriptions: Dispatch<SetStateAction<SubscriptionRecord[]>>
  userId: string | undefined
}

export function useSubscriptionClassificationActions(
  params: SubscriptionClassificationActionsParams,
) {
  const { loadSubscriptions, setProcessingId, setSharedError, setSubscriptions, userId } = params

  const markInactive = useCallback(async (subscription: SubscriptionRecord) => {
    if (!userId) return
    setProcessingId(subscription.id)
    setSharedError('')

    const { error: updateError } = await supabase
      .from('subscriptions')
      .update({ is_active: false })
      .eq('id', subscription.id)
      .eq('user_id', userId)

    if (updateError) {
      setSharedError('Could not mark subscription inactive.')
      setProcessingId('')
      return
    }

    setSubscriptions((current) => current.filter((row) => row.id !== subscription.id))
    setProcessingId('')
  }, [setProcessingId, setSharedError, setSubscriptions, userId])

  const markFalsePositive = useCallback(
    async (subscription: SubscriptionRecord, rerunAfterMark = false) => {
      if (!userId) return
      setProcessingId(subscription.id)
      setSharedError('')

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
        setSharedError('Could not mark this as not a subscription.')
        setProcessingId('')
        return
      }

      if (rerunAfterMark) {
        try {
          await rerunRecurringAnalysis()
          await loadSubscriptions()
        } catch (rerunError) {
          captureException(rerunError, {
            component: 'useSubscriptions',
            action: 'rerun-after-false-positive',
            subscription_id: subscription.id,
          })
          setSharedError(
            rerunError instanceof Error
              ? `Saved as false positive, but ${rerunError.message.toLowerCase()}`
              : 'Saved as false positive, but could not re-run analysis.',
          )
        }
      }

      setProcessingId('')
    },
    [loadSubscriptions, setProcessingId, setSharedError, setSubscriptions, userId],
  )

  const updateNotifyDaysBefore = useCallback(
    async (subscription: SubscriptionRecord, notifyDaysBefore: number | null) => {
      if (!userId) return
      setProcessingId(subscription.id)
      setSharedError('')

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
        setSharedError('Could not update reminder window.')
      }

      setProcessingId('')
    },
    [setProcessingId, setSharedError, setSubscriptions, userId],
  )

  const setClassification = useCallback(
    async (
      subscription: SubscriptionRecord,
      classification: SubscriptionClassification,
      createRule: boolean,
    ) => {
      if (!userId) return
      setProcessingId(subscription.id)
      setSharedError('')

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
        const recurring = await classifyRecurringPattern(subscription.id, {
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
        setSharedError(detail)
      } finally {
        setProcessingId('')
      }
    },
    [setProcessingId, setSharedError, setSubscriptions, userId],
  )

  const toggleClassificationLock = useCallback(async (subscription: SubscriptionRecord) => {
    if (!userId) return
    setProcessingId(subscription.id)
    setSharedError('')

    try {
      const nextLocked = !subscription.user_locked
      const recurring = await classifyRecurringPattern(subscription.id, {
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
      setSharedError(detail)
    } finally {
      setProcessingId('')
    }
  }, [setProcessingId, setSharedError, setSubscriptions, userId])

  const undoClassification = useCallback(async (subscription: SubscriptionRecord) => {
    if (!userId) return
    setProcessingId(subscription.id)
    setSharedError('')

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

        if (resetError) throw resetError
        setProcessingId('')
        return
      }

      const recurring = await classifyRecurringPattern(subscription.id, {
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
      setSharedError(detail)
    } finally {
      setProcessingId('')
    }
  }, [setProcessingId, setSharedError, setSubscriptions, userId])

  return {
    markInactive,
    markFalsePositive,
    updateNotifyDaysBefore,
    setClassification,
    toggleClassificationLock,
    undoClassification,
  }
}
