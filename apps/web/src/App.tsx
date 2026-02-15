import { useState } from 'react'
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import Connect from './pages/Connect'
import Dashboard from './pages/Dashboard'
import Alerts from './pages/Alerts'
import ClassificationRules from './pages/ClassificationRules'
import Home from './pages/Home'
import Login from './pages/Login'
import Overview from './pages/Overview'
import Rules from './pages/Rules'
import Subscriptions from './pages/Subscriptions'
import Transactions from './pages/Transactions'
import { supabase } from './lib/supabase'
import { useSession } from './lib/session'

const navGroups = [
  {
    label: 'Main',
    links: [
      { to: '/', label: 'Dashboard' },
      { to: '/overview', label: 'Overview' },
      { to: '/transactions', label: 'Transactions' },
    ],
  },
  {
    label: 'Automation',
    links: [
      { to: '/subscriptions', label: 'Subscriptions' },
      { to: '/alerts', label: 'Alerts' },
    ],
  },
  {
    label: 'Config',
    links: [
      { to: '/rules', label: 'Rules' },
      { to: '/classification-rules', label: 'Class Rules' },
      { to: '/connect', label: 'Connect' },
    ],
  },
]

const allLinks = navGroups.flatMap((group) => group.links)

export default function App() {
  const { session } = useSession()
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const onSignOut = async () => {
    await supabase.auth.signOut()
    window.location.assign('/login')
  }

  const isActive = (to: string) => {
    if (to === '/') return location.pathname === '/'
    return location.pathname.startsWith(to)
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            </div>
            <span className="text-base font-bold tracking-tight text-foreground">
              Financial Autopilot
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-1 lg:flex">
            {navGroups.map((group, groupIndex) => (
              <div key={group.label} className="flex items-center">
                {groupIndex > 0 && (
                  <div className="mx-2 h-4 w-px bg-border" />
                )}
                {group.links.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors-fast ${
                      isActive(link.to)
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                    }`}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            {session && (
              <button
                onClick={onSignOut}
                className="hidden rounded-md border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors-fast hover:bg-accent hover:text-foreground sm:inline-flex"
              >
                Sign out
              </button>
            )}

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileMenuOpen((open) => !open)}
              className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground lg:hidden"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="4" y1="6" x2="20" y2="6" />
                  <line x1="4" y1="12" x2="20" y2="12" />
                  <line x1="4" y1="18" x2="20" y2="18" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <nav className="border-t bg-card px-4 py-3 lg:hidden">
            <div className="space-y-3">
              {navGroups.map((group) => (
                <div key={group.label}>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {group.label}
                  </p>
                  <div className="flex flex-col gap-0.5">
                    {group.links.map((link) => (
                      <Link
                        key={link.to}
                        to={link.to}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`rounded-md px-3 py-2 text-sm font-medium transition-colors-fast ${
                          isActive(link.to)
                            ? 'bg-primary/10 text-primary'
                            : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                        }`}
                      >
                        {link.label}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
              {session && (
                <button
                  onClick={onSignOut}
                  className="w-full rounded-md border border-border px-3 py-2 text-left text-sm font-medium text-muted-foreground transition-colors-fast hover:bg-accent hover:text-foreground sm:hidden"
                >
                  Sign out
                </button>
              )}
            </div>
          </nav>
        )}
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
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
          <Route path="/rules" element={<Rules />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}
