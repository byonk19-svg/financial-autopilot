type ClassificationRulesHeaderProps = {
  activeCount: number
  totalCount: number
}

export function ClassificationRulesHeader({ activeCount, totalCount }: ClassificationRulesHeaderProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <h1 className="text-2xl font-semibold text-foreground">Classification Rules</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Auto-apply recurring classifications by merchant, cadence, and optional amount range.
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        {activeCount} active of {totalCount} total rules
      </p>
    </div>
  )
}
