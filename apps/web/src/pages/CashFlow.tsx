import { addDays, differenceInCalendarDays, format, isSameMonth, min, parseISO } from 'date-fns'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import DayRow from '@/components/cash-flow/DayRow'
import { useCashFlow } from '@/hooks/useCashFlow'
import { getLoginRedirectPath } from '@/lib/loginRedirect'
import type { CashFlowLedgerDay, CashFlowLedgerEntry } from '@/lib/types'
import { useSession } from '@/lib/session'

function toCurrency(value: number): string {
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function toSignedCurrency(value: number): string {
  const absoluteValue = toCurrency(Math.abs(value))
  if (value > 0) return `+${absoluteValue}`
  if (value < 0) return `-${absoluteValue}`
  return absoluteValue
}

type ForecastTone = 'safe' | 'tight' | 'risk'

type ForecastVerdict = {
  tone: ForecastTone
  label: string
  headline: string
  guidance: string
}

type LowPoint = {
  date: string
  balance: number
  triggeredBy: string[]
}

function buildForecastVerdict(
  lowestBalance: number,
  threshold: number,
  lowPoint: LowPoint | null,
): ForecastVerdict {
  if (lowestBalance < 0) {
    return {
      tone: 'risk',
      label: 'At Risk',
      headline: `Checking goes negative on ${lowPoint ? format(parseISO(lowPoint.date), 'MMM d') : 'this month'}.`,
      guidance: 'Move or pause bills, add a paycheck projection, or cut discretionary transfers before that date.',
    }
  }

  if (lowestBalance <= threshold) {
    return {
      tone: 'tight',
      label: 'Tight',
      headline: `You stay positive, but dip under your ${toCurrency(threshold)} comfort floor.`,
      guidance: 'Watch the next squeeze point closely and avoid extra spending before the next income lands.',
    }
  }

  return {
    tone: 'safe',
    label: 'Safe',
    headline: `Checking stays above your ${toCurrency(threshold)} floor this month.`,
    guidance: 'Use the runway below to confirm the next squeeze point, then leave the setup tools alone unless something changed.',
  }
}

function entryTone(entry: CashFlowLedgerEntry): string {
  if (entry.amount > 0) return 'text-emerald-700'
  if (entry.category === 'transfer') return 'text-amber-700'
  return 'text-foreground'
}

function entryLabel(entry: CashFlowLedgerEntry): string {
  if (entry.isProjected && entry.amount > 0) return 'Expected income'
  if (entry.isProjected && entry.amount < 0) return 'Planned outflow'
  if (entry.category === 'transfer') return 'Transfer'
  if (entry.amount > 0) return 'Deposit'
  return 'Spend'
}

function forecastToneClasses(tone: ForecastTone): string {
  if (tone === 'risk') return 'border-rose-300 bg-rose-50/85 text-rose-900'
  if (tone === 'tight') return 'border-amber-300 bg-amber-50/85 text-amber-950'
  return 'border-emerald-300 bg-emerald-50/85 text-emerald-950'
}

export default function CashFlow() {
  const navigate = useNavigate()
  const { session, loading: sessionLoading } = useSession()
  const userId = session?.user?.id

  const {
    loading,
    saving,
    error,
    success,
    selectedMonth,
    monthDate,
    monthStart,
    monthEnd,
    openingBalance,
    isBalanceInferred,
    lowBalanceThreshold,
    billTemplates,
    projectedIncomes,
    employers,
    ledger,
    billsThisMonth,
    lowPoints,
    summary,
    saveMonthSettings,
    addBillTemplate,
    toggleBillTemplate,
    addProjectedIncome,
    removeProjectedIncome,
    goToPreviousMonth,
    goToNextMonth,
    setMonthFromInput,
    clearMessages,
  } = useCashFlow(userId)

  const [openingBalanceDraft, setOpeningBalanceDraft] = useState(String(openingBalance))
  const [lowThresholdDraft, setLowThresholdDraft] = useState(String(lowBalanceThreshold))
  const [billForm, setBillForm] = useState({
    name: '',
    amount: '',
    dueDay: '',
    category: 'bill' as 'bill' | 'expense' | 'transfer',
    color: '#C65A38',
  })
  const [incomeForm, setIncomeForm] = useState({
    expectedDate: '',
    amount: '',
    description: '',
    employerId: '',
  })

  useEffect(() => {
    if (!sessionLoading && !userId) {
      navigate(getLoginRedirectPath('/cash-flow'), { replace: true })
    }
  }, [navigate, sessionLoading, userId])

  useEffect(() => {
    setOpeningBalanceDraft(String(openingBalance))
    setLowThresholdDraft(String(lowBalanceThreshold))
  }, [lowBalanceThreshold, openingBalance, selectedMonth])

  useEffect(() => {
    if (!incomeForm.expectedDate) {
      setIncomeForm((current) => ({ ...current, expectedDate: `${selectedMonth}-01` }))
    }
  }, [incomeForm.expectedDate, selectedMonth])

  const monthLabel = useMemo(() => format(monthDate, 'MMMM yyyy'), [monthDate])
  const displayedDays = useMemo(() => ledger.filter((day) => day.entries.length > 0 || day.isToday), [ledger])

  const isCurrentMonth = useMemo(() => isSameMonth(monthDate, new Date()), [monthDate])
  const focusStart = useMemo(
    () => (isCurrentMonth ? format(new Date(), 'yyyy-MM-dd') : monthStart),
    [isCurrentMonth, monthStart],
  )
  const focusEnd = useMemo(() => {
    const maxDate = min([addDays(parseISO(focusStart), 13), parseISO(monthEnd)])
    return format(maxDate, 'yyyy-MM-dd')
  }, [focusStart, monthEnd])

  const nextIncome = useMemo(
    () =>
      projectedIncomes
        .filter((entry) => entry.expected_date >= focusStart)
        .sort((a, b) => a.expected_date.localeCompare(b.expected_date))[0] ?? null,
    [focusStart, projectedIncomes],
  )

  const nextLowPoint = useMemo(
    () => lowPoints.find((point) => point.date >= focusStart) ?? lowPoints[0] ?? null,
    [focusStart, lowPoints],
  )

  const runwayDays = useMemo(
    () =>
      ledger.filter(
        (day) =>
          day.date >= focusStart &&
          day.date <= focusEnd &&
          (day.entries.length > 0 || day.isToday || day.isBelowThreshold),
      ),
    [focusEnd, focusStart, ledger],
  )

  const verdict = useMemo(
    () => buildForecastVerdict(summary.lowestBalance, lowBalanceThreshold, nextLowPoint),
    [lowBalanceThreshold, nextLowPoint, summary.lowestBalance],
  )

  const daysUntilNextIncome = useMemo(() => {
    if (!nextIncome) return null
    return differenceInCalendarDays(parseISO(nextIncome.expected_date), parseISO(focusStart))
  }, [focusStart, nextIncome])

  const onSaveMonthSettings = useCallback(async () => {
    const parsedOpening = Number(openingBalanceDraft)
    const parsedThreshold = Number(lowThresholdDraft)
    await saveMonthSettings(
      Number.isFinite(parsedOpening) ? parsedOpening : 0,
      Number.isFinite(parsedThreshold) ? parsedThreshold : 0,
    )
  }, [lowThresholdDraft, openingBalanceDraft, saveMonthSettings])

  const onAddBill = useCallback(async () => {
    const parsedAmount = Number(billForm.amount)
    const parsedDueDay = Number(billForm.dueDay)
    const added = await addBillTemplate({
      name: billForm.name,
      amount: Number.isFinite(parsedAmount) ? parsedAmount : 0,
      dueDayOfMonth: Number.isFinite(parsedDueDay) ? parsedDueDay : 1,
      category: billForm.category,
      color: billForm.color || '#C65A38',
    })
    if (added) {
      setBillForm({
        name: '',
        amount: '',
        dueDay: '',
        category: 'bill',
        color: '#C65A38',
      })
    }
  }, [addBillTemplate, billForm])

  const onAddProjectedIncome = useCallback(async () => {
    const parsedAmount = Number(incomeForm.amount)
    const added = await addProjectedIncome({
      expectedDate: incomeForm.expectedDate,
      amount: Number.isFinite(parsedAmount) ? parsedAmount : 0,
      description: incomeForm.description,
      employerId: incomeForm.employerId || null,
    })
    if (added) {
      setIncomeForm((current) => ({
        ...current,
        amount: '',
        description: '',
      }))
    }
  }, [addProjectedIncome, incomeForm])

  if (sessionLoading || !userId) {
    return <p className="text-sm text-muted-foreground">Loading cash flow...</p>
  }

  if (loading) {
    return (
      <section className="space-y-4 motion-page-enter">
        <div className="page-hero">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-muted-foreground">Cash Flow</p>
          <h1 className="mt-3 text-3xl font-semibold text-foreground sm:text-4xl">Building your month plan...</h1>
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base">
            Pulling checking activity, projected income, and recurring bills into a forecast you can actually use.
          </p>
        </div>
      </section>
    )
  }

  const nextBill =
    [...billsThisMonth]
      .filter((entry) => entry.date >= focusStart)
      .sort((a, b) => a.date.localeCompare(b.date))[0] ?? null
  const openingBalanceLabel = isBalanceInferred ? 'Starting estimate' : 'Starting balance'
  const lowestBalanceDateLabel = summary.lowestBalanceDate
    ? format(parseISO(summary.lowestBalanceDate), 'MMM d')
    : 'No low point'
  const focusWindowLabel = `${format(parseISO(focusStart), 'MMM d')} to ${format(parseISO(focusEnd), 'MMM d')}`

  return (
    <section className="space-y-6 motion-page-enter">
      <header className="page-hero isolate">
        <div className="app-grid-bg absolute inset-0 opacity-40" aria-hidden="true" />
        <div className="app-orb app-orb--primary" aria-hidden="true" />
        <div className="app-orb app-orb--accent" aria-hidden="true" />

        <div className="relative space-y-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl space-y-3">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-muted-foreground">Cash flow outlook</p>
              <div className="space-y-2">
                <h1 className="text-3xl font-semibold text-foreground sm:text-4xl">{verdict.headline}</h1>
                <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">{verdict.guidance}</p>
              </div>
            </div>

            <div
              className={`w-full max-w-sm rounded-2xl border px-4 py-4 shadow-[0_18px_38px_-28px_hsl(var(--foreground)/0.55)] ${forecastToneClasses(
                verdict.tone,
              )}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.26em] opacity-75">Month verdict</p>
                  <p className="mt-2 text-3xl font-semibold">{verdict.label}</p>
                </div>
                <span className="rounded-full border border-current/20 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em]">
                  {monthLabel}
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 opacity-80">
                Lowest projected balance: <span className="font-semibold">{toCurrency(summary.lowestBalance)}</span>
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
            <DecisionFact
              label={openingBalanceLabel}
              value={toCurrency(openingBalance)}
              detail={
                isBalanceInferred
                  ? 'Based on recent checking activity because no manual starting balance is saved.'
                  : 'Using your saved starting balance for this month.'
              }
            />
            <DecisionFact
              label="Comfort floor"
              value={toCurrency(lowBalanceThreshold)}
              detail="When the runway drops below this line, the month stops feeling safe."
            />
            <DecisionFact
              label="Lowest point"
              value={toCurrency(summary.lowestBalance)}
              detail={summary.lowestBalanceDate ? `Projected on ${lowestBalanceDateLabel}.` : 'No projected dip this month.'}
              tone={verdict.tone === 'risk' ? 'risk' : verdict.tone === 'tight' ? 'tight' : undefined}
            />
            <DecisionFact
              label="Next paycheck"
              value={nextIncome ? format(parseISO(nextIncome.expected_date), 'MMM d') : 'None planned'}
              detail={
                nextIncome
                  ? `${daysUntilNextIncome === 0 ? 'Today' : `${daysUntilNextIncome} day${daysUntilNextIncome === 1 ? '' : 's'} away`} • ${toCurrency(
                      Number(nextIncome.amount),
                    )}`
                  : 'Add projected income below so the runway can warn you earlier.'
              }
            />
          </div>

          <div className="grid gap-3 rounded-2xl border border-border/80 bg-card/80 p-3 sm:grid-cols-[auto_1fr_auto] sm:items-center">
            <div className="inline-flex rounded-full border border-primary/15 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-primary">
              Decision window
            </div>
            <p className="text-sm text-muted-foreground">
              {focusWindowLabel} {isCurrentMonth ? 'is the next stretch that can hurt you.' : 'is the opening stretch of this forecast.'}
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={goToPreviousMonth} className="btn-soft">
                Previous
              </button>
              <input
                type="month"
                value={selectedMonth}
                onChange={(event) => setMonthFromInput(event.target.value)}
                className="field-control w-[10.5rem]"
                aria-label="Choose cash flow month"
              />
              <button type="button" onClick={goToNextMonth} className="btn-soft">
                Next
              </button>
            </div>
          </div>
        </div>
      </header>

      {error ? (
        <section className="section-surface flex flex-col gap-3 border-rose-200 bg-rose-50/85 px-4 py-4 text-sm text-rose-900 sm:flex-row sm:items-center sm:justify-between">
          <p>{error}</p>
          <button type="button" onClick={clearMessages} className="btn-soft border-rose-200 bg-white/70 text-rose-900 hover:bg-white">
            Dismiss
          </button>
        </section>
      ) : null}

      {success ? (
        <section className="section-surface flex flex-col gap-3 border-emerald-200 bg-emerald-50/85 px-4 py-4 text-sm text-emerald-900 sm:flex-row sm:items-center sm:justify-between">
          <p>{success}</p>
          <button
            type="button"
            onClick={clearMessages}
            className="btn-soft border-emerald-200 bg-white/70 text-emerald-900 hover:bg-white"
          >
            Dismiss
          </button>
        </section>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_22rem]">
        <section className="section-surface overflow-hidden">
          <div className="border-b border-border/70 px-5 py-5 sm:px-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="space-y-1">
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-muted-foreground">Runway</p>
                <h2 className="text-2xl font-semibold text-foreground">What the next two weeks look like</h2>
                <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                  This is the stretch where cash flow pressure matters most. Watch paychecks, fixed bills, and any day your running balance drops below your comfort floor.
                </p>
              </div>
              <div className="rounded-2xl border border-border/80 bg-muted/35 px-4 py-3 text-sm text-muted-foreground">
                <p>
                  Net movement:{' '}
                  <span className={`font-semibold ${summary.netTotal >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {toSignedCurrency(summary.netTotal)}
                  </span>
                </p>
                <p className="mt-1">
                  Forecasted bills: <span className="font-semibold text-foreground">{toCurrency(summary.projectedExpense)}</span>
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3 px-5 py-5 sm:px-6">
            {runwayDays.length > 0 ? (
              runwayDays.map((day) => <RunwayDayRow key={day.date} day={day} threshold={lowBalanceThreshold} />)
            ) : (
              <div className="rounded-2xl border border-dashed border-border/80 bg-muted/15 px-4 py-6 text-sm text-muted-foreground">
                No checking activity or projected items are scheduled in this window yet.
              </div>
            )}
          </div>
        </section>

        <aside className="space-y-6">
          <section className="section-surface px-5 py-5 sm:px-6">
            <div className="space-y-1">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-muted-foreground">Watchpoints</p>
              <h2 className="text-2xl font-semibold text-foreground">What to look at next</h2>
            </div>

            <div className="mt-5 space-y-3">
              <WatchRow
                label="Next low point"
                value={
                  nextLowPoint
                    ? `${format(parseISO(nextLowPoint.date), 'MMM d')} • ${toCurrency(nextLowPoint.balance)}`
                    : 'None this month'
                }
                detail={
                  nextLowPoint
                    ? nextLowPoint.triggeredBy.length > 0
                      ? `Triggered by ${nextLowPoint.triggeredBy.slice(0, 2).join(', ')}${nextLowPoint.triggeredBy.length > 2 ? ', ...' : ''}.`
                      : 'No specific bill or transfer was identified on that date.'
                    : 'Your current forecast stays above the floor for the rest of the month.'
                }
                tone={verdict.tone === 'risk' ? 'risk' : verdict.tone === 'tight' ? 'tight' : 'safe'}
              />
              <WatchRow
                label="Next recurring bill"
                value={
                  nextBill
                    ? `${format(parseISO(nextBill.date), 'MMM d')} • ${toCurrency(Math.abs(Number(nextBill.amount)))}`
                    : 'No remaining bills'
                }
                detail={nextBill ? nextBill.description : 'All active recurring bills for this month have already passed.'}
              />
              <WatchRow
                label="Projected income"
                value={
                  nextIncome
                    ? `${format(parseISO(nextIncome.expected_date), 'MMM d')} • ${toCurrency(Number(nextIncome.amount))}`
                    : 'No projected income'
                }
                detail={
                  nextIncome
                    ? nextIncome.description || 'Projected paycheck or deposit.'
                    : 'Add paychecks below so the forecast can explain why the month stays safe.'
                }
              />
              <WatchRow
                label="Recurring load"
                value={`${billTemplates.filter((template) => template.is_active).length} active bills`}
                detail={`${projectedIncomes.length} projected income item${projectedIncomes.length === 1 ? '' : 's'} in ${monthLabel}.`}
              />
            </div>
          </section>

          <section className="section-surface px-5 py-5 sm:px-6">
            <div className="space-y-1">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-muted-foreground">Month readout</p>
              <h2 className="text-2xl font-semibold text-foreground">The quick numbers</h2>
            </div>

            <div className="mt-5 space-y-3">
              <SummaryLine label="Income hitting checking" value={toCurrency(summary.incomeTotal)} tone="positive" />
              <SummaryLine label="Outflows from checking" value={toCurrency(summary.expenseTotal)} tone="negative" />
              <SummaryLine label="Projected income" value={toCurrency(summary.projectedIncome)} tone="positive" />
              <SummaryLine label="Projected bills and transfers" value={toCurrency(summary.projectedExpense)} tone="negative" />
              <SummaryLine
                label="Net month movement"
                value={toSignedCurrency(summary.netTotal)}
                tone={summary.netTotal >= 0 ? 'positive' : 'negative'}
              />
            </div>
          </section>
        </aside>
      </div>

      <section className="space-y-4">
        <PlannerSection
          title="Month settings"
          description="Set the opening checking balance and the comfort floor you want the forecast to protect."
          defaultOpen
          action={
            <button
              type="button"
              onClick={onSaveMonthSettings}
              className="btn-soft bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save settings'}
            </button>
          }
        >
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm">
              <span className="font-medium text-foreground">Opening balance</span>
              <input
                type="number"
                step="0.01"
                value={openingBalanceDraft}
                onChange={(event) => setOpeningBalanceDraft(event.target.value)}
                className="field-control"
              />
              <p className="text-xs leading-5 text-muted-foreground">
                {isBalanceInferred
                  ? 'This month is currently using an inferred estimate from recent checking activity.'
                  : 'This month is using the manual starting balance you saved.'}
              </p>
            </label>

            <label className="space-y-2 text-sm">
              <span className="font-medium text-foreground">Low balance threshold</span>
              <input
                type="number"
                step="0.01"
                value={lowThresholdDraft}
                onChange={(event) => setLowThresholdDraft(event.target.value)}
                className="field-control"
              />
              <p className="text-xs leading-5 text-muted-foreground">
                When projected checking drops below this line, the page switches from calm to caution.
              </p>
            </label>
          </div>
        </PlannerSection>

        <PlannerSection
          title="Recurring bills"
          description="Keep fixed outflows current so the runway warns you before a squeeze hits."
          defaultOpen={billTemplates.filter((template) => template.is_active).length === 0}
        >
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
            <form
              className="grid gap-3 rounded-2xl border border-border/75 bg-muted/15 p-4"
              onSubmit={(event) => {
                event.preventDefault()
                void onAddBill()
              }}
            >
              <h3 className="text-lg font-semibold text-foreground">Add recurring bill</h3>
              <label className="space-y-2 text-sm">
                <span className="font-medium text-foreground">Name</span>
                <input
                  type="text"
                  value={billForm.name}
                  onChange={(event) => setBillForm((current) => ({ ...current, name: event.target.value }))}
                  className="field-control"
                  placeholder="Mortgage, daycare, car insurance..."
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-2 text-sm">
                  <span className="font-medium text-foreground">Amount</span>
                  <input
                    type="number"
                    step="0.01"
                    value={billForm.amount}
                    onChange={(event) => setBillForm((current) => ({ ...current, amount: event.target.value }))}
                    className="field-control"
                  />
                </label>
                <label className="space-y-2 text-sm">
                  <span className="font-medium text-foreground">Due day</span>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={billForm.dueDay}
                    onChange={(event) => setBillForm((current) => ({ ...current, dueDay: event.target.value }))}
                    className="field-control"
                  />
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_8rem]">
                <label className="space-y-2 text-sm">
                  <span className="font-medium text-foreground">Category</span>
                  <select
                    value={billForm.category}
                    onChange={(event) =>
                      setBillForm((current) => ({
                        ...current,
                        category: event.target.value as 'bill' | 'expense' | 'transfer',
                      }))
                    }
                    className="field-control"
                  >
                    <option value="bill">Bill</option>
                    <option value="expense">Expense</option>
                    <option value="transfer">Transfer</option>
                  </select>
                </label>
                <label className="space-y-2 text-sm">
                  <span className="font-medium text-foreground">Color</span>
                  <input
                    type="color"
                    value={billForm.color}
                    onChange={(event) => setBillForm((current) => ({ ...current, color: event.target.value }))}
                    className="field-control h-11 px-2"
                  />
                </label>
              </div>
              <button
                type="submit"
                className="btn-soft bg-primary text-primary-foreground hover:bg-primary/90"
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Add recurring bill'}
              </button>
            </form>

            <div className="space-y-3">
              {billTemplates.length > 0 ? (
                billTemplates
                  .slice()
                  .sort((a, b) => a.due_day_of_month - b.due_day_of_month)
                  .map((template) => (
                    <article
                      key={template.id}
                      className={`rounded-2xl border px-4 py-4 ${
                        template.is_active ? 'border-border/80 bg-card' : 'border-border/60 bg-muted/15 opacity-75'
                      }`}
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span
                              className="h-3 w-3 rounded-full"
                              style={{ backgroundColor: template.color || '#C65A38' }}
                              aria-hidden="true"
                            />
                            <p className="font-semibold text-foreground">{template.name}</p>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Due on day {template.due_day_of_month} • {template.category}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <p className="text-base font-semibold text-foreground">{toCurrency(Math.abs(Number(template.amount)))}</p>
                          <button
                            type="button"
                            onClick={() => void toggleBillTemplate(template.id, !template.is_active)}
                            className="btn-soft"
                          >
                            {template.is_active ? 'Disable' : 'Enable'}
                          </button>
                        </div>
                      </div>
                    </article>
                  ))
              ) : (
                <div className="rounded-2xl border border-dashed border-border/80 bg-muted/15 px-4 py-6 text-sm text-muted-foreground">
                  No recurring bills yet. Add the fixed stuff here so the forecast stops depending on memory.
                </div>
              )}
            </div>
          </div>
        </PlannerSection>

        <PlannerSection
          title="Projected income"
          description="Add expected paychecks or deposits so the low-point warnings line up with reality."
          defaultOpen={projectedIncomes.length === 0}
        >
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
            <form
              className="grid gap-3 rounded-2xl border border-border/75 bg-muted/15 p-4"
              onSubmit={(event) => {
                event.preventDefault()
                void onAddProjectedIncome()
              }}
            >
              <h3 className="text-lg font-semibold text-foreground">Add projected income</h3>
              <label className="space-y-2 text-sm">
                <span className="font-medium text-foreground">Expected date</span>
                <input
                  type="date"
                  value={incomeForm.expectedDate}
                  onChange={(event) => setIncomeForm((current) => ({ ...current, expectedDate: event.target.value }))}
                  className="field-control"
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-2 text-sm">
                  <span className="font-medium text-foreground">Amount</span>
                  <input
                    type="number"
                    step="0.01"
                    value={incomeForm.amount}
                    onChange={(event) => setIncomeForm((current) => ({ ...current, amount: event.target.value }))}
                    className="field-control"
                  />
                </label>
                <label className="space-y-2 text-sm">
                  <span className="font-medium text-foreground">Employer</span>
                  <select
                    value={incomeForm.employerId}
                    onChange={(event) => setIncomeForm((current) => ({ ...current, employerId: event.target.value }))}
                    className="field-control"
                  >
                    <option value="">No employer</option>
                    {employers.map((employer) => (
                      <option key={employer.id} value={employer.id}>
                        {employer.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="space-y-2 text-sm">
                <span className="font-medium text-foreground">Description</span>
                <input
                  type="text"
                  value={incomeForm.description}
                  onChange={(event) => setIncomeForm((current) => ({ ...current, description: event.target.value }))}
                  className="field-control"
                  placeholder="Paycheck, bonus, reimbursement..."
                />
              </label>
              <button
                type="submit"
                className="btn-soft bg-primary text-primary-foreground hover:bg-primary/90"
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Add projected income'}
              </button>
            </form>

            <div className="space-y-3">
              {projectedIncomes.length > 0 ? (
                projectedIncomes.map((income) => {
                  const employer = employers.find((entry) => entry.id === income.employer_id)
                  return (
                    <article key={income.id} className="rounded-2xl border border-border/80 bg-card px-4 py-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="space-y-1">
                          <p className="font-semibold text-foreground">
                            {income.description || employer?.name || 'Projected income'}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {format(parseISO(income.expected_date), 'MMM d')} {employer ? `• ${employer.name}` : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <p className="text-base font-semibold text-emerald-700">{toCurrency(Number(income.amount))}</p>
                          <button
                            type="button"
                            onClick={() => void removeProjectedIncome(income.id)}
                            className="btn-soft"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </article>
                  )
                })
              ) : (
                <div className="rounded-2xl border border-dashed border-border/80 bg-muted/15 px-4 py-6 text-sm text-muted-foreground">
                  No projected income yet. Add expected paychecks so the forecast can show whether the month is actually safe.
                </div>
              )}
            </div>
          </div>
        </PlannerSection>
      </section>

      <section className="section-surface px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-muted-foreground">Evidence</p>
            <h2 className="text-2xl font-semibold text-foreground">Detailed daily ledger</h2>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              This is the supporting detail for the forecast above. It stays here when you need to audit the month, not as the first thing you have to decode.
            </p>
          </div>
          <div className="rounded-2xl border border-border/80 bg-muted/35 px-4 py-3 text-sm text-muted-foreground">
            Showing {displayedDays.length} day{displayedDays.length === 1 ? '' : 's'} with activity or today.
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {displayedDays.length > 0 ? (
            displayedDays.map((day) => <DayRow key={day.date} day={day} />)
          ) : (
            <div className="rounded-2xl border border-dashed border-border/80 bg-muted/15 px-4 py-6 text-sm text-muted-foreground">
              No checking activity was found for this month.
            </div>
          )}
        </div>
      </section>
    </section>
  )
}

type DecisionFactProps = {
  label: string
  value: string
  detail: string
  tone?: ForecastTone
}

function DecisionFact({ label, value, detail, tone }: DecisionFactProps) {
  const toneClasses =
    tone === 'risk'
      ? 'border-rose-200 bg-rose-50/70'
      : tone === 'tight'
        ? 'border-amber-200 bg-amber-50/70'
        : 'border-border/80 bg-card/90'

  return (
    <article className={`rounded-2xl border px-3 py-3 shadow-[0_14px_34px_-32px_hsl(var(--foreground)/0.5)] sm:px-4 sm:py-4 ${toneClasses}`}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground sm:text-xs">{label}</p>
      <p className="mt-2 text-lg font-semibold text-foreground sm:mt-3 sm:text-2xl">{value}</p>
      <p className="mt-1.5 hidden text-sm leading-6 text-muted-foreground sm:mt-2 sm:block">{detail}</p>
    </article>
  )
}

type WatchRowProps = {
  label: string
  value: string
  detail: string
  tone?: ForecastTone
}

function WatchRow({ label, value, detail, tone }: WatchRowProps) {
  const accent =
    tone === 'risk'
      ? 'border-l-rose-400'
      : tone === 'tight'
        ? 'border-l-amber-400'
        : tone === 'safe'
          ? 'border-l-emerald-400'
          : 'border-l-border'

  return (
    <article
      className={`rounded-2xl border border-border/80 bg-card/95 px-4 py-4 shadow-[0_16px_34px_-30px_hsl(var(--foreground)/0.4)] border-l-4 ${accent}`}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-base font-semibold text-foreground">{value}</p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{detail}</p>
    </article>
  )
}

type SummaryLineProps = {
  label: string
  value: string
  tone?: 'positive' | 'negative'
}

function SummaryLine({ label, value, tone }: SummaryLineProps) {
  const toneClass = tone === 'positive' ? 'text-emerald-700' : tone === 'negative' ? 'text-rose-700' : 'text-foreground'

  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-border/75 bg-card/95 px-4 py-3">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={`text-base font-semibold ${toneClass}`}>{value}</p>
    </div>
  )
}

type PlannerSectionProps = {
  title: string
  description: string
  children: ReactNode
  action?: ReactNode
  defaultOpen?: boolean
}

function PlannerSection({ title, description, children, action, defaultOpen = false }: PlannerSectionProps) {
  return (
    <details open={defaultOpen} className="section-surface overflow-hidden">
      <summary className="flex cursor-pointer list-none flex-row items-center justify-between gap-4 px-5 py-4 sm:px-6 sm:py-5">
        <div className="space-y-0.5 sm:space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground sm:text-sm">Planner</p>
          <h2 className="text-xl font-semibold text-foreground sm:text-2xl">{title}</h2>
          <p className="hidden max-w-3xl text-sm leading-6 text-muted-foreground sm:block">{description}</p>
        </div>
        <span className="shrink-0 rounded-full border border-border/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
          Expand
        </span>
      </summary>
      <div className="border-t border-border/70 px-5 py-5 sm:px-6">
        {action ? <div className="mb-4 flex justify-end">{action}</div> : null}
        {children}
      </div>
    </details>
  )
}

type RunwayDayRowProps = {
  day: CashFlowLedgerDay
  threshold: number
}

function RunwayDayRow({ day, threshold }: RunwayDayRowProps) {
  const belowThreshold = day.runningBalance <= threshold

  return (
    <article
      className={`rounded-2xl border px-4 py-4 shadow-[0_16px_38px_-32px_hsl(var(--foreground)/0.4)] ${
        day.isToday
          ? 'border-primary/30 bg-primary/5'
          : belowThreshold
            ? 'border-amber-200 bg-amber-50/65'
            : 'border-border/80 bg-card/95'
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-lg font-semibold text-foreground">{format(parseISO(day.date), 'EEE, MMM d')}</p>
            {day.isToday ? (
              <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
                Today
              </span>
            ) : null}
            {day.isProjected ? (
              <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Forecast
              </span>
            ) : null}
            {belowThreshold ? (
              <span className="rounded-full bg-amber-200/70 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-950">
                Under floor
              </span>
            ) : null}
          </div>

          {day.entries.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {day.entries.map((entry) => (
                <span
                  key={entry.id}
                  className={`max-w-[calc(100vw-8rem)] truncate rounded-full border px-2.5 py-0.5 text-xs font-medium sm:max-w-none sm:px-3 sm:py-1 ${
                    entry.amount > 0 ? 'border-emerald-200 bg-emerald-50' : 'border-border/80 bg-muted/35'
                  } ${entryTone(entry)}`}
                  title={`${entryLabel(entry)}: ${entry.description} (${toSignedCurrency(entry.amount)})`}
                >
                  {entryLabel(entry)}: {entry.description} ({toSignedCurrency(entry.amount)})
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No new entries. Balance only changes if earlier projections already landed.</p>
          )}
        </div>

        <div className="min-w-[11rem] rounded-2xl border border-border/75 bg-card/80 px-4 py-3 text-left sm:text-right">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Ending balance</p>
          <p className={`mt-2 text-2xl font-semibold ${belowThreshold ? 'text-amber-950' : 'text-foreground'}`}>
            {toCurrency(day.runningBalance)}
          </p>
          <p className={`mt-2 text-sm ${day.dayTotal >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
            {day.dayTotal >= 0 ? 'Up' : 'Down'} {toCurrency(Math.abs(day.dayTotal))} that day
          </p>
        </div>
      </div>
    </article>
  )
}
