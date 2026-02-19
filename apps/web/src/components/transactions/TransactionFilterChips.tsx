import type { TransactionFilterChip } from '@/hooks/useTransactionFilterChips'

type TransactionFilterChipsProps = {
  chips: TransactionFilterChip[]
  onRemoveChip: (key: TransactionFilterChip['key']) => void
  onClearAll: () => void
}

export function TransactionFilterChips({ chips, onRemoveChip, onClearAll }: TransactionFilterChipsProps) {
  if (chips.length === 0) return null

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={() => onRemoveChip(chip.key)}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/60 px-3 py-1 text-xs font-medium text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`Remove ${chip.label} filter`}
        >
          <span className="truncate max-w-[20rem]">{chip.label}</span>
          <span aria-hidden="true" className="text-muted-foreground">
            x
          </span>
        </button>
      ))}

      <button
        type="button"
        onClick={onClearAll}
        className="text-xs font-medium text-primary transition hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm px-1.5 py-1"
      >
        Clear all
      </button>
    </div>
  )
}
