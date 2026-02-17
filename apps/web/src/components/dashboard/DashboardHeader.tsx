import { RefreshIcon } from '@/components/dashboard/DashboardIcons'

type DashboardHeaderProps = {
  syncing: boolean
  message: string
  error: string
  onSyncNow: () => void
}

export function DashboardHeader({ syncing, message, error, onSyncNow }: DashboardHeaderProps) {
  return (
    <section aria-labelledby="dashboard-heading" className="rounded-xl border border bg-card p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 id="dashboard-heading" className="text-2xl font-semibold text-foreground">
            Financial Autopilot
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">Automation-ready dashboard and weekly insight feed.</p>
        </div>
        <button
          onClick={onSyncNow}
          disabled={syncing}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-colors-fast hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshIcon className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Syncing...' : 'Sync now'}
        </button>
      </div>
      {message && (
        <div
          className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-sm text-emerald-700"
          role="status"
          aria-live="polite"
        >
          {message}
        </div>
      )}
      {error && (
        <div
          className="mt-3 rounded-lg border border-red-200 bg-red-50/80 px-3 py-2 text-sm text-red-700"
          role="alert"
          aria-live="polite"
        >
          {error}
        </div>
      )}
    </section>
  )
}
