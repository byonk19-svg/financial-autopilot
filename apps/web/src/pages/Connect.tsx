import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getAccessToken } from '@/lib/auth'
import { hasActiveSimplefinConnection } from '../lib/bankConnections'
import { captureException } from '../lib/errorReporting'
import { functionUrl } from '../lib/functions'
import { supabase } from '../lib/supabase'
import { useSession } from '../lib/session'

function LinkIcon() {
  return (
    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
      <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden="true">
        <path
          d="M10 13.5 14 9.5M7.5 16a3.5 3.5 0 0 1 0-5l2-2a3.5 3.5 0 0 1 5 5M16.5 8a3.5 3.5 0 0 1 0 5l-2 2a3.5 3.5 0 0 1-5-5"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  )
}

export default function Connect() {
  const navigate = useNavigate()
  const { session, loading } = useSession()
  const [setupToken, setSetupToken] = useState('')
  const [status, setStatus] = useState<'idle' | 'checking' | 'connecting' | 'success' | 'error'>(
    'checking',
  )
  const [message, setMessage] = useState('')

  useEffect(() => {
    const bootstrap = async () => {
      if (loading) return
      if (!session?.user) {
        navigate('/login', { replace: true })
        return
      }

      try {
        const connected = await hasActiveSimplefinConnection(session.user.id)
        if (connected) {
          setStatus('success')
          setMessage('SimpleFIN connection already active.')
        } else {
          setStatus('idle')
        }
      } catch (bootstrapError) {
        captureException(bootstrapError, {
          component: 'Connect',
          action: 'bootstrap-connection-check',
        })
        setStatus('error')
        setMessage('Could not verify existing connection.')
      }
    }

    void bootstrap()
  }, [loading, navigate, session])

  const onConnect = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    setStatus('connecting')
    setMessage('')

    try {
      const currentSessionToken = session?.access_token ?? null
      const token = currentSessionToken ?? (await getAccessToken())
      if (!token) {
        await supabase.auth.signOut({ scope: 'local' })
        navigate('/login', { replace: true })
        throw new Error('Your session expired. Please log in again.')
      }

      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
      const response = await fetch(functionUrl('simplefin-connect'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          ...(anonKey ? { apikey: anonKey } : {}),
        },
        body: JSON.stringify({ setupToken: setupToken.trim() }),
      })

      const payload = (await response.json().catch(() => ({}))) as { error?: string }
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Unauthorized. Please log in again.')
        }
        throw new Error(payload.error ?? 'Connect request failed.')
      }

      setStatus('success')
      setMessage('SimpleFIN connected successfully.')
      navigate('/dashboard', { replace: true })
    } catch (error) {
      captureException(error, {
        component: 'Connect',
        action: 'connect-simplefin',
      })
      const text = error instanceof Error ? error.message : 'Connect request failed.'
      setStatus('error')
      setMessage(text)
    }
  }

  return (
    <section className="mx-auto max-w-lg rounded-xl border border bg-card p-6 shadow-sm">
      <LinkIcon />
      <h1 className="text-center text-2xl font-semibold text-foreground">Connect SimpleFIN</h1>
      <p className="mt-2 text-center text-sm text-muted-foreground">
        Paste your setup token from the SimpleFIN Bridge create page.
      </p>

      <div className="mt-4 rounded-lg border border bg-muted/30 px-3 py-2 text-center text-xs font-medium text-muted-foreground">
        Step 1: Get token <span className="px-1">→</span> Step 2: Paste below <span className="px-1">→</span> Step
        3: Connect
      </div>

      <form className="mt-6 space-y-4" onSubmit={onConnect}>
        <label className="block text-sm font-medium text-foreground" htmlFor="setupToken">
          Setup Token
        </label>
        <textarea
          id="setupToken"
          rows={5}
          required
          value={setupToken}
          onChange={(event) => setSetupToken(event.target.value)}
          placeholder="Paste setup token here"
          className="w-full rounded-lg border border px-3 py-2 text-sm text-foreground outline-none ring-ring transition focus:border-primary focus:ring-2"
        />

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={status === 'connecting' || status === 'checking'}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-colors-fast hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {status === 'connecting' ? 'Connecting...' : 'Connect'}
          </button>
          <Link
            to="/dashboard"
            className="text-sm font-medium text-primary underline-offset-2 transition-colors-fast hover:text-primary/80 hover:underline"
          >
            Skip to dashboard
          </Link>
        </div>
      </form>

      {message && (
        <div
          className={`mt-4 rounded-lg border px-3 py-2 text-sm ${
            status === 'error'
              ? 'border-red-200 bg-red-50/80 text-red-700'
              : 'border-emerald-200 bg-emerald-50/70 text-emerald-700'
          }`}
        >
          {message}
        </div>
      )}
    </section>
  )
}
