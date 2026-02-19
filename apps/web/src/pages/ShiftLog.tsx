import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AddShiftModal from '@/components/shift-log/AddShiftModal'
import EmployerWeeklyComparison from '@/components/shift-log/EmployerWeeklyComparison'
import WeekBlock from '@/components/shift-log/WeekBlock'
import WeeklyGoalTrend from '@/components/shift-log/WeeklyGoalTrend'
import { useShiftLog } from '@/hooks/useShiftLog'
import { getLoginRedirectPath } from '@/lib/loginRedirect'
import { useSession } from '@/lib/session'
import { calcWeekSummary } from '@/lib/shiftWeeks'
import type { EmployerPaySchedule, ShiftRecord } from '@/lib/types'

const weekStartOptions = [
  { value: 0, label: 'Sunday - Saturday' },
  { value: 1, label: 'Monday - Sunday' },
] as const

export default function ShiftLog() {
  const navigate = useNavigate()
  const { session, loading: sessionLoading } = useSession()
  const userId = session?.user?.id

  const {
    loading,
    saving,
    error,
    success,
    weeklyGoal,
    weekStartsOn,
    employers,
    locations,
    weeks,
    employersById,
    locationsById,
    locationsByEmployerId,
    savePreferences,
    addEmployer,
    addLocation,
    addShift,
    updateShift,
    deleteShift,
    clearMessages,
  } = useShiftLog(userId)

  type EmployerFormState = {
    name: string
    shortCode: string
    color: string
    paySchedule: EmployerPaySchedule
    payLagDays: string
    ptoPolicyHoursPerHour: string
  }

  const [goalDraft, setGoalDraft] = useState(String(weeklyGoal))
  const [weekStartsDraft, setWeekStartsDraft] = useState<0 | 1>(weekStartsOn)
  const [employerForm, setEmployerForm] = useState<EmployerFormState>({
    name: '',
    shortCode: '',
    color: '#2563EB',
    paySchedule: 'biweekly' as const,
    payLagDays: '14',
    ptoPolicyHoursPerHour: '',
  })
  const [locationForm, setLocationForm] = useState({
    employerId: '',
    name: '',
    shortCode: '',
  })
  const [isAddShiftOpen, setIsAddShiftOpen] = useState(false)
  const [editingShift, setEditingShift] = useState<ShiftRecord | null>(null)
  const [busyShiftId, setBusyShiftId] = useState<string | null>(null)
  const [quickAdding, setQuickAdding] = useState(false)

  useEffect(() => {
    if (!sessionLoading && !userId) {
      navigate(getLoginRedirectPath('/shift-log'), { replace: true })
    }
  }, [navigate, sessionLoading, userId])

  useEffect(() => {
    setGoalDraft(String(weeklyGoal))
    setWeekStartsDraft(weekStartsOn)
  }, [weekStartsOn, weeklyGoal])

  useEffect(() => {
    if (!locationForm.employerId && employers[0]) {
      setLocationForm((current) => ({ ...current, employerId: employers[0].id }))
    }
  }, [employers, locationForm.employerId])

  const totalPayAllWeeks = useMemo(
    () =>
      weeks
        .flatMap((week) => week.shifts)
        .filter((shift) => !shift.is_non_pay)
        .reduce((sum, shift) => sum + Number(shift.gross_pay || 0), 0),
    [weeks],
  )

  const mostRecentShift = useMemo(() => {
    const allShifts = weeks.flatMap((week) => week.shifts)
    if (allShifts.length === 0) return null
    return allShifts
      .slice()
      .sort((a, b) => {
        const dateCompare = b.shift_date.localeCompare(a.shift_date)
        if (dateCompare !== 0) return dateCompare
        return (b.created_at ?? '').localeCompare(a.created_at ?? '')
      })[0]
  }, [weeks])

  const currentWeekSummary = useMemo(() => {
    if (!weeks[0]) return null
    return calcWeekSummary(weeks[0], employersById, weeklyGoal)
  }, [employersById, weeklyGoal, weeks])

  const onSavePreferences = useCallback(async () => {
    const parsedGoal = Number(goalDraft)
    await savePreferences(Number.isFinite(parsedGoal) ? parsedGoal : weeklyGoal, weekStartsDraft)
  }, [goalDraft, savePreferences, weekStartsDraft, weeklyGoal])

  const onAddEmployer = useCallback(async () => {
    const added = await addEmployer({
      name: employerForm.name,
      shortCode: employerForm.shortCode,
      color: employerForm.color,
      paySchedule: employerForm.paySchedule,
      payLagDays: Number(employerForm.payLagDays || 0),
      ptoPolicyHoursPerHour: employerForm.ptoPolicyHoursPerHour
        ? Number(employerForm.ptoPolicyHoursPerHour)
        : null,
    })

    if (added) {
      setEmployerForm((current) => ({
        ...current,
        name: '',
        shortCode: '',
        ptoPolicyHoursPerHour: '',
      }))
    }
  }, [addEmployer, employerForm])

  const onAddLocation = useCallback(async () => {
    const added = await addLocation({
      employerId: locationForm.employerId,
      name: locationForm.name,
      shortCode: locationForm.shortCode,
    })

    if (added) {
      setLocationForm((current) => ({
        ...current,
        name: '',
        shortCode: '',
      }))
    }
  }, [addLocation, locationForm])

  const onDeleteShift = useCallback(
    async (shiftId: string) => {
      setBusyShiftId(shiftId)
      try {
        await deleteShift(shiftId)
      } finally {
        setBusyShiftId(null)
      }
    },
    [deleteShift],
  )

  const onDuplicateShift = useCallback(
    async (shift: ShiftRecord) => {
      setBusyShiftId(shift.id)
      try {
        const today = new Date().toISOString().slice(0, 10)
        await addShift({
          shiftDate: today,
          employerId: shift.employer_id,
          locationId: shift.location_id,
          hoursWorked: Number(shift.hours_worked || 0),
          grossPay: Number(shift.gross_pay || 0),
          notes: shift.notes ?? '',
          isNonPay: shift.is_non_pay,
        })
      } finally {
        setBusyShiftId(null)
      }
    },
    [addShift],
  )

  const onQuickAddRecent = useCallback(async () => {
    if (!mostRecentShift) return
    clearMessages()
    setQuickAdding(true)
    try {
      const today = new Date().toISOString().slice(0, 10)
      await addShift({
        shiftDate: today,
        employerId: mostRecentShift.employer_id,
        locationId: mostRecentShift.location_id,
        hoursWorked: Number(mostRecentShift.hours_worked || 0),
        grossPay: Number(mostRecentShift.gross_pay || 0),
        notes: mostRecentShift.notes ?? '',
        isNonPay: mostRecentShift.is_non_pay,
      })
    } finally {
      setQuickAdding(false)
    }
  }, [addShift, clearMessages, mostRecentShift])

  const onEditShift = useCallback((shift: ShiftRecord) => {
    clearMessages()
    setEditingShift(shift)
    setIsAddShiftOpen(true)
  }, [clearMessages])

  const onSubmitShift = useCallback(
    async (input: Parameters<typeof addShift>[0]) => {
      if (editingShift) {
        return updateShift({
          shiftId: editingShift.id,
          ...input,
        })
      }
      return addShift(input)
    },
    [addShift, editingShift, updateShift],
  )

  if (sessionLoading || !userId) {
    return <p className="text-sm text-muted-foreground">Loading shift log...</p>
  }

  return (
    <section className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Shift Log</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Track shifts across employers, watch weekly goal gap, and monitor PTO accrual.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {mostRecentShift ? (
              <button
                type="button"
                onClick={() => {
                  void onQuickAddRecent()
                }}
                disabled={saving || quickAdding}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors-fast hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
              >
                {quickAdding ? 'Adding...' : 'Add last shift'}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                clearMessages()
                setEditingShift(null)
                setIsAddShiftOpen(true)
              }}
              disabled={saving || employers.length === 0}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors-fast hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Add shift
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 text-sm text-muted-foreground sm:grid-cols-3">
          <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
            <p className="text-xs uppercase tracking-wide">Employers</p>
            <p className="mt-1 text-lg font-semibold text-foreground">{employers.length}</p>
          </div>
          <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
            <p className="text-xs uppercase tracking-wide">Logged shifts</p>
            <p className="mt-1 text-lg font-semibold text-foreground">{weeks.reduce((sum, week) => sum + week.shifts.length, 0)}</p>
          </div>
          <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
            <p className="text-xs uppercase tracking-wide">Gross tracked</p>
            <p className="mt-1 text-lg font-semibold text-foreground">${totalPayAllWeeks.toFixed(2)}</p>
          </div>
        </div>

        {currentWeekSummary ? (
          <div className="mt-3 rounded-lg border border-border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p>
                This week: <span className="font-semibold text-foreground">${currentWeekSummary.totalPay.toFixed(2)}</span> of $
                {weeklyGoal.toFixed(2)} goal
              </p>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  currentWeekSummary.goalMet ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'
                }`}
              >
                {currentWeekSummary.goalMet
                  ? `+$${Math.abs(currentWeekSummary.stillNeed).toFixed(2)} over`
                  : `$${Math.abs(currentWeekSummary.stillNeed).toFixed(2)} to go`}
              </span>
            </div>
          </div>
        ) : null}

        {error ? <div className="mt-4 rounded-lg border border-red-200 bg-red-50/80 px-3 py-2 text-sm text-red-700">{error}</div> : null}
        {success ? (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-sm text-emerald-700">
            {success}
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <WeeklyGoalTrend weeks={weeks} employersById={employersById} weeklyGoal={weeklyGoal} />
        <EmployerWeeklyComparison weeks={weeks} employersById={employersById} weeklyGoal={weeklyGoal} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-foreground">Weekly goal settings</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground">Weekly gross goal</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={goalDraft}
                onChange={(event) => setGoalDraft(event.target.value)}
                className="w-full rounded-lg border border-input px-3 py-2 text-foreground outline-none ring-ring transition focus:border-primary focus:ring-2"
              />
            </label>
            <label className="space-y-1 text-sm">
              <span className="text-muted-foreground">Week grouping</span>
              <select
                value={weekStartsDraft}
                onChange={(event) => setWeekStartsDraft(event.target.value === '1' ? 1 : 0)}
                className="w-full rounded-lg border border-input px-3 py-2 text-foreground outline-none ring-ring transition focus:border-primary focus:ring-2"
              >
                {weekStartOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button
            type="button"
            onClick={() => {
              void onSavePreferences()
            }}
            disabled={saving}
            className="mt-3 rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition-colors-fast hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
          >
            Save preferences
          </button>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-foreground">Employers and locations</h2>

          <div className="mt-3 space-y-2 rounded-lg border border-border bg-muted/20 p-3">
            <p className="text-sm font-medium text-foreground">Add employer</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                value={employerForm.name}
                onChange={(event) => setEmployerForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Employer name"
                className="rounded-lg border border-input px-3 py-2 text-sm text-foreground outline-none ring-ring transition focus:border-primary focus:ring-2"
              />
              <input
                value={employerForm.shortCode}
                onChange={(event) =>
                  setEmployerForm((current) => ({ ...current, shortCode: event.target.value.toUpperCase() }))
                }
                placeholder="Short code"
                className="rounded-lg border border-input px-3 py-2 text-sm text-foreground outline-none ring-ring transition focus:border-primary focus:ring-2"
              />
              <select
                value={employerForm.paySchedule}
                onChange={(event) =>
                  setEmployerForm((current) => ({
                    ...current,
                    paySchedule: event.target.value as 'weekly' | 'biweekly' | 'semimonthly',
                  }))
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
                onChange={(event) => setEmployerForm((current) => ({ ...current, payLagDays: event.target.value }))}
                placeholder="Pay lag days"
                className="rounded-lg border border-input px-3 py-2 text-sm text-foreground outline-none ring-ring transition focus:border-primary focus:ring-2"
              />
              <input
                value={employerForm.color}
                onChange={(event) => setEmployerForm((current) => ({ ...current, color: event.target.value }))}
                placeholder="#2563EB"
                className="rounded-lg border border-input px-3 py-2 text-sm text-foreground outline-none ring-ring transition focus:border-primary focus:ring-2"
              />
              <input
                type="number"
                step="0.0001"
                min="0"
                value={employerForm.ptoPolicyHoursPerHour}
                onChange={(event) =>
                  setEmployerForm((current) => ({ ...current, ptoPolicyHoursPerHour: event.target.value }))
                }
                placeholder="PTO accrual per hour (optional)"
                className="rounded-lg border border-input px-3 py-2 text-sm text-foreground outline-none ring-ring transition focus:border-primary focus:ring-2"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                void onAddEmployer()
              }}
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
                onChange={(event) => setLocationForm((current) => ({ ...current, employerId: event.target.value }))}
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
                onChange={(event) => setLocationForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Location name"
                className="rounded-lg border border-input px-3 py-2 text-sm text-foreground outline-none ring-ring transition focus:border-primary focus:ring-2"
              />
              <input
                value={locationForm.shortCode}
                onChange={(event) =>
                  setLocationForm((current) => ({ ...current, shortCode: event.target.value.toUpperCase() }))
                }
                placeholder="Short code"
                className="rounded-lg border border-input px-3 py-2 text-sm text-foreground outline-none ring-ring transition focus:border-primary focus:ring-2"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                void onAddLocation()
              }}
              disabled={saving || !locationForm.employerId || !locationForm.name.trim() || !locationForm.shortCode.trim()}
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
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Weekly shift blocks</h2>

        {loading ? <p className="text-sm text-muted-foreground">Loading shifts...</p> : null}
        {!loading && employers.length === 0 ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 text-sm text-amber-800">
            Add at least one employer before logging shifts.
          </p>
        ) : null}
        {!loading && employers.length > 0 && weeks.length === 0 ? (
          <p className="rounded-lg border border-border bg-card px-3 py-6 text-center text-sm text-muted-foreground">
            No shifts yet. Click <span className="font-medium text-foreground">Add shift</span> to get started.
          </p>
        ) : null}

        {weeks.map((week, index) => (
          <WeekBlock
            key={week.key}
            week={week}
            weeklyGoal={weeklyGoal}
            employersById={employersById}
            locationsById={locationsById}
            onEditShift={onEditShift}
            onDuplicateShift={onDuplicateShift}
            onDeleteShift={onDeleteShift}
            busyShiftId={busyShiftId}
            defaultExpanded={index === 0}
          />
        ))}
      </div>

      <AddShiftModal
        open={isAddShiftOpen}
        onClose={() => {
          setIsAddShiftOpen(false)
          setEditingShift(null)
        }}
        onSubmit={onSubmitShift}
        employers={employers}
        locationsByEmployerId={locationsByEmployerId}
        saving={saving}
        title={editingShift ? 'Edit shift' : 'Add shift'}
        submitLabel={editingShift ? 'Update shift' : 'Save shift'}
        seedShift={
          !editingShift && mostRecentShift
            ? {
                employerId: mostRecentShift.employer_id,
                locationId: mostRecentShift.location_id,
                hoursWorked: mostRecentShift.hours_worked,
                grossPay: mostRecentShift.gross_pay,
                notes: mostRecentShift.notes,
                isNonPay: mostRecentShift.is_non_pay,
              }
            : null
        }
        initialShift={
          editingShift
            ? {
                shiftDate: editingShift.shift_date,
                employerId: editingShift.employer_id,
                locationId: editingShift.location_id,
                hoursWorked: editingShift.hours_worked,
                grossPay: editingShift.gross_pay,
                notes: editingShift.notes,
                isNonPay: editingShift.is_non_pay,
              }
            : null
        }
      />
    </section>
  )
}

