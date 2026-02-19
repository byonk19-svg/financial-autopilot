import type { CashFlowSummary } from '@/hooks/useCashFlow'

type MonthSummaryProps = {
  summary: CashFlowSummary
}

export default function MonthSummary({ summary }: MonthSummaryProps) {
  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Month summary</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Income</p>
          <p className="mt-1 text-lg font-semibold text-emerald-700">${summary.incomeTotal.toFixed(2)}</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Expenses</p>
          <p className="mt-1 text-lg font-semibold text-rose-700">${summary.expenseTotal.toFixed(2)}</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Net</p>
          <p className={`mt-1 text-lg font-semibold ${summary.netTotal >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
            ${summary.netTotal.toFixed(2)}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Projected income</p>
          <p className="mt-1 text-base font-semibold text-emerald-700">${summary.projectedIncome.toFixed(2)}</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Projected bills</p>
          <p className="mt-1 text-base font-semibold text-rose-700">${summary.projectedExpense.toFixed(2)}</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Lowest projected balance</p>
          <p className="mt-1 text-base font-semibold text-foreground">
            ${summary.lowestBalance.toFixed(2)}
            {summary.lowestBalanceDate ? ` on ${summary.lowestBalanceDate}` : ''}
          </p>
        </div>
      </div>
    </section>
  )
}
