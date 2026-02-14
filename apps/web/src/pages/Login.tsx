import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { hasActiveSimplefinConnection } from '../lib/bankConnections'
import { supabase } from '../lib/supabase'
import { useSession } from '../lib/session'

export default function Login() {
  const navigate = useNavigate()
  const { session, loading } = useSession()
  const [mode, setMode] = useState<'magic' | 'password'>('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const [redirecting, setRedirecting] = useState(false)

  const emailRedirectTo = useMemo(() => `${window.location.origin}/login`, [])

  useEffect(() => {
    const redirectAfterLogin = async () => {
      if (loading || !session?.user) return
      setRedirecting(true)

      try {
        const isConnected = await hasActiveSimplefinConnection(session.user.id)
        navigate(isConnected ? '/dashboard' : '/connect', { replace: true })
      } catch {
        setMessage('Signed in, but failed to check connection status.')
        setStatus('error')
        setRedirecting(false)
      }
    }

    void redirectAfterLogin()
  }, [loading, navigate, session])

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
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Login</h1>
        <p className="mt-2 text-sm text-slate-600">Checking your session...</p>
      </section>
    )
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-semibold text-slate-900">Login</h1>
      <p className="mt-2 text-sm text-slate-600">Choose a login method.</p>

      <div className="mt-4 inline-flex rounded-lg border border-slate-300 p-1">
        <button
          type="button"
          onClick={() => {
            setMode('password')
            setMessage('')
            setStatus('idle')
          }}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
            mode === 'password' ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
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
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
            mode === 'magic' ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
          }`}
        >
          Magic Link
        </button>
      </div>

      <form className="mt-6 space-y-4" onSubmit={mode === 'password' ? submitPasswordLogin : submitMagicLink}>
        <label className="block text-sm font-medium text-slate-700" htmlFor="email">
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
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none ring-cyan-500 transition focus:ring-2"
        />

        {mode === 'password' && (
          <>
            <label className="block text-sm font-medium text-slate-700" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 outline-none ring-cyan-500 transition focus:ring-2"
            />
          </>
        )}

        <button
          type="submit"
          disabled={status === 'sending'}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
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
        <p className="mt-3 text-xs text-slate-500">
          If you do not have a password yet, set one in Supabase Dashboard &gt; Authentication &gt; Users.
        </p>
      ) : (
        <p className="mt-3 text-xs text-slate-500">
          Use magic link when email delivery is configured and not rate-limited.
        </p>
      )}

      {message && (
        <p className={`mt-4 text-sm ${status === 'error' ? 'text-rose-600' : 'text-emerald-600'}`}>
          {message}
        </p>
      )}
    </section>
  )
}
