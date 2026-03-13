import { useCallback } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { SubscriptionRecord } from '@/lib/types'
import { captureException } from '@/lib/errorReporting'
import { supabase } from '@/lib/supabase'
import { ENABLE_RERUN_DETECTION, rerunRecurringAnalysis } from '@/hooks/useSubscriptions.shared'

type SubscriptionMerchantActionsParams = {
  loadSubscriptions: () => Promise<void>
  setProcessingId: Dispatch<SetStateAction<string>>
  setSharedError: Dispatch<SetStateAction<string>>
  setSubscriptions: Dispatch<SetStateAction<SubscriptionRecord[]>>
  userId: string | undefined
}

export function useSubscriptionMerchantActions(params: SubscriptionMerchantActionsParams) {
  const { loadSubscriptions, setProcessingId, setSharedError, setSubscriptions, userId } = params

  const renameMerchant = useCallback(
    async (subscription: SubscriptionRecord, nextMerchant: string) => {
      if (!userId) return

      const normalizedTarget = nextMerchant.trim().toUpperCase()
      if (!normalizedTarget) {
        setSharedError('Merchant name is required.')
        return
      }

      if (normalizedTarget === subscription.merchant_normalized) return

      setProcessingId(subscription.id)
      setSharedError('')
      let previousState: SubscriptionRecord[] = []
      setSubscriptions((current) => {
        previousState = current
        return current.map((row) =>
          row.id === subscription.id
            ? {
                ...row,
                merchant_normalized: normalizedTarget,
              }
            : row,
        )
      })

      try {
        const { error: subscriptionUpdateError } = await supabase
          .from('subscriptions')
          .update({ merchant_normalized: normalizedTarget })
          .eq('id', subscription.id)
          .eq('user_id', userId)

        if (subscriptionUpdateError) throw subscriptionUpdateError

        const pattern = subscription.merchant_normalized
        const { data: existingAlias, error: lookupError } = await supabase
          .from('merchant_aliases')
          .select('id')
          .eq('user_id', userId)
          .is('account_id', null)
          .eq('pattern', pattern)
          .maybeSingle()

        if (lookupError) throw lookupError

        if (existingAlias?.id) {
          const { error: updateError } = await supabase
            .from('merchant_aliases')
            .update({
              normalized: normalizedTarget,
              is_active: true,
            })
            .eq('id', existingAlias.id)
            .eq('user_id', userId)

          if (updateError) throw updateError
        } else {
          const { error: insertError } = await supabase.from('merchant_aliases').insert({
            user_id: userId,
            pattern,
            normalized: normalizedTarget,
            match_type: 'contains',
            priority: 50,
            account_id: null,
            is_active: true,
          })

          if (insertError) throw insertError
        }

        if (ENABLE_RERUN_DETECTION) {
          try {
            await rerunRecurringAnalysis()
          } catch {
            setSharedError('Rename saved, but analysis re-run failed. Use Re-run detection.')
          }
        }

        await loadSubscriptions()
      } catch (renameError) {
        setSubscriptions(previousState)
        captureException(renameError, {
          component: 'useSubscriptions',
          action: 'rename-merchant',
          subscription_id: subscription.id,
          merchant_normalized: subscription.merchant_normalized,
          next_merchant: normalizedTarget,
        })
        setSharedError('Could not save merchant rename.')
      } finally {
        setProcessingId('')
      }
    },
    [loadSubscriptions, setProcessingId, setSharedError, setSubscriptions, userId],
  )

  const createWebIdSplitAliases = useCallback(
    async (subscription: SubscriptionRecord, splits: Array<{ webId: string; normalized: string }>) => {
      if (!userId) return

      const normalizedSplits = splits
        .map((row) => ({
          webId: row.webId.trim(),
          normalized: row.normalized.trim().toUpperCase(),
        }))
        .filter((row) => row.webId.length > 0 && row.normalized.length > 0)

      if (normalizedSplits.length < 2) {
        setSharedError('Need at least two WEB ID mappings to split this merchant.')
        return
      }

      setProcessingId(subscription.id)
      setSharedError('')

      try {
        for (const split of normalizedSplits) {
          const pattern = `\\bweb\\s+id\\s+${split.webId}\\b`
          const { data: existingAlias, error: lookupError } = await supabase
            .from('merchant_aliases')
            .select('id')
            .eq('user_id', userId)
            .is('account_id', null)
            .eq('pattern', pattern)
            .maybeSingle()

          if (lookupError) throw lookupError

          if (existingAlias?.id) {
            const { error: updateError } = await supabase
              .from('merchant_aliases')
              .update({
                normalized: split.normalized,
                match_type: 'regex',
                priority: 20,
                is_active: true,
              })
              .eq('id', existingAlias.id)
              .eq('user_id', userId)

            if (updateError) throw updateError
          } else {
            const { error: insertError } = await supabase.from('merchant_aliases').insert({
              user_id: userId,
              pattern,
              normalized: split.normalized,
              match_type: 'regex',
              priority: 20,
              account_id: null,
              is_active: true,
            })

            if (insertError) throw insertError
          }
        }

        if (ENABLE_RERUN_DETECTION) {
          try {
            await rerunRecurringAnalysis()
          } catch {
            setSharedError('Split rules saved, but analysis re-run failed. Use Re-run detection.')
          }
        }

        await loadSubscriptions()
      } catch (splitError) {
        captureException(splitError, {
          component: 'useSubscriptions',
          action: 'create-webid-split-aliases',
          subscription_id: subscription.id,
          merchant_normalized: subscription.merchant_normalized,
        })
        setSharedError('Could not create WEB ID split rules.')
      } finally {
        setProcessingId('')
      }
    },
    [loadSubscriptions, setProcessingId, setSharedError, userId],
  )

  const createAmountSplitRules = useCallback(
    async (subscription: SubscriptionRecord, splits: Array<{ amount: number; normalized: string }>) => {
      if (!userId) return

      const normalizedSplits = splits
        .map((row) => ({
          amount: Number(row.amount),
          normalized: row.normalized.trim().toUpperCase(),
        }))
        .filter((row) => Number.isFinite(row.amount) && row.amount > 0 && row.normalized.length > 0)

      if (normalizedSplits.length < 2) {
        setSharedError('Need at least two amount mappings to split this merchant.')
        return
      }

      setProcessingId(subscription.id)
      setSharedError('')

      try {
        const pattern = subscription.merchant_normalized.toLowerCase()
        for (const split of normalizedSplits) {
          const minAmount = Number((split.amount - 1).toFixed(2))
          const maxAmount = Number((split.amount + 1).toFixed(2))
          const ruleName = `Auto split ${subscription.merchant_normalized} ${split.amount.toFixed(2)}`
          const priority = split.amount <= Math.min(...normalizedSplits.map((row) => row.amount)) ? 20 : 21

          const { data: existingRule, error: lookupError } = await supabase
            .from('transaction_rules')
            .select('id')
            .eq('user_id', userId)
            .eq('name', ruleName)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()

          if (lookupError) throw lookupError

          if (existingRule?.id) {
            const { error: updateError } = await supabase
              .from('transaction_rules')
              .update({
                match_type: 'contains',
                pattern,
                min_amount: minAmount,
                max_amount: maxAmount,
                set_merchant_normalized: split.normalized,
                set_pattern_classification: 'transfer',
                priority,
                is_active: true,
              })
              .eq('id', existingRule.id)
              .eq('user_id', userId)

            if (updateError) throw updateError
          } else {
            const { error: insertError } = await supabase.from('transaction_rules').insert({
              user_id: userId,
              name: ruleName,
              match_type: 'contains',
              pattern,
              min_amount: minAmount,
              max_amount: maxAmount,
              set_merchant_normalized: split.normalized,
              set_pattern_classification: 'transfer',
              priority,
              is_active: true,
            })

            if (insertError) throw insertError
          }
        }

        if (ENABLE_RERUN_DETECTION) {
          try {
            await rerunRecurringAnalysis()
          } catch {
            setSharedError('Split rules saved, but analysis re-run failed. Use Re-run detection.')
          }
        }

        await loadSubscriptions()
      } catch (splitError) {
        captureException(splitError, {
          component: 'useSubscriptions',
          action: 'create-amount-split-rules',
          subscription_id: subscription.id,
          merchant_normalized: subscription.merchant_normalized,
        })
        setSharedError('Could not create amount split rules.')
      } finally {
        setProcessingId('')
      }
    },
    [loadSubscriptions, setProcessingId, setSharedError, userId],
  )

  return {
    renameMerchant,
    createWebIdSplitAliases,
    createAmountSplitRules,
  }
}
