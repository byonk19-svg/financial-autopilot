import { format, parseISO } from 'date-fns'
import RunningBalance from '@/components/cash-flow/RunningBalance'
import TransactionChip from '@/components/cash-flow/TransactionChip'
import type { CashFlowLedgerDay } from '@/lib/types'

type DayRowProps = {
  day: CashFlowLedgerDay
}

export default function DayRow({ day }: DayRowProps) {
  const dateLabel = format(parseISO(day.date), 'EEE M/d')

  if (day.entries.length === 0 && !day.isToday) return null

  return (
    <article
      className={`grid gap-3 rounded-lg border px-3 py-3 sm:grid-cols-[88px_1fr_160px] sm:items-start ${
        day.isToday ? 'border-primary/40 bg-primary/5' : 'border-border bg-card'
      }`}
    >
      <div className="space-y-1">
        <p className={`text-sm font-semibold ${day.isProjected ? 'text-muted-foreground' : 'text-foreground'}`}>{dateLabel}</p>
        {day.isToday ? (
          <span className="inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
            Today
          </span>
        ) : null}
      </div>

      <div className="space-y-2">
        {day.entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No entries</p>
        ) : (
          day.entries.map((entry) => <TransactionChip key={entry.id} entry={entry} />)
        )}
      </div>

      <div className="space-y-1 text-left sm:text-right">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Running balance</p>
        <RunningBalance
          balance={day.runningBalance}
          isProjected={day.isProjected}
          isBelowThreshold={day.isBelowThreshold}
        />
      </div>
    </article>
  )
}
