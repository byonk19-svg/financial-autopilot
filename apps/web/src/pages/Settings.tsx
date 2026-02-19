import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { captureException } from '../lib/errorReporting'
import { getLoginRedirectPath } from '../lib/loginRedirect'
import { supabase } from '../lib/supabase'
import { useSession } from '../lib/session'

type PurgeResponse = {
  ok?: boolean
  deleted?: Record<string, number>
}

export default function Settings() {
  const navigate = useNavigate()
  const { session, loading } = useSession()

  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  useEffect(() => {
    if (!loading && !session?.user) {
      navigate(getLoginRedirectPath(), { replace: true })
    }
  }, [loading, navigate, session?.user])

  const closeConfirmModal = useCallback(() => {
    if (isSubmitting) return
    setIsConfirmOpen(false)
    setConfirmText('')
    setErrorMessage('')
  }, [isSubmitting])

  const openConfirmModal = useCallback(() => {
    setErrorMessage('')
    setSuccessMessage('')
    setConfirmText('')
    setIsConfirmOpen(true)
  }, [])

  const canConfirmDelete = useMemo(
    () => confirmText.trim() === 'DELETE' && !isSubmitting,
    [confirmText, isSubmitting],
  )

  const onPurgeData = useCallback(async () => {
    if (!canConfirmDelete) return

    setIsSubmitting(true)
    setErrorMessage('')
    setSuccessMessage('')

    try {
      const { data, error } = await supabase.rpc('purge_user_data')
      if (error) {
        throw error
      }

      const payload = (data ?? {}) as PurgeResponse
      const deletedEntries = Object.entries(payload.deleted ?? {})
      const totalDeleted = deletedEntries.reduce((sum, [, value]) => sum + (Number(value) || 0), 0)
      setSuccessMessage(`Deleted your user-scoped data successfully (${totalDeleted} records removed).`)
      setIsConfirmOpen(false)
      setConfirmText('')
    } catch (error) {
      captureException(error, {
        component: 'Settings',
        action: 'purge-user-data',
      })
      setErrorMessage(
        error instanceof Error ? error.message : 'Could not delete data. Please try again.',
      )
    } finally {
      setIsSubmitting(false)
    }
  }, [canConfirmDelete])

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-foreground">Settings</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Manage account-level preferences and destructive actions.
        </p>
      </div>

      <div className="rounded-xl border border-red-200 bg-red-50/40 p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-red-700">Danger Zone</h2>
        <p className="mt-2 text-sm text-red-700/90">
          Delete all your synced data, rules, categories, alerts, insights, and recurring settings.
          This cannot be undone.
        </p>
        <div className="mt-4">
          <button
            type="button"
            onClick={openConfirmModal}
            className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700 transition-colors-fast hover:bg-red-50"
          >
            Delete my data
          </button>
        </div>
      </div>

      {successMessage ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-sm text-emerald-700">
          {successMessage}
        </div>
      ) : null}

      {errorMessage && !isConfirmOpen ? (
        <div className="rounded-lg border border-red-200 bg-red-50/80 px-3 py-2 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      {isConfirmOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-data-title"
        >
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg">
            <h3 id="delete-data-title" className="text-lg font-semibold text-foreground">
              Confirm data deletion
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Type <span className="font-semibold text-foreground">DELETE</span> to confirm permanent
              deletion of your data.
            </p>

            <label htmlFor="delete-confirm-input" className="mt-4 block text-sm font-medium text-foreground">
              Confirmation text
            </label>
            <input
              id="delete-confirm-input"
              type="text"
              value={confirmText}
              onChange={(event) => setConfirmText(event.target.value)}
              className="mt-2 w-full rounded-lg border border-input px-3 py-2 text-sm text-foreground outline-none ring-ring transition focus:border-primary focus:ring-2"
              placeholder="Type DELETE"
              autoFocus
            />

            {errorMessage ? (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50/80 px-3 py-2 text-sm text-red-700">
                {errorMessage}
              </div>
            ) : null}

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={closeConfirmModal}
                disabled={isSubmitting}
                className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition-colors-fast hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  void onPurgeData()
                }}
                disabled={!canConfirmDelete}
                className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white transition-colors-fast hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting ? 'Deleting...' : 'Delete data'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
