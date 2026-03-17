import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  captureException: vi.fn(),
  fetchFunctionWithAuth: vi.fn(),
  rpc: vi.fn(),
  from: vi.fn(),
}))

vi.mock('@/lib/errorReporting', () => ({
  captureException: mocks.captureException,
}))

vi.mock('@/lib/fetchWithAuth', () => ({
  fetchFunctionWithAuth: mocks.fetchFunctionWithAuth,
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: mocks.rpc,
    from: mocks.from,
  },
}))

import {
  applyCategoryAndCreateRules,
  applyCategoryToSimilarTransactions,
  hideTransactionsEverywhere,
} from './useTransactions.followUp'
import type { CategoryFollowUpPromptState, TransactionRow } from '@/lib/types'

function makePrompt(): CategoryFollowUpPromptState {
  return {
    transactionId: 'txn-1',
    merchantCanonical: 'CLAUDE AI',
    accountId: 'acct-1',
    categoryId: 'cat-1',
    categoryName: 'Streaming & Apps',
    includeAccountScope: false,
    pendingAction: null,
  }
}

function makeTransaction(): TransactionRow {
  return {
    id: 'txn-1',
    account_id: 'acct-1',
    category_id: null,
    user_category_id: null,
    type: 'expense',
    owner: 'household',
    posted_at: '2026-03-17T00:00:00.000Z',
    merchant_canonical: 'CLAUDE AI',
    merchant_normalized: 'CLAUDE AI',
    description_short: 'Claude subscription',
    amount: -20,
    currency: 'USD',
    is_pending: false,
  }
}

describe('useTransactions.followUp helpers', () => {
  beforeEach(() => {
    mocks.captureException.mockReset()
    mocks.fetchFunctionWithAuth.mockReset()
    mocks.rpc.mockReset()
    mocks.from.mockReset()
  })

  it('throws when applying a category to similar transactions fails', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: new Error('rpc failed') })

    await expect(applyCategoryToSimilarTransactions(makePrompt())).rejects.toThrow('rpc failed')
    expect(mocks.captureException).toHaveBeenCalledTimes(1)
  })

  it('returns warning text when the sync-time rule save fails but still triggers background analysis', async () => {
    const transactionRulesInsert = vi.fn().mockResolvedValue({ error: null })
    const categoryRulesInsert = vi.fn().mockResolvedValue({ error: { message: 'write failed' } })
    const ownerRulesInsert = vi.fn().mockResolvedValue({ error: null })

    mocks.rpc.mockResolvedValue({ data: 4, error: null })
    mocks.from.mockImplementation((table: string) => {
      if (table === 'transaction_rules') return { insert: transactionRulesInsert }
      if (table === 'transaction_category_rules_v1') return { insert: categoryRulesInsert }
      if (table === 'transaction_owner_rules_v1') return { insert: ownerRulesInsert }
      throw new Error(`Unexpected table: ${table}`)
    })
    mocks.fetchFunctionWithAuth.mockResolvedValue(new Response('{}', { status: 200 }))

    const result = await applyCategoryAndCreateRules({
      prompt: makePrompt(),
      sourceTransaction: makeTransaction(),
      userId: 'user-1',
    })

    expect(result.updatedCount).toBe(4)
    expect(result.syncRuleWarning).toContain('Sync-time rule save failed')
    expect(result.ownerRuleWarning).toBe('')
    expect(mocks.fetchFunctionWithAuth).toHaveBeenCalledWith(
      'analysis-daily',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(mocks.captureException).toHaveBeenCalledTimes(1)
  })

  it('hides similar transactions and schedules background analysis after saving the future hide rule', async () => {
    const transactionRulesInsert = vi.fn().mockResolvedValue({ error: null })
    mocks.rpc.mockResolvedValue({ data: 7, error: null })
    mocks.from.mockImplementation((table: string) => {
      if (table === 'transaction_rules') return { insert: transactionRulesInsert }
      throw new Error(`Unexpected table: ${table}`)
    })
    mocks.fetchFunctionWithAuth.mockResolvedValue(new Response('{}', { status: 200 }))

    const hiddenCount = await hideTransactionsEverywhere({
      hideFollowUp: {
        transactionId: 'txn-1',
        merchantCanonical: 'CLAUDE AI',
        accountId: 'acct-1',
        includeAccountScope: false,
        pending: false,
      },
      userId: 'user-1',
    })

    expect(hiddenCount).toBe(7)
    expect(transactionRulesInsert).toHaveBeenCalledTimes(1)
    expect(mocks.fetchFunctionWithAuth).toHaveBeenCalledWith(
      'analysis-daily',
      expect.objectContaining({ method: 'POST' }),
    )
  })
})
