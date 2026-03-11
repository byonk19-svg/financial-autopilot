import type { EmployerFormState, LocationFormState } from '@/hooks/useShiftLog'
import type { EmployerRecord, EmployerLocationRecord } from '@/lib/types'

type ManageEmployersCardProps = {
  employers: EmployerRecord[]
  locations: EmployerLocationRecord[]
  saving: boolean
  employerForm: EmployerFormState
  locationForm: LocationFormState
  onEmployerFormChange: (updates: Partial<EmployerFormState>) => void
  onLocationFormChange: (updates: Partial<LocationFormState>) => void
  onAddEmployer: () => void
  onAddLocation: () => void
}

export function ManageEmployersCard({
  employers,
  locations,
  saving,
  employerForm,
  locationForm,
  onEmployerFormChange,
  onLocationFormChange,
  onAddEmployer,
  onAddLocation,
}: ManageEmployersCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-foreground">Employers and locations</h2>

      <div className="mt-3 space-y-2 rounded-lg border border-border bg-muted/20 p-3">
        <p className="text-sm font-medium text-foreground">Add employer</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            value={employerForm.name}
            onChange={(event) => onEmployerFormChange({ name: event.target.value })}
            placeholder="Employer name"
            className="rounded-lg border border-input px-3 py-2 text-sm text-foreground outline-none ring-ring transition focus:border-primary focus:ring-2"
          />
          <input
            value={employerForm.shortCode}
            onChange={(event) => onEmployerFormChange({ shortCode: event.target.value.toUpperCase() })}
            placeholder="Short code"
            className="rounded-lg border border-input px-3 py-2 text-sm text-foreground outline-none ring-ring transition focus:border-primary focus:ring-2"
          />
          <select
            value={employerForm.paySchedule}
            onChange={(event) =>
              onEmployerFormChange({
                paySchedule: event.target.value as 'weekly' | 'biweekly' | 'semimonthly',
              })
            }
            className="rounded-lg border border-input px-3 py-2 text-sm text-foreground outline-none ring-ring transition focus:border-primary focus:ring-2"
          >
            <option value="weekly">Weekly</option>
            <option value="biweekly">Biweekly</option>
            <option value="semimonthly">Semi-monthly</option>
          </select>
          <input
            type="number"
            min="0"
            value={employerForm.payLagDays}
            onChange={(event) => onEmployerFormChange({ payLagDays: event.target.value })}
            placeholder="Pay lag days"
            className="rounded-lg border border-input px-3 py-2 text-sm text-foreground outline-none ring-ring transition focus:border-primary focus:ring-2"
          />
          <input
            value={employerForm.color}
            onChange={(event) => onEmployerFormChange({ color: event.target.value })}
            placeholder="#2563EB"
            className="rounded-lg border border-input px-3 py-2 text-sm text-foreground outline-none ring-ring transition focus:border-primary focus:ring-2"
          />
          <input
            type="number"
            step="0.0001"
            min="0"
            value={employerForm.ptoPolicyHoursPerHour}
            onChange={(event) => onEmployerFormChange({ ptoPolicyHoursPerHour: event.target.value })}
            placeholder="PTO accrual per hour (optional)"
            className="rounded-lg border border-input px-3 py-2 text-sm text-foreground outline-none ring-ring transition focus:border-primary focus:ring-2"
          />
        </div>
        <button
          type="button"
          onClick={onAddEmployer}
          disabled={saving || !employerForm.name.trim() || !employerForm.shortCode.trim()}
          className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition-colors-fast hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Save employer
        </button>
      </div>

      <div className="mt-3 space-y-2 rounded-lg border border-border bg-muted/20 p-3">
        <p className="text-sm font-medium text-foreground">Add location</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <select
            value={locationForm.employerId}
            onChange={(event) => onLocationFormChange({ employerId: event.target.value })}
            className="rounded-lg border border-input px-3 py-2 text-sm text-foreground outline-none ring-ring transition focus:border-primary focus:ring-2"
          >
            <option value="">Select employer</option>
            {employers.map((employer) => (
              <option key={employer.id} value={employer.id}>
                {employer.name}
              </option>
            ))}
          </select>
          <input
            value={locationForm.name}
            onChange={(event) => onLocationFormChange({ name: event.target.value })}
            placeholder="Location name"
            className="rounded-lg border border-input px-3 py-2 text-sm text-foreground outline-none ring-ring transition focus:border-primary focus:ring-2"
          />
          <input
            value={locationForm.shortCode}
            onChange={(event) => onLocationFormChange({ shortCode: event.target.value.toUpperCase() })}
            placeholder="Short code"
            className="rounded-lg border border-input px-3 py-2 text-sm text-foreground outline-none ring-ring transition focus:border-primary focus:ring-2"
          />
        </div>
        <button
          type="button"
          onClick={onAddLocation}
          disabled={
            saving || !locationForm.employerId || !locationForm.name.trim() || !locationForm.shortCode.trim()
          }
          className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition-colors-fast hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
        >
          Save location
        </button>
      </div>

      {locations.length > 0 ? (
        <div className="mt-3 rounded-lg border border-border bg-muted/10 p-3 text-xs text-muted-foreground">
          {locations.slice(0, 8).map((location) => (
            <div key={location.id}>
              {location.short_code} - {location.name}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
