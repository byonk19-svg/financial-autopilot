import {
  ActivitySquare,
  ArrowLeftRight,
  Bell,
  CalendarClock,
  Gauge,
  Landmark,
  LogIn,
  LogOut,
  Menu,
  Settings as SettingsIcon,
  Sparkles,
  Workflow,
  X,
} from 'lucide-react'
import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { NavigationCommandPalette } from './components/NavigationCommandPalette'
import type { NavigationCommandPaletteItem } from './components/NavigationCommandPalette'
import ErrorBoundary from './components/ErrorBoundary'
import { captureException } from './lib/errorReporting'
import { useSession } from './lib/session'
import { supabase } from './lib/supabase'

const loadDashboardPage = () => import('./pages/Dashboard')
const loadHomePage = () => import('./pages/Home')
const loadLoginPage = () => import('./pages/Login')
const loadConnectPage = () => import('./pages/Connect')
const loadSubscriptionsPage = () => import('./pages/Subscriptions')
const loadClassificationRulesPage = () => import('./pages/ClassificationRules')
const loadAutoRulesPage = () => import('./pages/AutoRules')
const loadAlertsPage = () => import('./pages/Alerts')
const loadOverviewPage = () => import('./pages/Overview')
const loadTransactionsPage = () => import('./pages/Transactions')
const loadCashFlowPage = () => import('./pages/CashFlow')
const loadShiftLogPage = () => import('./pages/ShiftLog')
const loadRulesPage = () => import('./pages/Rules')
const loadSettingsPage = () => import('./pages/Settings')

const DashboardPage = lazy(loadDashboardPage)
const HomePage = lazy(loadHomePage)
const LoginPage = lazy(loadLoginPage)
const ConnectPage = lazy(loadConnectPage)
const SubscriptionsPage = lazy(loadSubscriptionsPage)
const ClassificationRulesPage = lazy(loadClassificationRulesPage)
const AutoRulesPage = lazy(loadAutoRulesPage)
const AlertsPage = lazy(loadAlertsPage)
const OverviewPage = lazy(loadOverviewPage)
const TransactionsPage = lazy(loadTransactionsPage)
const CashFlowPage = lazy(loadCashFlowPage)
const ShiftLogPage = lazy(loadShiftLogPage)
const RulesPage = lazy(loadRulesPage)
const SettingsPage = lazy(loadSettingsPage)

type NavItem = NavigationCommandPaletteItem & {
  preload?: () => Promise<unknown>
}
type NavGroup = { label: string; items: NavItem[] }

const navGroups: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      {
        to: '/',
        label: 'Dashboard',
        description: 'Quick health and priority actions for this month.',
        icon: Gauge,
        preload: loadDashboardPage,
      },
      {
        to: '/transactions',
        label: 'Transactions',
        description: 'Categorize and review imported spending activity.',
        icon: ArrowLeftRight,
        preload: loadTransactionsPage,
      },
      {
        to: '/cash-flow',
        label: 'Cash Flow',
        description: 'Project checking balance with bills and paychecks.',
        icon: ActivitySquare,
        preload: loadCashFlowPage,
      },
      {
        to: '/overview',
        label: 'Accounts',
        description: 'Track balances and ownership across linked accounts.',
        icon: Landmark,
        preload: loadOverviewPage,
      },
    ],
  },
  {
    label: 'Automation',
    items: [
      {
        to: '/subscriptions',
        label: 'Recurring',
        description: 'Review recurring charges and subscription classifications.',
        icon: CalendarClock,
        preload: loadSubscriptionsPage,
      },
      {
        to: '/alerts',
        label: 'Alerts',
        description: 'Investigate unusual charges and spending anomalies.',
        icon: Bell,
        preload: loadAlertsPage,
      },
    ],
  },
  {
    label: 'Config',
    items: [
      {
        to: '/rules',
        label: 'Rules',
        description: 'Manage manual rule behavior and aliases.',
        icon: Workflow,
        preload: loadRulesPage,
      },
      {
        to: '/auto-rules',
        label: 'Auto Rules',
        description: 'Set sync-time category and owner automation rules.',
        icon: Sparkles,
        preload: loadAutoRulesPage,
      },
      {
        to: '/classification-rules',
        label: 'Recurring Rules',
        description: 'Adjust recurring classification behavior.',
        icon: Sparkles,
        preload: loadClassificationRulesPage,
      },
      {
        to: '/shift-log',
        label: 'Shift Log',
        description: 'Track shift income, goals, and employer mix.',
        icon: CalendarClock,
        preload: loadShiftLogPage,
      },
      {
        to: '/settings',
        label: 'Settings',
        description: 'Manage account preferences and data controls.',
        icon: SettingsIcon,
        preload: loadSettingsPage,
      },
    ],
  },
]

