import { format } from 'date-fns'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BillCalendarSidebar from '@/components/cash-flow/BillCalendarSidebar'
import DayRow from '@/components/cash-flow/DayRow'
import MonthSummary from '@/components/cash-flow/MonthSummary'
import ProjectedWarning from '@/components/cash-flow/ProjectedWarning'
import { useCashFlow } from '@/hooks/useCashFlow'
import { getLoginRedirectPath } from '@/lib/loginRedirect'
import { useSession } from '@/lib/session'

function toCurrency(value: number): string {
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
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
    color: '#DC2626',
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

  const displayedDays = useMemo(() => ledger.filter((day) => day.entries.length > 0 || day.isToday), [ledger])
  const monthLabel = useMemo(() => format(monthDate, 'MMMM yyyy'), [monthDate])

  const onSaveMonthSettings = useCallback(async () => {
    const parsedOpening = Number(openingBalanceDraft)
    const parsedThreshold = Number(lowThresholdDraft)
    await saveMonthSettings(Number.isFinite(parsedOpening) ? parsedOpening : 0, Number.isFinite(parsedThreshold) ? parsedThreshold : 0)
  }, [lowThresholdDraft, openingBalanceDraft, saveMonthSettings])

  const onAddBill = useCallback(async () => {
    const parsedAmount = Number(billForm.amount)
    const parsedDueDay = Number(billForm.dueDay)
    const added = await addBillTemplate({
      name: billForm.name,
      amount: Number.isFinite(parsedAmount) ? parsedAmount : 0,
      dueDayOfMonth: Number.isFinite(parsedDueDay) ? parsedDueDay : 1,
      category: billForm.category,
      color: billForm.color || '#DC2626',
    })
    if (added) {
      setBillForm({
        name: '',
        amount: '',
        dueDay: '',
        category: 'bill',
        color: '#DC2626',
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

  return (
    <section className="space-y-6">
      <div className="page-hero">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Cash Flow</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Daily running bank balance with projected bills and income.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                clearMessages()
                goToPreviousMonth()
              }}
              className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition-colors-fast hover:bg-accent hover:text-foreground"
            >
              Prev
            </button>
            <input
              type="month"
              value={selectedMonth}
              onChange={(event) => {
                clearMessages()
                setMonthFromInput(event.target.value)
              }}
              className="field-control"
            />
            <button
              type="button"
              onClick={() => {
                clearMessages()
                goToNextMonth()
              }}
              className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition-colors-fast hover:bg-accent hover:text-foreground"
            >
              Next
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
          <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
            <div className="flex items-center gap-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Opening balance</p>
              {isBalanceInferred && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                  Auto
                </span>
              )}
            </div>
            <p className="mt-1 text-lg font-semibold text-foreground">{toCurrency(openingBalance)}</p>
            {isBalanceInferred && (
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Estimated from synced account balance
              </p>
            )}
          </div>
          <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Current month</p>
            <p className="mt-1 text-lg font-semibold text-foreground">{monthLabel}</p>
          </div>
          <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Low balance alert</p>
            <p className="mt-1 text-lg font-semibold text-foreground">{toCurrency(lowBalanceThreshold)}</p>
          </div>
        </div>

        {error ? <div className="mt-4 rounded-lg border border-red-200 bg-red-50/80 px-3 py-2 text-sm text-red-700">{error}</div> : null}
        {success ? (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-sm text-emerald-700">{success}</div>
        ) : null}
      </div>

      <ProjectedWarning lowPoints={lowPoints} />

      <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <div className="space-y-4">
          <section className="section-surface p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Day-by-day ledger</h2>
            <div className="mt-3 space-y-2">
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading ledger...</p>
              ) : displayedDays.length === 0 ? (
                <p className="rounded-lg border border-border bg-muted/20 px-3 py-6 text-center text-sm text-muted-foreground">
                  No entries found for this month.
                </p>
              ) : (
                displayedDays.map((day) => <DayRow key={day.date} day={day} />)
              )}
            </div>
          </section>

          <MonthSummary summary={summary} />
        </div>

        <div className="space-y-4">
          <BillCalendarSidebar bills={billsThisMonth} />

          <section className="section-surface p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Month settings</h2>
            <div className="mt-3 space-y-2">
              <label className="space-y-1 text-sm">
                <span className="text-muted-foreground">Opening balance</span>
                <input
                  type="number"
                  step="0.01"
                  value={openingBalanceDraft}
                  onChange={(event) => setOpeningBalanceDraft(event.target.value)}
                  className="field-control"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-muted-foreground">Low balance threshold</span>
                <input
                  type="number"
                  step="0.01"
                  value={lowThresholdDraft}
                  onChange={(event) => setLowThresholdDraft(event.target.value)}
                  className="field-control"
                />
              </label>
              <button
                type="button"
                onClick={() => {
                  void onSaveMonthSettings()
                }}
                disabled={saving}
                className="w-full rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition-colors-fast hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Save month settings
              </button>
            </div>
          </section>

          <section className="section-surface p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Add recurring bill</h2>
            <div className="mt-3 grid gap-2">
              <label htmlFor="cash-flow-bill-name" className="space-y-1 text-sm">
                <span className="text-muted-foreground">Bill name</span>
                <input
                  id="cash-flow-bill-name"
                  value={billForm.name}
                  onChange={(event) => setBillForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Bill name"
                  className="field-control"
                />
              </label>
              <div className="grid gap-2 sm:grid-cols-2">
                <label htmlFor="cash-flow-bill-amount" className="space-y-1 text-sm">
                  <span className="text-muted-foreground">Amount</span>
                  <input
                    id="cash-flow-bill-amount"
                    type="number"
                    step="0.01"
                    value={billForm.amount}
                    onChange={(event) => setBillForm((current) => ({ ...current, amount: event.target.value }))}
                    placeholder="Amount"
                    className="field-control"
                  />
                </label>
                <label htmlFor="cash-flow-bill-due-day" className="space-y-1 text-sm">
                  <span className="text-muted-foreground">Due day (1-31)</span>
                  <input
                    id="cash-flow-bill-due-day"
                    type="number"
                    min="1"
                    max="31"
                    value={billForm.dueDay}
                    onChange={(event) => setBillForm((current) => ({ ...current, dueDay: event.target.value }))}
                    placeholder="Due day (1-31)"
                    className="field-control"
                  />
                </label>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <label htmlFor="cash-flow-bill-category" className="space-y-1 text-sm">
                  <span className="text-muted-foreground">Category</span>
                  <select
                    id="cash-flow-bill-category"
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
                <label htmlFor="cash-flow-bill-color" className="space-y-1 text-sm">
                  <span className="text-muted-foreground">Color</span>
                  <input
                    id="cash-flow-bill-color"
                    type="color"
                    value={billForm.color}
                    onChange={(event) => setBillForm((current) => ({ ...current, color: event.target.value }))}
                    className="h-[42px] w-full rounded-lg border border-input bg-card p-1"
                  />
                </label>
              </div>
              <button
                type="button"
                onClick={() => {
                  void onAddBill()
                }}
                disabled={saving || !billForm.name.trim() || !billForm.amount || !billForm.dueDay}
                className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition-colors-fast hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
              >
                Add recurring bill
              </button>
            </div>

            {billTemplates.length > 0 ? (
              <div className="mt-3 space-y-2 rounded-lg border border-border bg-muted/20 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Configured bills</p>
                {billTemplates.map((template) => (
                  <div key={template.id} className="flex items-center justify-between gap-2 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">{template.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Day {template.due_day_of_month} - {toCurrency(Math.abs(Number(template.amount)))}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        void toggleBillTemplate(template.id, !template.is_active)
                      }}
                      className="min-h-11 rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition-colors-fast hover:bg-accent hover:text-foreground md:min-h-9 md:px-2.5 md:py-1.5 md:text-xs"
                    >
                      {template.is_active ? 'Disable' : 'Enable'}
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </section>

          <section className="section-surface p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Add projected income</h2>
            <div className="mt-3 grid gap-2">
              <label htmlFor="cash-flow-income-date" className="space-y-1 text-sm">
                <span className="text-muted-foreground">Expected date</span>
                <input
                  id="cash-flow-income-date"
                  type="date"
                  value={incomeForm.expectedDate}
                  onChange={(event) => setIncomeForm((current) => ({ ...current, expectedDate: event.target.value }))}
                  className="field-control"
                />
              </label>
              <label htmlFor="cash-flow-income-amount" className="space-y-1 text-sm">
                <span className="text-muted-foreground">Amount</span>
                <input
                  id="cash-flow-income-amount"
                  type="number"
                  step="0.01"
                  value={incomeForm.amount}
                  onChange={(event) => setIncomeForm((current) => ({ ...current, amount: event.target.value }))}
                  placeholder="Amount"
                  className="field-control"
                />
              </label>
              <label htmlFor="cash-flow-income-description" className="space-y-1 text-sm">
                <span className="text-muted-foreground">Description</span>
                <input
                  id="cash-flow-income-description"
                  value={incomeForm.description}
                  onChange={(event) => setIncomeForm((current) => ({ ...current, description: event.target.value }))}
                  placeholder="Description"
                  className="field-control"
                />
              </label>
              <label htmlFor="cash-flow-income-employer" className="space-y-1 text-sm">
                <span className="text-muted-foreground">Employer</span>
                <select
                  id="cash-flow-income-employer"
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
              <button
                type="button"
                onClick={() => {
                  void onAddProjectedIncome()
                }}
                disabled={saving || !incomeForm.expectedDate || !incomeForm.amount || !incomeForm.description.trim()}
                className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition-colors-fast hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
              >
                Add projected income
              </button>
            </div>

            {projectedIncomes.length > 0 ? (
              <div className="mt-3 space-y-2 rounded-lg border border-border bg-muted/20 p-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Projected entries</p>
                {projectedIncomes.map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between gap-2 text-sm">
                    <div>
                      <p className="font-medium text-foreground">
                        {entry.expected_date} - {toCurrency(Number(entry.amount))}
                      </p>
                      <p className="text-xs text-muted-foreground">{entry.description}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        void removeProjectedIncome(entry.id)
                      }}
                      className="min-h-11 rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition-colors-fast hover:bg-accent hover:text-foreground md:min-h-9 md:px-2.5 md:py-1.5 md:text-xs"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </section>
  )
}
