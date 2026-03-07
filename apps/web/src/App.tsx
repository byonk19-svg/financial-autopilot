import { useState } from 'react'
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import ErrorBoundary from './components/ErrorBoundary'
import Alerts from './pages/Alerts'
import CashFlow from './pages/CashFlow'
import ClassificationRules from './pages/ClassificationRules'
import Connect from './pages/Connect'
import Dashboard from './pages/Dashboard'
import Home from './pages/Home'
import Login from './pages/Login'
import Overview from './pages/Overview'
import Rules from './pages/Rules'
import Settings from './pages/Settings'
import ShiftLog from './pages/ShiftLog'
import Subscriptions from './pages/Subscriptions'
import Transactions from './pages/Transactions'
import { captureException } from './lib/errorReporting'
import { useSession } from './lib/session'
import { supabase } from './lib/supabase'

type NavItem = { to: string; label: string }
type NavGroup = { label: string; items: NavItem[] }

const navGroups: NavGroup[] = [
  {
    label: 'Main',
    items: [
      { to: '/', label: 'Dashboard' },
      { to: '/transactions', label: 'Transactions' },
      { to: '/cash-flow', label: 'Cash Flow' },
      { to: '/overview', label: 'Accounts' },
    ],
  },
  {
    label: 'Automation',
    items: [
      { to: '/subscriptions', label: 'Recurring' },
      { to: '/alerts', label: 'Alerts' },
    ],
  },
  {
    label: 'Config',
    items: [
      { to: '/rules', label: 'Rules' },
      { to: '/classification-rules', label: 'Recurring Rules' },
      { to: '/shift-log', label: 'Shift Log' },
      { to: '/settings', label: 'Settings' },
    ],
  },
]