function RouteLoadingFallback() {
  return (
    <section className="panel-soft mx-auto max-w-5xl border-border/75 bg-card/92 p-6 sm:p-7 motion-fade-up" aria-busy="true" aria-live="polite">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Loading view</p>
      <div className="mt-3 space-y-3">
        <div className="h-3 w-1/3 rounded bg-muted/70" />
        <div className="h-10 w-full rounded-xl bg-muted/75" />
        <div className="h-10 w-full rounded-xl bg-muted/65" />
        <div className="h-10 w-4/5 rounded-xl bg-muted/55" />
      </div>
    </section>
  )
}

export default function App() {
  const location = useLocation()
  const { session } = useSession()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [navSearch, setNavSearch] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const navItems = navGroups.flatMap((group) => group.items)
  const monthLabel = useMemo(
    () => new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(new Date()),
    [],
  )

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

  const currentNavItem = navItems
    .filter((item) => isActive(item.to))
    .sort((a, b) => b.to.length - a.to.length)[0]
  const currentPageLabel = currentNavItem?.label ?? 'Dashboard'
  const currentPageDescription = currentNavItem?.description ?? 'Household finance overview'

  const navItemClass = (to: string): string =>
    `group inline-flex min-h-11 items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background md:min-h-9 md:py-1.5 ${
      isActive(to)
        ? 'bg-primary text-primary-foreground shadow-[0_16px_30px_-18px_hsl(var(--primary)/0.94)]'
        : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
    }`

  const onNavClick = () => {
    setMobileNavOpen(false)
    setNavSearch('')
    setSearchOpen(false)
  }
  const preloadRoute = useCallback((item: NavItem) => {
    void item.preload?.()
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setSearchOpen(true)
      }
      if (event.key === 'Escape' && searchOpen) {
        setSearchOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [searchOpen])

  useEffect(() => {
    if (!searchOpen) {
      setNavSearch('')
    }
  }, [searchOpen])

  const renderNavGroup = (group: NavGroup) => (
    <section key={group.label}>
      <p className="mb-2 px-1 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{group.label}</p>
      <div className="space-y-1">
        {group.items.map((item) => {
          const Icon = item.icon
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={onNavClick}
              onMouseEnter={() => preloadRoute(item)}
              onFocus={() => preloadRoute(item)}
              className={navItemClass(item.to)}
              aria-current={isActive(item.to) ? 'page' : undefined}
            >
              <Icon className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:scale-105" />
              <span className="truncate">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </section>
  )

  return (
    <div className="relative min-h-screen overflow-x-clip text-foreground">
      <a
        href="#main-content"
        className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground focus:not-sr-only focus:absolute focus:left-3 focus:top-3"
      >
        Skip to main content
      </a>
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
        <div className="app-grid-bg absolute inset-0 opacity-[0.34]" />
        <div className="app-orb app-orb--primary" />
        <div className="app-orb app-orb--accent" />
      </div>
      <div className="mx-auto flex w-full max-w-[1540px] gap-3 px-3 py-3 sm:gap-4 sm:px-4 lg:gap-6 lg:px-6">
        <aside className="hidden xl:block xl:w-72 xl:shrink-0">
          <div className="panel-soft sticky top-3 flex h-[calc(100vh-1.5rem)] flex-col overflow-hidden border-border/80 bg-card/92 p-3">
            <Link to="/" onClick={onNavClick} className="inline-flex items-center gap-3 rounded-2xl px-2 py-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-[0_14px_24px_-14px_hsl(var(--primary)/0.9)]">
                <span className="font-extrabold tracking-wide">FA</span>
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-extrabold leading-none text-foreground">Financial Autopilot</p>
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Family finance hub</p>
              </div>
            </Link>

            <nav className="mt-4 flex-1 space-y-5 overflow-y-auto pr-1" aria-label="Sidebar navigation">
              {navGroups.map((group) => renderNavGroup(group))}
            </nav>

            <div className="mt-3 border-t border-border/85 pt-3">
              {session ? (
                <button
                  onClick={onSignOut}
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-border bg-background/70 px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors-fast hover:bg-secondary hover:text-foreground"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
              ) : (
                <Link
                  to="/login"
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-border bg-background/70 px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors-fast hover:bg-secondary hover:text-foreground"
                >
                  <LogIn className="h-4 w-4" />
                  Log in
                </Link>
              )}
            </div>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="sticky top-3 z-40 motion-fade-in">
            <div className="panel-soft relative border-border/85 bg-background/78 p-2 backdrop-blur-xl sm:p-3">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/45 to-transparent" aria-hidden="true" />
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <button
                  type="button"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-card/90 text-muted-foreground transition-colors-fast hover:bg-secondary hover:text-foreground xl:hidden"
                  onClick={() => setMobileNavOpen((current) => !current)}
                  aria-label="Toggle navigation menu"
                  aria-expanded={mobileNavOpen}
                  aria-controls="mobile-navigation"
                >
                  {mobileNavOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
                </button>

                <div className="hidden min-w-0 sm:block">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{monthLabel}</p>
                  <p className="truncate text-sm font-semibold text-foreground">{currentPageLabel}</p>
                  <p className="mt-0.5 max-w-[32ch] truncate text-xs text-muted-foreground">{currentPageDescription}</p>
                </div>

                <div className="min-w-0 flex-1" />

                <button
                  type="button"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-card/90 text-muted-foreground transition-colors-fast hover:bg-secondary hover:text-foreground"
                  aria-label="View alerts"
                >
                  <Bell className="h-4 w-4" />
                </button>

                {session ? (
                  <button
                    onClick={onSignOut}
                    className="hidden min-h-11 items-center gap-2 rounded-xl border border-border bg-card/90 px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors-fast hover:bg-secondary hover:text-foreground xl:inline-flex"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </button>
                ) : (
                  <Link
                    to="/login"
                    className="hidden min-h-11 items-center gap-2 rounded-xl border border-border bg-card/90 px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors-fast hover:bg-secondary hover:text-foreground xl:inline-flex"
                  >
                    <LogIn className="h-4 w-4" />
                    Log in
                  </Link>
                )}
              </div>
            </div>
          </header>

          {mobileNavOpen && (
            <div className="fixed inset-0 z-50 xl:hidden" aria-modal="true" role="dialog" aria-label="Mobile navigation">
              <button
                type="button"
                aria-label="Close mobile navigation"
                className="absolute inset-0 bg-foreground/35 backdrop-blur-[1px]"
                onClick={() => setMobileNavOpen(false)}
              />
              <aside id="mobile-navigation" className="absolute left-0 top-0 h-full w-[84vw] max-w-[340px] border-r border-border bg-background/98 p-4 motion-nav-enter">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <Link to="/" onClick={onNavClick} className="inline-flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-xs font-extrabold text-primary-foreground">FA</div>
                    <span className="text-sm font-extrabold text-foreground">Financial Autopilot</span>
                  </Link>
                  <button
                    type="button"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-card/90 text-muted-foreground"
                    onClick={() => setMobileNavOpen(false)}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <nav className="space-y-5" aria-label="Mobile navigation links">
                  {navGroups.map((group) => renderNavGroup(group))}
                </nav>
                <div className="mt-6 border-t border-border pt-4">
                  {session ? (
                    <button
                      onClick={async () => {
                        setMobileNavOpen(false)
                        await onSignOut()
                      }}
                      className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-border bg-card/90 px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors-fast hover:bg-secondary hover:text-foreground"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign out
                    </button>
                  ) : (
                    <Link
                      to="/login"
                      onClick={onNavClick}
                      className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-border bg-card/90 px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors-fast hover:bg-secondary hover:text-foreground"
                    >
                      <LogIn className="h-4 w-4" />
                      Log in
                    </Link>
                  )}
                </div>
              </aside>
            </div>
          )}

          <NavigationCommandPalette
            navItems={navItems}
            navSearch={navSearch}
            onClose={() => setSearchOpen(false)}
            onNavClick={onNavClick}
            onSearchChange={(event) => setNavSearch(event.target.value)}
            open={searchOpen}
            preloadRoute={preloadRoute}
          />

          <main id="main-content" tabIndex={-1} className="pb-10 pt-5 sm:pt-6 lg:pt-7 motion-page-enter">
            <ErrorBoundary>
              <Suspense fallback={<RouteLoadingFallback />}>
                <Routes>
                  <Route path="/" element={<DashboardPage />} />
                  <Route path="/home" element={<HomePage />} />
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/connect" element={<ConnectPage />} />
                  <Route path="/dashboard" element={<Navigate to="/" replace />} />
                  <Route path="/subscriptions" element={<SubscriptionsPage />} />
                  <Route path="/auto-rules" element={<AutoRulesPage />} />
                  <Route path="/classification-rules" element={<ClassificationRulesPage />} />
                  <Route path="/alerts" element={<AlertsPage />} />
                  <Route path="/overview" element={<OverviewPage />} />
                  <Route path="/transactions" element={<TransactionsPage />} />
                  <Route path="/cash-flow" element={<CashFlowPage />} />
                  <Route path="/shift-log" element={<ShiftLogPage />} />
                  <Route path="/rules" element={<RulesPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Suspense>
            </ErrorBoundary>
          </main>
        </div>
      </div>
    </div>
  )
}
