import { inferRecurringClassificationFromCategory } from '@/lib/categoryRules'
import { captureException } from '@/lib/errorReporting'
import { fetchFunctionWithAuth } from '@/lib/fetchWithAuth'
import { supabase } from '@/lib/supabase'
import {
  detectCanonicalMerchant,
  isDuplicateAutoRuleError,
  isDuplicateOwnerAutoRuleError,
  isOwnerRuleTarget,
} from '@/hooks/useTransactions.helpers'
import type {
  CategoryFollowUpPromptState,
  HideFollowUpState,
  TransactionRow,
} from '@/lib/types'

export async function applyCategoryToSimilarTransactions(
  prompt: CategoryFollowUpPromptState,
): Promise<number> {
  const { data, error } = await supabase.rpc('apply_category_to_similar', {
    merchant_canonical: prompt.merchantCanonical,
    account_id: prompt.includeAccountScope ? prompt.accountId : null,
    category_id: prompt.categoryId,
    lookback_days: 365,
  })

  if (error) {
    captureException(error, {
      component: 'Transactions',
      action: 'apply-category-to-similar',
      transaction_id: prompt.transactionId,
    })
    throw error
  }

  return Number(data ?? 0)
}

export async function applyCategoryAndCreateRules(params: {
  prompt: CategoryFollowUpPromptState
  sourceTransaction: TransactionRow | null
  userId: string
}): Promise<{
  ownerRuleWarning: string
  syncRuleWarning: string
  updatedCount: number
}> {
  const { prompt, sourceTransaction, userId } = params
  const merchantPattern = prompt.merchantCanonical.trim()

  const [applyResult, ruleResult] = await Promise.all([
    supabase.rpc('apply_category_to_similar', {
      merchant_canonical: prompt.merchantCanonical,
      account_id: prompt.includeAccountScope ? prompt.accountId : null,
      category_id: prompt.categoryId,
      lookback_days: 365,
    }),
    supabase.from('transaction_rules').insert({
      user_id: userId,
      name: `Auto category: ${prompt.merchantCanonical}`,
      pattern: prompt.merchantCanonical,
      match_type: 'contains',
      account_id: prompt.includeAccountScope ? prompt.accountId : null,
      set_spending_category_id: prompt.categoryId,
      set_pattern_classification: inferRecurringClassificationFromCategory(prompt.categoryName),
      explanation: `Created from manual category edit on transaction ${prompt.transactionId}.`,
      priority: 40,
      is_active: true,
    }),
  ])

  if (applyResult.error || ruleResult.error) {
    const error = applyResult.error ?? ruleResult.error
    captureException(error, {
      component: 'Transactions',
      action: 'apply-and-create-rule',
      transaction_id: prompt.transactionId,
    })
    throw error
  }

  let syncRuleWarning = ''
  let ownerRuleWarning = ''

  if (merchantPattern.length > 0) {
    const syncRuleType = prompt.includeAccountScope ? 'merchant_contains_account' : 'merchant_contains'
    const { error: syncRuleError } = await supabase.from('transaction_category_rules_v1').insert({
      user_id: userId,
      rule_type: syncRuleType,
      merchant_pattern: merchantPattern,
      account_id: prompt.includeAccountScope ? prompt.accountId : null,
      min_amount: null,
      max_amount: null,
      category_id: prompt.categoryId,
      is_active: true,
    })

    if (syncRuleError && !isDuplicateAutoRuleError(syncRuleError)) {
      captureException(syncRuleError, {
        component: 'Transactions',
        action: 'create-sync-time-category-rule',
        transaction_id: prompt.transactionId,
      })
      syncRuleWarning = ' Sync-time rule save failed; check Auto Rules.'
    }

    if (sourceTransaction && isOwnerRuleTarget(sourceTransaction.owner)) {
      const { error: ownerRuleError } = await supabase.from('transaction_owner_rules_v1').insert({
        user_id: userId,
        rule_type: syncRuleType,
        merchant_pattern: merchantPattern,
        account_id: prompt.includeAccountScope ? prompt.accountId : null,
        min_amount: null,
        max_amount: null,
        set_owner: sourceTransaction.owner,
        is_active: true,
      })

      if (ownerRuleError && !isDuplicateOwnerAutoRuleError(ownerRuleError)) {
        captureException(ownerRuleError, {
          component: 'Transactions',
          action: 'create-sync-time-owner-rule',
          transaction_id: prompt.transactionId,
        })
        ownerRuleWarning = ' Owner auto-rule save failed; check Auto Rules.'
      }
    }
  } else {
    syncRuleWarning = ' Sync-time rule skipped (missing merchant pattern).'
  }

  runAnalysisInBackground('auto-run-analysis-after-rule')

  return {
    ownerRuleWarning,
    syncRuleWarning,
    updatedCount: Number(applyResult.data ?? 0),
  }
}

export async function hideTransactionAndBuildFollowUp(params: {
  transaction: TransactionRow
  userId: string
}): Promise<HideFollowUpState> {
  const { transaction, userId } = params
  const { error } = await supabase
    .from('transactions')
    .update({ is_hidden: true })
    .eq('id', transaction.id)
    .eq('user_id', userId)

  if (error) {
    captureException(error, { component: 'Transactions', action: 'hide-transaction' })
    throw error
  }

  return {
    transactionId: transaction.id,
    merchantCanonical: detectCanonicalMerchant(transaction),
    accountId: transaction.account_id,
    includeAccountScope: false,
    pending: false,
  }
}

export async function hideTransactionsEverywhere(params: {
  hideFollowUp: HideFollowUpState
  userId: string
}): Promise<number> {
  const { hideFollowUp, userId } = params

  const [hideResult, ruleResult] = await Promise.all([
    supabase.rpc('hide_similar_transactions', {
      merchant_canonical: hideFollowUp.merchantCanonical,
      account_id: hideFollowUp.includeAccountScope ? hideFollowUp.accountId : null,
      lookback_days: 365,
    }),
    supabase.from('transaction_rules').insert({
      user_id: userId,
      name: `Hide: ${hideFollowUp.merchantCanonical}`,
      pattern: hideFollowUp.merchantCanonical,
      match_type: 'contains',
      account_id: hideFollowUp.includeAccountScope ? hideFollowUp.accountId : null,
      set_is_hidden: true,
      explanation: `Created from hide action on transaction ${hideFollowUp.transactionId}.`,
      priority: 10,
      is_active: true,
    }),
  ])

  if (hideResult.error || ruleResult.error) {
    const error = hideResult.error ?? ruleResult.error
    captureException(error, { component: 'Transactions', action: 'hide-everywhere' })
    throw error
  }

  runAnalysisInBackground('auto-run-analysis-after-hide')
  return Number(hideResult.data ?? 0)
}

function runAnalysisInBackground(action: string): void {
  fetchFunctionWithAuth('analysis-daily', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  }).catch((error) => {
    captureException(error, {
      component: 'Transactions',
      action,
    })
  })
}
