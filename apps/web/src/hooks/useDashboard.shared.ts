import { toNumber } from '@/lib/subscriptionFormatters'
import type { SavingsBucketSummaryRpc, ShiftWeekSummaryRpc } from '@/lib/types'

export type DashboardKpisRpc = {
  income_mtd: number | string | null
  income_brianna: number | string | null
  income_elaine: number | string | null
  spend_mtd: number | string | null
  cash_flow_mtd: number | string | null
  spend_last_month: number | string | null
  spend_delta: number | string | null
  spend_delta_pct: number | string | null
  top_categories: Array<{
    category: string
    amount: number | string
  }>
}

export type DashboardTopCategory = {
  category: string
  amount: number
}

export type DashboardRenewalRow = {
  subscription_id: string
  merchant_normalized: string
  cadence: string
  next_expected_at: string | null
  last_amount: number | string | null
  monthly_equivalent: number | string | null
  days_until: number | null
}

export type DashboardAnomalyRow = {
  transaction_id: string
  posted_at: string
  merchant_canonical: string
  amount: number | string
  baseline_avg: number | string | null
  baseline_stddev: number | string | null
  score: number | string | null
  reason: string | null
}

export type AccountSyncRow = {
  id: string
  name: string
  institution: string | null
  last_synced_at: string | null
}

export type AccountNewestTransactionRow = {
  account_id: string
  posted_at: string | null
}

export type DashboardDataFreshnessRow = {
  accountId: string
  accountName: string
  institution: string | null
  lastSyncedAt: string | null
  newestTransactionAt: string | null
  isStale: boolean
  staleDays: number | null
}

export type HealthJobRow = {
  job_name: string
  schedule: string | null
  last_run_at: string | null
  last_status: string | null
  last_error: string | null
}

export type SystemHealthPayload = {
  ok: boolean
  generated_at: string
  latest_error: string | null
  jobs: HealthJobRow[]
}

export type DashboardAttentionCounts = {
  uncategorizedTransactions: number
  reviewSubscriptions: number
  unreadAlerts: number
  unownedAccounts: number
}

export type DashboardKpis = {
  incomeMtd: number
  incomeBrianna: number
  incomeElaine: number
  spendMtd: number
  cashFlowMtd: number
  spendLastMonth: number
  spendDelta: number
  spendDeltaPct: number | null
  topCategories: DashboardTopCategory[]
}

export type DashboardAutopilotMetrics = {
  autoCategorizedRatePct: number | null
  autoCategorizedCount30d: number
  totalEligibleCount30d: number
  uncategorizedCount7d: number
  manualFixes7d: number
}

export type DashboardOwnerKey = 'brianna' | 'elaine' | 'household' | 'unknown'

export const OWNER_ROW_ORDER: DashboardOwnerKey[] = ['brianna', 'elaine', 'household', 'unknown']
export const OWNER_LABELS: Record<DashboardOwnerKey, string> = {
  brianna: 'Brianna',
  elaine: 'Elaine',
  household: 'Household',
  unknown: 'Unknown',
}

export type DashboardOwnerAggregate = {
  incomeMtd: number
  spendMtd: number
}

export type DashboardOwnerTxRow = {
  owner: string | null
  type: string | null
  amount: number | string | null
}

export type DashboardOwnerResponsibilityRow = {
  owner: DashboardOwnerKey
  label: string
  incomeMtd: number
  spendMtd: number
  cashFlowMtd: number
  spendSharePct: number | null
}

export type DashboardOwnerResponsibility = {
  rows: DashboardOwnerResponsibilityRow[]
  totalIncomeMtd: number
  totalSpendMtd: number
}

export type DashboardCoreSnapshot = {
  anomalies: DashboardAnomalyRow[]
  attentionCounts: DashboardAttentionCounts
  autopilotMetrics: DashboardAutopilotMetrics
  dataFreshnessRows: DashboardDataFreshnessRow[]
  errorMessage: string
  kpis: DashboardKpis
  lastAccountSyncAt: string | null
  lastAnalysisAt: string | null
  lastWeeklyInsightsAt: string | null
  ownerResponsibility: DashboardOwnerResponsibility
  upcomingRenewals: DashboardRenewalRow[]
}

export type DashboardSupplementalState = {
  savingsLoading: boolean
  savingsSummary: SavingsBucketSummaryRpc | null
  shiftLoading: boolean
  shiftSummary: ShiftWeekSummaryRpc | null
}

