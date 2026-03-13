import { Link } from 'react-router-dom'

export default function Home() {
  return (
    <section className="mx-auto w-full max-w-6xl space-y-6">
      <div className="page-hero bg-gradient-to-br from-[hsl(var(--primary)/0.14)] via-card to-[hsl(var(--accent)/0.1)]">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Household Finance, Simplified</p>
        <h1 className="mt-2 max-w-[18ch] text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
          Financial Autopilot
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base">
          Keep spending clear, cash flow predictable, and recurring charges under control without maintaining messy spreadsheets.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Link to="/login" className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors-fast hover:bg-primary/90">
            Open dashboard
          </Link>
          <Link to="/connect" className="btn-soft px-4 py-2.5 font-semibold">
            Connect bank first
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <article className="section-surface p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Step 1</p>
          <h2 className="mt-2 text-lg font-semibold text-foreground">Sync your accounts</h2>
          <p className="mt-2 text-sm text-muted-foreground">Pull checking and credit activity from SimpleFIN in one place.</p>
        </article>
        <article className="section-surface p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Step 2</p>
          <h2 className="mt-2 text-lg font-semibold text-foreground">Teach categories once</h2>
          <p className="mt-2 text-sm text-muted-foreground">Use Fix Everywhere to apply category logic to past and future transactions.</p>
        </article>
        <article className="section-surface p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Step 3</p>
          <h2 className="mt-2 text-lg font-semibold text-foreground">Act on alerts weekly</h2>
          <p className="mt-2 text-sm text-muted-foreground">Review unusual charges, renewals, and pace warnings before they become surprises.</p>
        </article>
      </div>
    </section>
  )
}
