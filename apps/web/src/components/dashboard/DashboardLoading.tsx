export function DashboardLoading() {
  return (
    <main className="rounded-xl border border bg-card p-6 shadow-sm" aria-live="polite" aria-busy="true">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 animate-pulse rounded-lg bg-primary/20" />
        <div className="w-full space-y-2">
          <div className="h-4 w-52 animate-pulse rounded bg-muted" />
          <div className="h-3 w-72 animate-pulse rounded bg-muted/70" />
        </div>
      </div>
      <div className="mt-6 space-y-3">
        <div className="h-3 w-full animate-pulse rounded bg-muted/70" />
        <div className="h-3 w-5/6 animate-pulse rounded bg-muted/70" />
        <div className="h-3 w-2/3 animate-pulse rounded bg-muted/70" />
      </div>
    </main>
  )
}
