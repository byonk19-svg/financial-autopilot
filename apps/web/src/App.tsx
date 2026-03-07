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

  const navItemClass = (to: string): string =>
    `inline-flex rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors-fast ${
      isActive(to) ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
    }`

  const onNavClick = () => {
    setMobileNavOpen(false)
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex items-center gap-4">
            <Link to="/" onClick={onNavClick} className="inline-flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
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
              <p className="text-sm font-semibold leading-none text-foreground sm:text-base">Financial Autopilot</p>
            </Link>

            <nav className="hidden items-center lg:flex" aria-label="Primary">
              {navGroups.map((group, index) => (
                <div key={group.label} className="flex items-center">
                  {index > 0 && <div className="mx-2 h-4 w-px bg-border" aria-hidden="true" />}
                  <div className="flex items-center gap-1">
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
                className="hidden rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors-fast hover:bg-accent hover:text-foreground sm:inline-flex"
              >
                Log in
              </Link>
            )}
            {session && (
              <button
                onClick={onSignOut}
                className="hidden rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors-fast hover:bg-accent hover:text-foreground sm:inline-flex"
              >
                Sign out
              </button>
            )}

            <button
              type="button"
              className="inline-flex items-center rounded-lg border border-border px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors-fast hover:bg-accent hover:text-foreground lg:hidden"
              onClick={() => setMobileNavOpen((current) => !current)}
              aria-label="Toggle navigation menu"
              aria-expanded={mobileNavOpen}
            >
              {mobileNavOpen ? 'Close' : 'Menu'}
            </button>
          </div>
        </div>

        {mobileNavOpen && (
          <div className="border-t border-border bg-card lg:hidden">
            <nav className="mx-auto max-w-7xl space-y-4 px-4 py-3 sm:px-6 sm:py-4" aria-label="Mobile navigation">
              {navGroups.map((group) => (
                <section key={group.label}>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.label}</p>
                  <div className="flex flex-col gap-1">
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
                    className="inline-flex w-full rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors-fast hover:bg-accent hover:text-foreground"
                  >
                    Sign out
                  </button>
                ) : (
                  <Link
                    to="/login"
                    onClick={onNavClick}
                    className="inline-flex w-full rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors-fast hover:bg-accent hover:text-foreground"
                  >
                    Log in
                  </Link>
                )}
              </div>
            </nav>
          </div>
        )}
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
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
