import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { functionUrl } from '../lib/functions'
import { useSession } from '../lib/session'
import { supabase } from '../lib/supabase'

type MatchType = 'contains' | 'equals' | 'regex'
type Cadence = 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'unknown'
type PatternClassification = 'needs_review' | 'subscription' | 'bill_loan' | 'transfer' | 'ignore'

type AliasRow = {
  id: number
  pattern: string
  normalized: string
  kind_hint: string | null
  match_type: MatchType
  priority: number
  is_active: boolean
  account_id: string | null
  updated_at: string
}

type TransactionRuleRow = {
  id: string
  name: string
  pattern: string
  match_type: MatchType
  account_id: string | null
  cadence: Cadence | null
  min_amount: number | string | null
  max_amount: number | string | null
  target_amount: number | string | null
  amount_tolerance_pct: number | string | null
  set_merchant_normalized: string | null
  set_pattern_classification: PatternClassification | null
  explanation: string | null
  priority: number
  is_active: boolean
  updated_at: string
}

type AccountRow = { id: string; name: string; institution: string | null }
type RunState = { requestId: string; ok: boolean; message: string; at: string }

type AliasForm = {
  pattern: string
  normalized: string
  matchType: MatchType
  priority: string
  accountId: string
  isActive: boolean
}

type RuleForm = {
  name: string
  pattern: string
  classification: PatternClassification
  forceMerchant: string
  matchType: MatchType
  accountId: string
  cadence: '' | Cadence
  minAmount: string
  maxAmount: string
  targetAmount: string
  tolerancePct: string
  explanation: string
  priority: string
  isActive: boolean
}

const EMPTY_ALIAS: AliasForm = {
  pattern: '',
  normalized: '',
  matchType: 'contains',
  priority: '100',
  accountId: '',
  isActive: true,
}

const EMPTY_RULE: RuleForm = {
  name: '',
  pattern: '',
  classification: 'needs_review',
  forceMerchant: '',
  matchType: 'contains',
  accountId: '',
  cadence: '',
  minAmount: '',
  maxAmount: '',
  targetAmount: '',
  tolerancePct: '',
  explanation: '',
  priority: '100',
  isActive: true,
}

const RULE_PRESETS: Array<{
  label: string
  name: string
  pattern: string
  classification: PatternClassification
  forceMerchant?: string
}> = [
  {
    label: 'Streaming = Subscription',
    name: 'Streaming Services',
    pattern: 'netflix|hulu|spotify|disney',
    classification: 'subscription',
  },
  {
    label: 'Transfers',
    name: 'Bank Transfers',
    pattern: 'xfer|transfer|zelle|venmo|payment thank you',
    classification: 'transfer',
  },
  {
    label: 'Comcast Bill',
    name: 'Comcast Bill',
    pattern: 'comcast',
    classification: 'bill_loan',
    forceMerchant: 'COMCAST',
  },
]

const ALIAS_PRESETS: Array<{ label: string; pattern: string; normalized: string }> = [
  { label: 'Comcast Houston -> COMCAST', pattern: 'comcast xfinity houston', normalized: 'COMCAST' },
  { label: 'apple.com/bill -> APPLE', pattern: 'apple.com/bill', normalized: 'APPLE' },
]

function parseOptionalNumber(value: string): number | null | typeof Number.NaN {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number.parseFloat(trimmed)
  return Number.isFinite(parsed) ? parsed : Number.NaN
}

function formatTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.valueOf())) return value
  return date.toLocaleString()
}

function classificationLabel(value: PatternClassification | null): string {
  if (!value) return 'No override'
  if (value === 'bill_loan') return 'Bill/Loan'
  if (value === 'needs_review') return 'Needs review'
  if (value === 'transfer') return 'Transfer'
  if (value === 'ignore') return 'Ignore'
  return 'Subscription'
}

function friendlyRuleSummary(row: TransactionRuleRow): string {
  const base = `If transaction text ${row.match_type} "${row.pattern}"`
  const forcedClass = row.set_pattern_classification ? `classify as ${classificationLabel(row.set_pattern_classification)}` : ''
  const forcedMerchant = row.set_merchant_normalized ? `rename merchant to "${row.set_merchant_normalized}"` : ''
  const action = [forcedClass, forcedMerchant].filter(Boolean).join(' and ')
  return action ? `${base}, ${action}.` : `${base}.`
}