export default function App() {
  const location = useLocation()
  const { session } = useSession()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const navItems = navGroups.flatMap((group) => group.items)

  const onSignOut = async () => {
    try {
      await supabase.auth.signOut()
      window.location.assign('/login')
    } catch (error) {
      captureException(error, {
        component: 'App',
        action: 'sign-out',
      })
    }
  }

  const isActive = (to: string): boolean => {
    if (to === '/') return location.pathname === '/'
    return location.pathname.startsWith(to)
  }

  const currentPageLabel = (
    navItems
      .filter((item) => isActive(item.to))
      .sort((a, b) => b.to.length - a.to.length)[0]?.label ?? 'Dashboard'
  )

  const navItemClass = (to: string): string =>
    `inline-flex rounded-lg px-2.5 py-1.5 text-sm font-semibold transition-colors-fast ${
      isActive(to)
        ? 'bg-primary text-primary-foreground shadow-[0_10px_24px_-14px_hsl(var(--primary)/0.9)]'
        : 'text-muted-foreground hover:bg-accent/70 hover:text-foreground'
    }`

  const onNavClick = () => {
    setMobileNavOpen(false)
  }

  return (
    <div className="relative min-h-screen text-foreground">
      <div className="app-grid-bg pointer-events-none fixed inset-0 -z-10 opacity-[0.12]" aria-hidden="true" />
      <header className="sticky top-0 z-40 border-b border-border/80 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-[1280px] items-center justify-between gap-4 px-4 py-3 sm:px-6 sm:py-4 lg:px-8">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <Link to="/" onClick={onNavClick} className="inline-flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-[0_10px_22px_-12px_hsl(var(--primary)/0.9)]">
                <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <path
                    d="M12 4V20M16 7.5C16 6.12 14.21 5 12 5C9.79 5 8 6.12 8 7.5C8 8.88 9.79 10 12 10C14.21 10 16 11.12 16 12.5C16 13.88 14.21 15 12 15C9.79 15 8 13.88 8 12.5"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-extrabold leading-none text-foreground sm:text-base">Financial Autopilot</p>
                <p className="mt-1 hidden text-[11px] font-medium text-muted-foreground sm:block">
                  Professional household finance cockpit
                </p>
              </div>
            </Link>

            <div className="hidden min-w-0 xl:block">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Workspace</p>
              <p className="truncate text-sm font-semibold text-foreground">{currentPageLabel}</p>
            </div>

            <nav className="hidden items-center gap-2 xl:flex" aria-label="Primary">
              {navGroups.map((group, index) => (
                <div key={group.label} className="flex items-center">
                  {index > 0 && <div className="mx-1 h-5 w-px bg-border/80" aria-hidden="true" />}
                  <div className="glass-panel flex items-center gap-1 rounded-xl px-2 py-1">
                    <span className="px-1 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                      {group.label}
                    </span>
                    {group.items.map((item) => (
                      <Link key={item.to} to={item.to} className={navItemClass(item.to)}>
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-2">
            {!session && (
              <Link
                to="/login"
                className="hidden rounded-lg border border-border bg-card/90 px-3 py-1.5 text-sm font-semibold text-muted-foreground transition-colors-fast hover:bg-accent/70 hover:text-foreground sm:inline-flex"
              >
                Log in
              </Link>
            )}
            {session && (
              <button
                onClick={onSignOut}
                className="hidden rounded-lg border border-border bg-card/90 px-3 py-1.5 text-sm font-semibold text-muted-foreground transition-colors-fast hover:bg-accent/70 hover:text-foreground sm:inline-flex"
              >
                Sign out
              </button>
            )}

            <button
              type="button"
              className="inline-flex items-center rounded-lg border border-border bg-card/90 px-2.5 py-1.5 text-sm font-semibold text-muted-foreground transition-colors-fast hover:bg-accent/70 hover:text-foreground xl:hidden"
              onClick={() => setMobileNavOpen((current) => !current)}
              aria-label="Toggle navigation menu"
              aria-expanded={mobileNavOpen}
            >
              {mobileNavOpen ? 'Close' : 'Menu'}
            </button>
          </div>
        </div>

        {mobileNavOpen && (
          <div className="border-t border-border/80 bg-background/95 xl:hidden">
            <nav className="mx-auto max-w-[1280px] space-y-4 px-4 py-3 sm:px-6 sm:py-4 lg:px-8" aria-label="Mobile navigation">
              {navGroups.map((group) => (
                <section key={group.label}>
                  <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">{group.label}</p>
                  <div className="glass-panel flex flex-col gap-1 rounded-xl p-1.5">
                    {group.items.map((item) => (
                      <Link key={item.to} to={item.to} onClick={onNavClick} className={navItemClass(item.to)}>
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </section>
              ))}

              <div className="border-t border-border pt-3">
                {session ? (
                  <button
                    onClick={async () => {
                      setMobileNavOpen(false)
                      await onSignOut()
                    }}
                    className="inline-flex w-full rounded-lg border border-border bg-card/90 px-3 py-1.5 text-sm font-semibold text-muted-foreground transition-colors-fast hover:bg-accent/70 hover:text-foreground"
                  >
                    Sign out
                  </button>
                ) : (
                  <Link
                    to="/login"
                    onClick={onNavClick}
                    className="inline-flex w-full rounded-lg border border-border bg-card/90 px-3 py-1.5 text-sm font-semibold text-muted-foreground transition-colors-fast hover:bg-accent/70 hover:text-foreground"
                  >
                    Log in
                  </Link>
                )}
              </div>
            </nav>
          </div>
        )}
      </header>

      <main className="mx-auto w-full max-w-[1280px] px-4 pb-10 pt-6 sm:px-6 sm:pt-8 lg:px-8">
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/home" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/connect" element={<Connect />} />
            <Route path="/dashboard" element={<Navigate to="/" replace />} />
            <Route path="/subscriptions" element={<Subscriptions />} />
            <Route path="/classification-rules" element={<ClassificationRules />} />
            <Route path="/alerts" element={<Alerts />} />
            <Route path="/overview" element={<Overview />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/cash-flow" element={<CashFlow />} />
            <Route path="/shift-log" element={<ShiftLog />} />
            <Route path="/rules" element={<Rules />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ErrorBoundary>
      </main>
    </div>
  )
}
