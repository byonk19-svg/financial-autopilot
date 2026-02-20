type ClassificationRulesHeaderProps = {
  activeCount: number
  totalCount: number
}

export function ClassificationRulesHeader({ activeCount, totalCount }: ClassificationRulesHeaderProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <h1 className="text-2xl font-semibold text-foreground">Auto-Rules</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Rules applied automatically at sync time — categorize recurring charges by merchant, cadence, and amount.
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        {activeCount} active of {totalCount} total rules
      </p>
    </div>
  )
}