async function getAccessToken(): Promise<string | null> {
  const { data: current } = await supabase.auth.getSession()
  const currentSession = current.session
  if (currentSession?.access_token) {
    const expiresAtMs = (currentSession.expires_at ?? 0) * 1000
    if (!expiresAtMs || expiresAtMs > Date.now() + 60_000) return currentSession.access_token
  }
  const { data: refreshed, error } = await supabase.auth.refreshSession()
  if (!error && refreshed.session?.access_token) return refreshed.session.access_token
  return currentSession?.access_token ?? null
}

export default function Rules() {
  const navigate = useNavigate()
  const { session, loading } = useSession()

  const [aliases, setAliases] = useState<AliasRow[]>([])
  const [rules, setRules] = useState<TransactionRuleRow[]>([])
  const [accounts, setAccounts] = useState<AccountRow[]>([])
  const [aliasForm, setAliasForm] = useState<AliasForm>(EMPTY_ALIAS)
  const [ruleForm, setRuleForm] = useState<RuleForm>(EMPTY_RULE)
  const [fetching, setFetching] = useState(true)
  const [saving, setSaving] = useState(false)
  const [running, setRunning] = useState(false)
  const [showAliasAdvanced, setShowAliasAdvanced] = useState(false)
  const [showRuleAdvanced, setShowRuleAdvanced] = useState(false)
  const [runState, setRunState] = useState<RunState | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const activeAliasCount = useMemo(() => aliases.filter((row) => row.is_active).length, [aliases])
  const activeRuleCount = useMemo(() => rules.filter((row) => row.is_active).length, [rules])

  const loadData = async () => {
    if (!session?.user) return
    setFetching(true)
    setError('')

    const [aliasResult, ruleResult, accountResult] = await Promise.all([
      supabase
        .from('merchant_aliases')
        .select('id, pattern, normalized, kind_hint, match_type, priority, is_active, account_id, updated_at')
        .eq('user_id', session.user.id)
        .order('priority', { ascending: true })
        .order('updated_at', { ascending: false }),
      supabase
        .from('transaction_rules')
        .select(
          'id, name, pattern, match_type, account_id, cadence, min_amount, max_amount, target_amount, amount_tolerance_pct, set_merchant_normalized, set_pattern_classification, explanation, priority, is_active, updated_at',
        )
        .eq('user_id', session.user.id)
        .order('priority', { ascending: true })
        .order('updated_at', { ascending: false }),
      supabase.from('accounts').select('id, name, institution').eq('user_id', session.user.id).order('name', { ascending: true }),
    ])

    if (aliasResult.error || ruleResult.error || accountResult.error) {
      setError('Could not load rules.')
      setFetching(false)
      return
    }

    setAliases((aliasResult.data ?? []) as AliasRow[])
    setRules((ruleResult.data ?? []) as TransactionRuleRow[])
    setAccounts((accountResult.data ?? []) as AccountRow[])
    setFetching(false)
  }

  useEffect(() => {
    if (loading) return
    if (!session?.user) {
      navigate('/login', { replace: true })
      return
    }
    void loadData()
  }, [loading, navigate, session])

  const submitAlias = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!session?.user) return
    if (!aliasForm.pattern.trim() || !aliasForm.normalized.trim()) {
      setError('Pattern and normalized merchant are required.')
      return
    }

    const priority = Number.parseInt(aliasForm.priority, 10)
    if (!Number.isFinite(priority)) {
      setError('Priority must be an integer.')
      return
    }

    setSaving(true)
    setError('')
    setMessage('')

    const { error: insertError } = await supabase.from('merchant_aliases').insert({
      user_id: session.user.id,
      pattern: aliasForm.pattern.trim(),
      normalized: aliasForm.normalized.trim(),
      match_type: aliasForm.matchType,
      priority,
      account_id: aliasForm.accountId || null,
      is_active: aliasForm.isActive,
    })

    if (insertError) {
      setError('Could not create alias.')
      setSaving(false)
      return
    }

    setAliasForm(EMPTY_ALIAS)
    setSaving(false)
    setMessage('Alias created.')
    await loadData()
  }

  const submitRule = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!session?.user) return
    if (!ruleForm.name.trim() || !ruleForm.pattern.trim()) {
      setError('Rule name and pattern are required.')
      return
    }

    const priority = Number.parseInt(ruleForm.priority, 10)
    if (!Number.isFinite(priority)) {
      setError('Priority must be an integer.')
      return
    }

    const minAmount = parseOptionalNumber(ruleForm.minAmount)
    const maxAmount = parseOptionalNumber(ruleForm.maxAmount)
    const targetAmount = parseOptionalNumber(ruleForm.targetAmount)
    const tolerancePct = parseOptionalNumber(ruleForm.tolerancePct)

    if (Number.isNaN(minAmount) || Number.isNaN(maxAmount) || Number.isNaN(targetAmount) || Number.isNaN(tolerancePct)) {
      setError('Amount fields must be valid numbers.')
      return
    }

    if (tolerancePct !== null && (targetAmount === null || tolerancePct < 0 || tolerancePct > 1)) {
      setError('Tolerance requires target amount and must be between 0 and 1.')
      return
    }

    setSaving(true)
    setError('')
    setMessage('')

    const { error: insertError } = await supabase.from('transaction_rules').insert({
      user_id: session.user.id,
      name: ruleForm.name.trim(),
      pattern: ruleForm.pattern.trim(),
      match_type: ruleForm.matchType,
      account_id: ruleForm.accountId || null,
      cadence: ruleForm.cadence || null,
      min_amount: minAmount,
      max_amount: maxAmount,
      target_amount: targetAmount,
      amount_tolerance_pct: tolerancePct,
      set_merchant_normalized: ruleForm.forceMerchant.trim() || null,
      set_pattern_classification: ruleForm.classification,
      explanation: ruleForm.explanation.trim() || null,
      priority,
      is_active: ruleForm.isActive,
    })

    if (insertError) {
      setError('Could not create transaction rule.')
      setSaving(false)
      return
    }

    setRuleForm(EMPTY_RULE)
    setSaving(false)
    setMessage('Transaction rule created.')
    await loadData()
  }

  const runAnalysisNow = async () => {
    setRunning(true)
    setError('')
    setMessage('')
    try {
      const token = await getAccessToken()
      if (!token) throw new Error('Session expired. Please log in again.')

      const response = await fetch(functionUrl('analysis-daily'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      })

      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean
        request_id?: string
        users_processed?: number
        subscriptions_upserted?: number
        alerts_inserted?: number
        error?: string
        detail?: string
      }

      if (!response.ok || payload.ok !== true) throw new Error(payload.detail ?? payload.error ?? 'Analysis failed.')

      setRunState({
        requestId: payload.request_id ?? `manual-${Date.now()}`,
        ok: true,
        at: new Date().toISOString(),
        message: `users: ${payload.users_processed ?? 0}, subscriptions: ${payload.subscriptions_upserted ?? 0}, alerts: ${payload.alerts_inserted ?? 0}`,
      })
      setMessage('Analysis run completed.')
      await loadData()
    } catch (runError) {
      const detail = runError instanceof Error ? runError.message : 'Analysis failed.'
      setRunState({
        requestId: `manual-${Date.now()}`,
        ok: false,
        at: new Date().toISOString(),
        message: detail,
      })
      setError(detail)
    } finally {
      setRunning(false)
    }
  }

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Rules</h1>
            <p className="mt-2 text-sm text-slate-600">Start simple: aliases rename merchants, transaction rules force behavior.</p>
            {!fetching && (
              <p className="mt-2 text-xs text-slate-500">
                Aliases: {activeAliasCount}/{aliases.length} active • Behavior rules: {activeRuleCount}/{rules.length} active
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => void runAnalysisNow()}
            disabled={running}
            className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {running ? 'Running...' : 'Run analysis now'}
          </button>
        </div>
        {runState && (
          <div className={`mt-3 rounded-lg border px-3 py-2 text-sm ${runState.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
            <p className="font-semibold">
              {runState.ok ? 'Succeeded' : 'Failed'} • Request ID: {runState.requestId}
            </p>
            <p className="mt-1 text-xs">At: {formatTime(runState.at)}</p>
            <p className="mt-1">{runState.message}</p>
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <form onSubmit={submitAlias} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Quick Alias (Rename Merchant)</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {ALIAS_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() =>
                  setAliasForm((current) => ({
                    ...current,
                    pattern: preset.pattern,
                    normalized: preset.normalized,
                  }))
                }
                className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
              >
                {preset.label}
              </button>
            ))}
          </div>
          <div className="mt-3 space-y-3">
            <input value={aliasForm.pattern} onChange={(e) => setAliasForm((c) => ({ ...c, pattern: e.target.value }))} placeholder='Match text (example: "comcast xfinity houston")' className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input value={aliasForm.normalized} onChange={(e) => setAliasForm((c) => ({ ...c, normalized: e.target.value }))} placeholder='Rename to (example: "COMCAST")' className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <button
              type="button"
              onClick={() => setShowAliasAdvanced((current) => !current)}
              className="text-xs font-semibold text-slate-600 underline-offset-2 hover:underline"
            >
              {showAliasAdvanced ? 'Hide advanced options' : 'Show advanced options'}
            </button>
            {showAliasAdvanced && (
              <div className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 md:grid-cols-2">
                <select value={aliasForm.matchType} onChange={(e) => setAliasForm((c) => ({ ...c, matchType: e.target.value as MatchType }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                  <option value="contains">Match type: contains</option>
                  <option value="equals">Match type: equals</option>
                  <option value="regex">Match type: regex</option>
                </select>
                <select value={aliasForm.accountId} onChange={(e) => setAliasForm((c) => ({ ...c, accountId: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                  <option value="">All accounts</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                      {account.institution ? ` (${account.institution})` : ''}
                    </option>
                  ))}
                </select>
                <input type="number" value={aliasForm.priority} onChange={(e) => setAliasForm((c) => ({ ...c, priority: e.target.value }))} placeholder="Priority (lower runs first)" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={aliasForm.isActive} onChange={(e) => setAliasForm((c) => ({ ...c, isActive: e.target.checked }))} />
                  Active
                </label>
              </div>
            )}
          </div>
          <button type="submit" disabled={saving} className="mt-3 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60">
            Add alias
          </button>
        </form>

        <form onSubmit={submitRule} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Quick Behavior Rule</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {RULE_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() =>
                  setRuleForm((current) => ({
                    ...current,
                    name: preset.name,
                    pattern: preset.pattern,
                    classification: preset.classification,
                    forceMerchant: preset.forceMerchant ?? '',
                  }))
                }
                className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
              >
                {preset.label}
              </button>
            ))}
          </div>
          <div className="mt-3 space-y-3">
            <input value={ruleForm.name} onChange={(e) => setRuleForm((c) => ({ ...c, name: e.target.value }))} placeholder="Rule name" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input value={ruleForm.pattern} onChange={(e) => setRuleForm((c) => ({ ...c, pattern: e.target.value }))} placeholder='Match text (example: "netflix|hulu|spotify")' className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <select value={ruleForm.classification} onChange={(e) => setRuleForm((c) => ({ ...c, classification: e.target.value as PatternClassification }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="needs_review">Set behavior: Needs review</option>
              <option value="subscription">Set behavior: Subscription</option>
              <option value="bill_loan">Set behavior: Bill/Loan</option>
              <option value="transfer">Set behavior: Transfer</option>
              <option value="ignore">Set behavior: Ignore</option>
            </select>
            <input value={ruleForm.forceMerchant} onChange={(e) => setRuleForm((c) => ({ ...c, forceMerchant: e.target.value }))} placeholder='Rename merchant to (optional, example: "COMCAST")' className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <button
              type="button"
              onClick={() => setShowRuleAdvanced((current) => !current)}
              className="text-xs font-semibold text-slate-600 underline-offset-2 hover:underline"
            >
              {showRuleAdvanced ? 'Hide advanced options' : 'Show advanced options'}
            </button>
            {showRuleAdvanced && (
              <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="grid gap-3 md:grid-cols-2">
                  <select value={ruleForm.matchType} onChange={(e) => setRuleForm((c) => ({ ...c, matchType: e.target.value as MatchType }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                    <option value="contains">Match type: contains</option>
                    <option value="equals">Match type: equals</option>
                    <option value="regex">Match type: regex</option>
                  </select>
                  <select value={ruleForm.accountId} onChange={(e) => setRuleForm((c) => ({ ...c, accountId: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                    <option value="">All accounts</option>
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                        {account.institution ? ` (${account.institution})` : ''}
                      </option>
                    ))}
                  </select>
                  <select value={ruleForm.cadence} onChange={(e) => setRuleForm((c) => ({ ...c, cadence: e.target.value as '' | Cadence }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
                    <option value="">Any cadence</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="yearly">Yearly</option>
                    <option value="unknown">Unknown</option>
                  </select>
                  <input type="number" value={ruleForm.priority} onChange={(e) => setRuleForm((c) => ({ ...c, priority: e.target.value }))} placeholder="Priority (lower runs first)" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <input type="number" step="0.01" value={ruleForm.minAmount} onChange={(e) => setRuleForm((c) => ({ ...c, minAmount: e.target.value }))} placeholder="Min amount" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                  <input type="number" step="0.01" value={ruleForm.maxAmount} onChange={(e) => setRuleForm((c) => ({ ...c, maxAmount: e.target.value }))} placeholder="Max amount" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                  <input type="number" step="0.01" value={ruleForm.targetAmount} onChange={(e) => setRuleForm((c) => ({ ...c, targetAmount: e.target.value }))} placeholder="Target amount" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                  <input type="number" step="0.01" value={ruleForm.tolerancePct} onChange={(e) => setRuleForm((c) => ({ ...c, tolerancePct: e.target.value }))} placeholder="Tolerance (0 to 1)" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                </div>
                <textarea value={ruleForm.explanation} onChange={(e) => setRuleForm((c) => ({ ...c, explanation: e.target.value }))} placeholder="Explanation (optional)" rows={2} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={ruleForm.isActive} onChange={(e) => setRuleForm((c) => ({ ...c, isActive: e.target.checked }))} />
                  Active
                </label>
              </div>
            )}
          </div>
          <button type="submit" disabled={saving} className="mt-3 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60">
            Add behavior rule
          </button>
        </form>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Saved Alias Rules</h2>
        {fetching ? (
          <p className="mt-3 text-sm text-slate-600">Loading...</p>
        ) : aliases.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">No alias rules yet.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {aliases.map((row) => (
              <div key={row.id} className="rounded-lg border border-slate-200 bg-white p-3">
                <p className="text-sm text-slate-900">
                  If transaction text <strong>{row.match_type}</strong> "<strong>{row.pattern}</strong>", rename merchant to{' '}
                  <strong>{row.normalized}</strong>.
                </p>
                <p className="mt-1 text-xs text-slate-600">Priority {row.priority} • Updated {formatTime(row.updated_at)}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      if (!session?.user) return
                      setSaving(true)
                      await supabase.from('merchant_aliases').update({ is_active: !row.is_active }).eq('id', row.id).eq('user_id', session.user.id)
                      setSaving(false)
                      await loadData()
                    }}
                    disabled={saving}
                    className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {row.is_active ? 'Disable' : 'Enable'}
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!session?.user) return
                      setSaving(true)
                      await supabase.from('merchant_aliases').delete().eq('id', row.id).eq('user_id', session.user.id)
                      setSaving(false)
                      await loadData()
                    }}
                    disabled={saving}
                    className="rounded-md border border-rose-300 px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Saved Behavior Rules</h2>
        {fetching ? (
          <p className="mt-3 text-sm text-slate-600">Loading...</p>
        ) : rules.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">No behavior rules yet.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {rules.map((row) => (
              <div key={row.id} className="rounded-lg border border-slate-200 bg-white p-3">
                <p className="text-sm text-slate-900">{friendlyRuleSummary(row)}</p>
                <p className="mt-1 text-xs text-slate-600">
                  Priority {row.priority} • {row.cadence ?? 'Any cadence'} • Updated {formatTime(row.updated_at)}
                </p>
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs font-semibold text-slate-600">Advanced details</summary>
                  <div className="mt-2 rounded-md bg-slate-50 p-2 text-xs text-slate-600">
                    <p>Amount range: {row.min_amount ?? 'Any'} to {row.max_amount ?? 'Any'}</p>
                    <p>Target / tolerance: {row.target_amount ?? 'None'} / {row.amount_tolerance_pct ?? 'None'}</p>
                    {row.explanation && <p>Why: {row.explanation}</p>}
                  </div>
                </details>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      if (!session?.user) return
                      setSaving(true)
                      await supabase.from('transaction_rules').update({ is_active: !row.is_active }).eq('id', row.id).eq('user_id', session.user.id)
                      setSaving(false)
                      await loadData()
                    }}
                    disabled={saving}
                    className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {row.is_active ? 'Disable' : 'Enable'}
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!session?.user) return
                      setSaving(true)
                      await supabase.from('transaction_rules').delete().eq('id', row.id).eq('user_id', session.user.id)
                      setSaving(false)
                      await loadData()
                    }}
                    disabled={saving}
                    className="rounded-md border border-rose-300 px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {message && <p className="text-sm text-emerald-700">{message}</p>}
      {error && <p className="text-sm text-rose-600">{error}</p>}
    </section>
  )
}
