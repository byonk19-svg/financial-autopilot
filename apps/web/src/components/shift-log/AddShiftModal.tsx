import { useEffect, useMemo, useState } from 'react'
import type { EmployerLocationRecord, EmployerRecord } from '@/lib/types'
import type { NewShiftInput } from '@/hooks/useShiftLog'
import { toNumber } from '@/lib/subscriptionFormatters'

type AddShiftModalProps = {
  open: boolean
  onClose: () => void
  onSubmit: (input: NewShiftInput) => Promise<boolean>
  employers: EmployerRecord[]
  locationsByEmployerId: Record<string, EmployerLocationRecord[]>
  saving: boolean
  title?: string
  submitLabel?: string
  seedShift?: {
    employerId: string
    locationId: string | null
    hoursWorked: number | string
    grossPay: number | string
    notes: string | null
    isNonPay: boolean
  } | null
  initialShift?: {
    shiftDate: string
    employerId: string
    locationId: string | null
    hoursWorked: number | string
    grossPay: number | string
    notes: string | null
    isNonPay: boolean
  } | null
}

const emptyForm = {
  shiftDate: '',
  employerId: '',
  locationId: '',
  hoursWorked: '0',
  grossPay: '0',
  notes: '',
  isNonPay: false,
}

export default function AddShiftModal({
  open,
  onClose,
  onSubmit,
  employers,
  locationsByEmployerId,
  saving,
  title = 'Add shift',
  submitLabel = 'Save shift',
  seedShift = null,
  initialShift = null,
}: AddShiftModalProps) {
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    if (initialShift) {
      setForm({
        shiftDate: initialShift.shiftDate,
        employerId: initialShift.employerId,
        locationId: initialShift.locationId ?? '',
        hoursWorked: toNumber(initialShift.hoursWorked).toString(),
        grossPay: toNumber(initialShift.grossPay).toString(),
        notes: initialShift.notes ?? '',
        isNonPay: initialShift.isNonPay,
      })
    } else {
      setForm((current) => ({
        ...emptyForm,
        shiftDate: new Date().toISOString().slice(0, 10),
        employerId: seedShift?.employerId || current.employerId || employers[0]?.id || '',
        locationId: seedShift?.locationId ?? '',
        hoursWorked:
          typeof seedShift?.hoursWorked === 'undefined'
            ? emptyForm.hoursWorked
            : toNumber(seedShift.hoursWorked).toString(),
        grossPay:
          typeof seedShift?.grossPay === 'undefined'
            ? emptyForm.grossPay
            : toNumber(seedShift.grossPay).toString(),
        notes: seedShift?.notes ?? '',
        isNonPay: seedShift?.isNonPay ?? false,
      }))
    }
    setError('')
  }, [employers, initialShift, open, seedShift])

  const employerLocations = useMemo(
    () => (form.employerId ? locationsByEmployerId[form.employerId] ?? [] : []),
    [form.employerId, locationsByEmployerId],
  )

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-lg rounded-xl border border-border bg-card p-5 shadow-lg">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">{title}</h3>
          <button
            type="button"
            className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground transition-colors-fast hover:bg-accent hover:text-foreground"
            onClick={onClose}
            disabled={saving}
          >
            Close
          </button>
        </div>

        <form
          className="mt-4 space-y-3"
          onSubmit={(event) => {
            event.preventDefault()
            setError('')

            const hoursWorked = Number(form.hoursWorked)
            const grossPay = Number(form.grossPay)

            if (!form.shiftDate || !form.employerId) {
              setError('Date and employer are required.')
              return
            }

            if (!form.isNonPay && grossPay < 0) {
              setError('Gross pay cannot be negative.')
              return
            }

            if (hoursWorked < 0) {
              setError('Hours cannot be negative.')
              return
            }

            void onSubmit({
              shiftDate: form.shiftDate,
              employerId: form.employerId,
              locationId: form.locationId || null,
              hoursWorked,
              grossPay,
              notes: form.notes,
              isNonPay: form.isNonPay,
            }).then((saved) => {
              if (saved) {
                onClose()
              }
            })
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground">Date</span>
              <input
                type="date"
                value={form.shiftDate}
                onChange={(event) => setForm((current) => ({ ...current, shiftDate: event.target.value }))}
                className="w-full rounded-lg border border-input px-3 py-2 text-foreground outline-none ring-ring transition focus:border-primary focus:ring-2"
                required
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground">Employer</span>
              <select
                value={form.employerId}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    employerId: event.target.value,
                    locationId: '',
                  }))
                }
                className="w-full rounded-lg border border-input px-3 py-2 text-foreground outline-none ring-ring transition focus:border-primary focus:ring-2"
                required
              >
                <option value="">Select employer</option>
                {employers.map((employer) => (
                  <option key={employer.id} value={employer.id}>
                    {employer.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground">Location</span>
              <select
                value={form.locationId}
                onChange={(event) => setForm((current) => ({ ...current, locationId: event.target.value }))}
                className="w-full rounded-lg border border-input px-3 py-2 text-foreground outline-none ring-ring transition focus:border-primary focus:ring-2"
              >
                <option value="">No location</option>
                {employerLocations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground">Hours worked</span>
              <input
                type="number"
                step="0.25"
                min="0"
                value={form.hoursWorked}
                onChange={(event) => setForm((current) => ({ ...current, hoursWorked: event.target.value }))}
                className="w-full rounded-lg border border-input px-3 py-2 text-foreground outline-none ring-ring transition focus:border-primary focus:ring-2"
              />
            </label>
          </div>

          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">Gross pay</span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.isNonPay ? '0' : form.grossPay}
              disabled={form.isNonPay}
              onChange={(event) => setForm((current) => ({ ...current, grossPay: event.target.value }))}
              className="w-full rounded-lg border border-input px-3 py-2 text-foreground outline-none ring-ring transition focus:border-primary focus:ring-2 disabled:cursor-not-allowed disabled:bg-muted"
            />
          </label>

          <label className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={form.isNonPay}
              onChange={(event) => setForm((current) => ({ ...current, isNonPay: event.target.checked }))}
              className="h-4 w-4 rounded border-input text-primary focus-visible:ring-2 focus-visible:ring-ring"
            />
            Non-pay entry (SICK, appointment, or other no-pay day)
          </label>

          <label className="space-y-1 text-sm">
            <span className="text-muted-foreground">Notes</span>
            <textarea
              value={form.notes}
              onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
              className="h-20 w-full rounded-lg border border-input px-3 py-2 text-foreground outline-none ring-ring transition focus:border-primary focus:ring-2"
              placeholder="Optional notes"
            />
          </label>

          {error ? <div className="rounded-lg border border-red-200 bg-red-50/80 px-3 py-2 text-sm text-red-700">{error}</div> : null}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition-colors-fast hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition-colors-fast hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? 'Saving...' : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

