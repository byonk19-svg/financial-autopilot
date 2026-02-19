import type { CashFlowLedgerEntry } from '@/lib/types'

type TransactionChipProps = {
  entry: CashFlowLedgerEntry
}

export default function TransactionChip({ entry }: TransactionChipProps) {
  const isIncome = entry.amount > 0

  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-card px-2 py-1.5">
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-foreground">
          {entry.description}
          {entry.isProjected ? ' (est.)' : ''}
        </p>
        <p className="text-[11px] text-muted-foreground">{entry.category}</p>
      </div>
      <p className={`shrink-0 text-xs font-semibold ${isIncome ? 'text-emerald-700' : 'text-rose-700'}`}>
        {isIncome ? '+' : '-'}${Math.abs(entry.amount).toFixed(2)}
      </p>
    </div>
  )
}