export function normalizeOwner(owner: string | null): DashboardOwnerKey {
  if (owner === 'brianna' || owner === 'elaine' || owner === 'household') return owner
  return 'unknown'
}

export function emptyOwnerResponsibility(): DashboardOwnerResponsibility {
  return {
    rows: OWNER_ROW_ORDER.filter((owner) => owner !== 'unknown').map((owner) => ({
      owner,
      label: OWNER_LABELS[owner],
      incomeMtd: 0,
      spendMtd: 0,
      cashFlowMtd: 0,
      spendSharePct: null,
    })),
    totalIncomeMtd: 0,
    totalSpendMtd: 0,
  }
}

export function emptyAttentionCounts(): DashboardAttentionCounts {
  return {
    uncategorizedTransactions: 0,
    reviewSubscriptions: 0,
    unreadAlerts: 0,
    unownedAccounts: 0,
  }
}

export function emptyAutopilotMetrics(): DashboardAutopilotMetrics {
  return {
    autoCategorizedRatePct: null,
    autoCategorizedCount30d: 0,
    totalEligibleCount30d: 0,
    uncategorizedCount7d: 0,
    manualFixes7d: 0,
  }
}

export function emptySupplementalState(): DashboardSupplementalState {
  return {
    shiftSummary: null,
    savingsSummary: null,
    shiftLoading: true,
    savingsLoading: true,
  }
}

export function monthStartDate(): string {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0)).toISOString().slice(0, 10)
}

export function todayDate(): string {
  return new Date().toISOString().slice(0, 10)
}

export function tomorrowDate(): string {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() + 1)
  return date.toISOString().slice(0, 10)
}

export function daysAgoIso(days: number): string {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() - days)
  return date.toISOString()
}

export function staleDaysFromNewestTransaction(newestTransactionAt: string | null): number | null {
  if (!newestTransactionAt) return null
  const parsed = new Date(newestTransactionAt)
  if (Number.isNaN(parsed.valueOf())) return null
  const ageMs = Date.now() - parsed.getTime()
  if (ageMs <= 0) return 0
  return Math.floor(ageMs / (24 * 60 * 60 * 1000))
}

export function formatDateTime(input: string | null): string {
  if (!input) return 'Not available'
  const date = new Date(input)
  if (Number.isNaN(date.valueOf())) return input
  return date.toLocaleString()
}

export function statusTone(status: string | null): string {
  const normalized = (status ?? '').toLowerCase()
  if (normalized.includes('succeeded')) return 'text-emerald-700'
  if (normalized.includes('running')) return 'text-amber-700'
  if (normalized.includes('failed') || normalized.includes('error')) return 'text-rose-700'
  if (normalized.includes('missing') || normalized.includes('unavailable')) return 'text-rose-700'
  return 'text-muted-foreground'
}

export function statusDot(status: string | null): string {
  const normalized = (status ?? '').toLowerCase()
  if (normalized.includes('succeeded')) return 'bg-emerald-500'
  if (normalized.includes('running')) return 'bg-amber-500'
  if (normalized.includes('failed') || normalized.includes('error')) return 'bg-rose-500'
  return 'bg-muted-foreground/40'
}

export function normalizeKpis(data: DashboardKpisRpc | null): DashboardKpis {
  const topCategoriesRaw = Array.isArray(data?.top_categories) ? data.top_categories : []
  const topCategories: DashboardTopCategory[] = topCategoriesRaw.map((row) => ({
    category: row.category || 'Uncategorized',
    amount: toNumber(row.amount),
  }))

  return {
    incomeMtd: toNumber(data?.income_mtd ?? 0),
    incomeBrianna: toNumber(data?.income_brianna ?? 0),
    incomeElaine: toNumber(data?.income_elaine ?? 0),
    spendMtd: toNumber(data?.spend_mtd ?? 0),
    cashFlowMtd: toNumber(data?.cash_flow_mtd ?? 0),
    spendLastMonth: toNumber(data?.spend_last_month ?? 0),
    spendDelta: toNumber(data?.spend_delta ?? 0),
    spendDeltaPct:
      data?.spend_delta_pct === null || data?.spend_delta_pct === undefined
        ? null
        : toNumber(data.spend_delta_pct),
    topCategories,
  }
}
