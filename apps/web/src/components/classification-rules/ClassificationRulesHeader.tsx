type ClassificationRulesHeaderProps = {
  activeCount: number
  totalCount: number
}

export function ClassificationRulesHeader({ activeCount, totalCount }: ClassificationRulesHeaderProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <h1 className="text-2xl font-semibold text-foreground">Recurring Rules</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Rules that control how recurring charges are classified — whether a pattern is treated as a subscription, bill/loan, or transfer.
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        {activeCount} active of {totalCount} total rules
      </p>
    </div>
  )
}
