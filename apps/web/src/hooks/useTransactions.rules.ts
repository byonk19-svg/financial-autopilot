import { captureException } from '@/lib/errorReporting'
import { supabase } from '@/lib/supabase'
import { detectCanonicalMerchant } from '@/hooks/useTransactions.helpers'
import type { CreateRuleFormState, TransactionRow } from '@/lib/types'

export function buildRuleFormFromTransaction(transaction: TransactionRow): CreateRuleFormState {
  const effectiveCategoryId = transaction.user_category_id ?? transaction.category_id ?? ''

  return {
    canonicalMerchant: detectCanonicalMerchant(transaction),
    matchType: 'equals',
    constrainToAccount: false,
    categoryId: effectiveCategoryId,
    applyScope: 'past_90_days',
  }
}

export function validateRuleForm(
  ruleForm: CreateRuleFormState,
): string | null {
  const canonicalMerchant = ruleForm.canonicalMerchant.trim()
  if (!canonicalMerchant) {
    return 'Merchant value is required.'
  }

  if (!ruleForm.categoryId) {
    return 'Choose a category before creating the rule.'
  }

  return null
}

export async function createRuleFromTransactionAction(params: {
  ruleForm: CreateRuleFormState
  ruleModalTransaction: TransactionRow
  userId: string
}): Promise<number> {
  const { ruleForm, ruleModalTransaction, userId } = params
  const canonicalMerchant = ruleForm.canonicalMerchant.trim()

  const { data: insertedRule, error: insertRuleError } = await supabase
    .from('transaction_rules')
    .insert({
      user_id: userId,
      name: `Rule: ${canonicalMerchant}`,
      pattern: canonicalMerchant,
      match_type: ruleForm.matchType,
      account_id: ruleForm.constrainToAccount ? ruleModalTransaction.account_id : null,
      set_spending_category_id: ruleForm.categoryId,
      explanation: `Created from transaction ${ruleModalTransaction.id}.`,
      priority: 50,
      is_active: true,
    })
    .select('id')
    .single()

  if (insertRuleError || !insertedRule?.id) {
    captureException(insertRuleError ?? new Error('Missing inserted rule id'), {
      component: 'Transactions',
      action: 'create-rule-from-transaction',
      transaction_id: ruleModalTransaction.id,
    })
    throw new Error('Could not create rule.')
  }

  const { data: updatedCount, error: applyRuleError } = await supabase.rpc('apply_rule', {
    rule_id: insertedRule.id,
    scope: ruleForm.applyScope,
  })

  if (applyRuleError) {
    captureException(applyRuleError, {
      component: 'Transactions',
      action: 'apply-created-rule',
      transaction_id: ruleModalTransaction.id,
      rule_id: insertedRule.id,
    })
    throw new Error('Rule was created, but applying it failed.')
  }

  return Number(updatedCount ?? 0)
}
