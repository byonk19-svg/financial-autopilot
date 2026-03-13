import type { DensityMode } from '@/lib/subscriptionFormatters'
import type {
  OwnerValue,
  SubscriptionClassification,
  SubscriptionHistoryRow,
  SubscriptionRecord,
} from '@/lib/types'
import { fetchFunctionWithAuth } from '@/lib/fetchWithAuth'

export type GroupedRecurringResponse = {
  ok: boolean
  grouped: Record<SubscriptionClassification, SubscriptionRecord[]>
}

export type SubscriptionHistoryResponse = {
  ok: boolean
  history: SubscriptionHistoryRow[]
  daily_totals?: Record<string, number>
}

export type CadenceFilter = 'all' | 'weekly' | 'monthly' | 'annual'

export const DENSITY_STORAGE_KEY = 'subscriptions_density'
export const ENABLE_RERUN_DETECTION = import.meta.env.VITE_ENABLE_RERUN_DETECTION === 'true'
export const DENSITY_LABELS: Record<DensityMode, string> = {
  comfortable: 'Comfortable',
  compact: 'Compact',
}

export function normalizeClassification(value: string): SubscriptionClassification {
  if (value === 'subscription') return 'subscription'
  if (value === 'bill_loan') return 'bill_loan'
  if (value === 'transfer') return 'transfer'
  if (value === 'ignore') return 'ignore'
  return 'needs_review'
}

export function normalizePayer(value: string | undefined): OwnerValue {
  if (value === 'brianna' || value === 'elaine' || value === 'household') {
    return value
  }
  return 'unknown'
}

export async function fetchRecurringPatterns(): Promise<SubscriptionRecord[]> {
  const response = await fetchFunctionWithAuth('recurring', {
    method: 'GET',
  })

  const payload = (await response.json().catch(() => ({}))) as
    | GroupedRecurringResponse
    | { error?: string }

  if (!response.ok) {
    throw new Error((payload as { error?: string }).error ?? 'Could not load recurring patterns.')
  }

  const grouped = (payload as GroupedRecurringResponse).grouped
  const orderedClasses: SubscriptionClassification[] = [
    'subscription',
    'bill_loan',
    'needs_review',
    'transfer',
    'ignore',
  ]

  return orderedClasses.flatMap((classification) =>
    (grouped?.[classification] ?? []).map((row) => ({
      ...row,
      classification: normalizeClassification(row.classification ?? 'needs_review'),
      is_false_positive: row.is_false_positive === true,
      user_locked: row.user_locked === true,
      is_active: true,
      primary_payer: normalizePayer(row.primary_payer),
    })),
  )
}

export async function classifyRecurringPattern(
  subscriptionId: string,
  body: { classification: SubscriptionClassification; lock?: boolean; createRule?: boolean },
) {
  const response = await fetchFunctionWithAuth(`recurring/${subscriptionId}/classify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  const payload = (await response.json().catch(() => ({}))) as {
    error?: string
    recurring?: Partial<SubscriptionRecord>
  }

  if (!response.ok) {
    throw new Error(payload.error ?? 'Could not classify recurring pattern.')
  }

  return payload.recurring ?? null
}

export async function fetchSubscriptionHistory(
  subscriptionId: string,
  limit: number,
): Promise<SubscriptionHistoryResponse> {
  const response = await fetchFunctionWithAuth(
    `recurring/${subscriptionId}/history?limit=${Math.max(6, Math.min(48, limit))}`,
    {
      method: 'GET',
    },
  )

  const payload = (await response.json().catch(() => ({}))) as
    | SubscriptionHistoryResponse
    | { error?: string }

  if (!response.ok) {
    throw new Error(
      (payload as { error?: string }).error ?? 'Could not load subscription transaction history.',
    )
  }

  return payload as SubscriptionHistoryResponse
}

export async function rerunRecurringAnalysis(): Promise<void> {
  const response = await fetchFunctionWithAuth('analysis-daily', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  })

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string; detail?: string }
    throw new Error(payload.detail ?? payload.error ?? 'Could not re-run detection from this environment.')
  }
}
