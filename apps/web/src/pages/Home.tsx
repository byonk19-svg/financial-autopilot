import { Link } from 'react-router-dom'

export default function Home() {
  return (
    <section className="space-y-5">
      <div className="rounded-2xl bg-gradient-to-br from-primary to-primary/70 p-10 shadow-lg">
        <h1 className="text-4xl font-bold tracking-tight text-primary-foreground">Financial Autopilot</h1>
        <p className="mt-3 text-lg text-primary-foreground/90">Automate your personal finance workflows.</p>
        <Link
          to="/login"
          className="mt-6 inline-flex rounded-lg bg-card px-4 py-2 text-sm font-semibold text-foreground shadow-sm transition-colors-fast hover:bg-card/90"
        >
          Get Started
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-xl border border bg-card p-5 shadow-sm">
          <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-primary" aria-hidden="true">
            <path d="M3 10h18M7 15h3M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <h2 className="mt-3 text-base font-semibold text-foreground">Bank Sync</h2>
          <p className="mt-1 text-sm text-muted-foreground">Automatic transaction syncing.</p>
        </article>

        <article className="rounded-xl border border bg-card p-5 shadow-sm">
          <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-primary" aria-hidden="true">
            <path d="M4 16 10 10l4 4 6-7M20 7h-4v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <h2 className="mt-3 text-base font-semibold text-foreground">Smart Detection</h2>
          <p className="mt-1 text-sm text-muted-foreground">AI-powered recurring charge detection.</p>
        </article>

        <article className="rounded-xl border border bg-card p-5 shadow-sm">
          <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-primary" aria-hidden="true">
            <path d="M12 4 3.5 19h17L12 4Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M12 9v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            <circle cx="12" cy="15.8" r="0.8" fill="currentColor" />
          </svg>
          <h2 className="mt-3 text-base font-semibold text-foreground">Alerts</h2>
          <p className="mt-1 text-sm text-muted-foreground">Unusual charge notifications.</p>
        </article>

        <article className="rounded-xl border border bg-card p-5 shadow-sm">
          <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-primary" aria-hidden="true">
            <path d="M9 18h6M10 21h4M8.8 14.5c-1.5-1-2.3-2.7-2.3-4.6A5.5 5.5 0 0 1 12 4.5a5.5 5.5 0 0 1 5.5 5.4c0 1.9-.8 3.6-2.3 4.6-.8.6-1.2 1.2-1.3 2H10c-.1-.8-.5-1.4-1.2-2Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <h2 className="mt-3 text-base font-semibold text-foreground">Insights</h2>
          <p className="mt-1 text-sm text-muted-foreground">Weekly AI financial insights.</p>
        </article>
      </div>
    </section>
  )
}
