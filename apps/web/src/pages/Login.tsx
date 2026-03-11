import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { hasActiveSimplefinConnection } from '../lib/bankConnections'
import { captureException } from '../lib/errorReporting'
import { supabase } from '../lib/supabase'
import { useSession } from '../lib/session'

function DollarLogo() {
  return (
    <div className="mx-auto flex flex-col items-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden="true">
          <path
            d="M12 3v18M15.5 7.5c0-1.4-1.6-2.5-3.5-2.5s-3.5 1.1-3.5 2.5 1.6 2.5 3.5 2.5 3.5 1.1 3.5 2.5-1.6 2.5-3.5 2.5-3.5-1.1-3.5-2.5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <p className="mt-3 text-center text-base font-semibold text-foreground">Financial Autopilot</p>
    </div>
  )
}

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { session, loading } = useSession()
  const [mode, setMode] = useState<'magic' | 'password'>('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const [redirecting, setRedirecting] = useState(false)

  const emailRedirectTo = useMemo(() => `${window.location.origin}/login`, [])
  const nextPath = useMemo(() => {
    const candidate = new URLSearchParams(location.search).get('next')
    if (!candidate) return null
    if (!candidate.startsWith('/') || candidate.startsWith('//')) return null
    return candidate
  }, [location.search])

  useEffect(() => {
    const redirectAfterLogin = async () => {
      if (loading || !session?.user) return
      setRedirecting(true)

      try {
        if (nextPath) {
          navigate(nextPath, { replace: true })
          return
        }
        const isConnected = await hasActiveSimplefinConnection(session.user.id)
        navigate(isConnected ? '/dashboard' : '/connect', { replace: true })
      } catch (redirectError) {
        captureException(redirectError, {
          component: 'Login',
          action: 'redirect-after-login',
        })
        setMessage('Signed in, but failed to check connection status.')
        setStatus('error')
        setRedirecting(false)
      }
    }

    void redirectAfterLogin()
  }, [loading, navigate, nextPath, session])

  const submitMagicLink = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setStatus('sending')
    setMessage('')

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo },
    })

    if (error) {
      setStatus('error')
      setMessage(error.message)
      return
    }

    setStatus('sent')
    setMessage('Magic link sent. Check your inbox and spam folder.')
  }

  const submitPasswordLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setStatus('sending')
    setMessage('')

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (error) {
      setStatus('error')
      setMessage(error.message)
      return
    }

    setStatus('sent')
    setMessage('Signed in. Redirecting...')
  }

  if (loading || redirecting) {
    return (
      <section className="mx-auto max-w-md rounded-xl border border-border bg-card p-6 shadow-sm">
        <DollarLogo />
        <h1 className="mt-5 text-center text-2xl font-semibold text-foreground">Login</h1>
        <p className="mt-2 text-center text-sm text-foreground/80">Checking your session...</p>
      </section>
    )
  }

  return (
    <section className="mx-auto max-w-md rounded-xl border border-border bg-card p-6 shadow-sm">
      <DollarLogo />
      <h1 className="mt-5 text-center text-2xl font-semibold text-foreground">Login</h1>
      <p className="mt-2 text-center text-sm text-foreground/80">Choose a login method.</p>

      <div className="mt-4 inline-flex w-full rounded-lg border border-border p-1">
        <button
          type="button"
          onClick={() => {
            setMode('password')
            setMessage('')
            setStatus('idle')
          }}
          className={`min-h-11 flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors-fast ${
              mode === 'password'
              ? 'bg-primary text-primary-foreground'
              : 'bg-transparent text-foreground/80 hover:bg-accent'
          }`}
        >
          Password
        </button>
        <button
          type="button"
          onClick={() => {
            setMode('magic')
            setMessage('')
            setStatus('idle')
          }}
          className={`min-h-11 flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors-fast ${
              mode === 'magic'
              ? 'bg-primary text-primary-foreground'
              : 'bg-transparent text-foreground/80 hover:bg-accent'
          }`}
        >
          Magic Link
        </button>
      </div>

      <form className="mt-6 space-y-4" onSubmit={mode === 'password' ? submitPasswordLogin : submitMagicLink}>
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-foreground" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-lg border border-border px-3 py-2 text-foreground outline-none ring-ring transition focus:border-primary focus:ring-2"
          />
        </div>

        {mode === 'password' && (
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border border-border px-3 py-2 text-foreground outline-none ring-ring transition focus:border-primary focus:ring-2"
            />
          </div>
        )}

        <button
          type="submit"
          disabled={status === 'sending'}
          className="min-h-11 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-colors-fast hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === 'sending'
            ? mode === 'password'
              ? 'Signing in...'
              : 'Sending...'
            : mode === 'password'
              ? 'Sign In'
              : 'Send Magic Link'}
        </button>
      </form>

      {mode === 'password' ? (
        <p className="mt-3 text-xs text-foreground/80">
          If you do not have a password yet, set one in Supabase Dashboard &gt; Authentication &gt; Users.
        </p>
      ) : (
        <p className="mt-3 text-xs text-foreground/80">
          Use magic link when email delivery is configured and not rate-limited.
        </p>
      )}

      {message && (
        <p className={`mt-4 text-sm ${status === 'error' ? 'text-rose-600' : 'text-emerald-600'}`}>{message}</p>
      )}
    </section>
  )
}
