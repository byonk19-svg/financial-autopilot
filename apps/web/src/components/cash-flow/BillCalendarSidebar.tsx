import { format, parseISO } from 'date-fns'
import type { CashFlowLedgerEntry } from '@/lib/types'

type BillCalendarSidebarProps = {
  bills: CashFlowLedgerEntry[]
}

export default function BillCalendarSidebar({ bills }: BillCalendarSidebarProps) {
  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Bills this month</h2>
      <div className="mt-3 space-y-2">
        {bills.length === 0 ? (
          <p className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
            No recurring bills configured.
          </p>
        ) : (
          bills.map((bill) => (
            <div key={bill.id} className="flex items-center justify-between rounded-lg border border-border bg-muted/20 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{bill.description}</p>
                <p className="text-xs text-muted-foreground">{format(parseISO(bill.date), 'EEE, MMM d')}</p>
              </div>
              <p className="text-sm font-semibold text-rose-700">${Math.abs(bill.amount).toFixed(2)}</p>
            </div>
          ))
        )}
      </div>
    </section>
  )
}
