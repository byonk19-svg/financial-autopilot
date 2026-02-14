import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { hasActiveSimplefinConnection } from '../lib/bankConnections'
import { supabase } from '../lib/supabase'
import { useSession } from '../lib/session'

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
      } catch {
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
      const { data: refreshData } = await supabase.auth.refreshSession()
      const activeSession = refreshData.session ?? (await supabase.auth.getSession()).data.session

      if (!activeSession?.access_token) {
        throw new Error('Your session expired. Please log in again.')
      }

      supabase.functions.setAuth(activeSession.access_token)

      const { error } = await supabase.functions.invoke('simplefin-connect', {
        body: { setupToken: setupToken.trim() },
      })

      if (error) {
        const errorLike = error as { message?: string; context?: Response }
        let detail = 'Connect request failed.'

        if (errorLike.context instanceof Response) {
          const payload = (await errorLike.context.json().catch(() => null)) as { error?: string } | null
          if (payload?.error) {
            detail = payload.error
          }
        } else if (errorLike.message) {
          detail = errorLike.message
        }

        if (errorLike.context instanceof Response && errorLike.context.status === 401) {
          detail = 'Unauthorized. Please log in again.'
        } else if (detail.toLowerCase().includes('unauthorized')) {
          detail = 'Unauthorized. Please log in again.'
        }

        throw new Error(detail)
      }

      setStatus('success')
      setMessage('SimpleFIN connected successfully.')
      navigate('/dashboard', { replace: true })
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Connect request failed.'
      setStatus('error')
      setMessage(text)
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-semibold text-slate-900">Connect SimpleFIN</h1>
      <p className="mt-2 text-sm text-slate-600">
        Paste your setup token from the SimpleFIN Bridge create page.
      </p>

      <form className="mt-6 space-y-4" onSubmit={onConnect}>
        <label className="block text-sm font-medium text-slate-700" htmlFor="setupToken">
          Setup Token
        </label>
        <textarea
          id="setupToken"
          rows={5}
          required
          value={setupToken}
          onChange={(event) => setSetupToken(event.target.value)}
          placeholder="Paste setup token here"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none ring-cyan-500 transition focus:ring-2"
        />

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={status === 'connecting' || status === 'checking'}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {status === 'connecting' ? 'Connecting...' : 'Connect'}
          </button>
          <Link
            to="/dashboard"
            className="text-sm font-medium text-slate-700 underline-offset-2 hover:text-slate-900 hover:underline"
          >
            Skip to dashboard
          </Link>
        </div>
      </form>

      {message && (
        <p className={`mt-4 text-sm ${status === 'error' ? 'text-rose-600' : 'text-emerald-600'}`}>
          {message}
        </p>
      )}
    </section>
  )
}
