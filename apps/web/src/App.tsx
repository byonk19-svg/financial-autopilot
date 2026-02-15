import { Link, Navigate, Route, Routes } from 'react-router-dom'
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

const links = [
  { to: '/', label: 'Home' },
  { to: '/login', label: 'Login' },
  { to: '/connect', label: 'Connect' },
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/subscriptions', label: 'Subscriptions' },
  { to: '/classification-rules', label: 'Class Rules' },
  { to: '/alerts', label: 'Alerts' },
  { to: '/overview', label: 'Overview' },
  { to: '/transactions', label: 'Transactions' },
  { to: '/rules', label: 'Rules' },
]

export default function App() {
  const { session } = useSession()

  const onSignOut = async () => {
    await supabase.auth.signOut()
    window.location.assign('/login')
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div className="flex flex-wrap gap-4">
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="text-sm font-medium text-slate-700 transition hover:text-slate-950"
            >
              {link.label}
            </Link>
          ))}
          </div>
          {session && (
            <button
              onClick={onSignOut}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              Sign out
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
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
