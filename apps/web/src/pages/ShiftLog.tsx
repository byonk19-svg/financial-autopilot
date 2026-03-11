import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import AddShiftModal from '@/components/shift-log/AddShiftModal'
import EmployerWeeklyComparison from '@/components/shift-log/EmployerWeeklyComparison'
import { ManageEmployersCard } from '@/components/shift-log/ManageEmployersCard'
import WeekBlock from '@/components/shift-log/WeekBlock'
import WeeklyGoalTrend from '@/components/shift-log/WeeklyGoalTrend'
import { useShiftLog } from '@/hooks/useShiftLog'
import { getLoginRedirectPath } from '@/lib/loginRedirect'
import { useSession } from '@/lib/session'

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
    employers,
    locations,
    weeks,
    employersById,
    locationsById,
    locationsByEmployerId,
    goalDraft,
    setGoalDraft,
    weekStartsDraft,
    setWeekStartsDraft,
    employerForm,
    setEmployerForm,
    locationForm,
    setLocationForm,
    isAddShiftOpen,
    editingShift,
    busyShiftId,
    quickAdding,
    totalPayAllWeeks,
    mostRecentShift,
    currentWeekSummary,
    onSavePreferences,
    onAddEmployer,
    onAddLocation,
    onDeleteShift,
    onDuplicateShift,
    onQuickAddRecent,
    onEditShift,
    onSubmitShift,
    openAddShift,
    closeAddShift,
  } = useShiftLog(userId)

  useEffect(() => {
    if (!sessionLoading && !userId) {
      navigate(getLoginRedirectPath('/shift-log'), { replace: true })
    }
  }, [navigate, sessionLoading, userId])

  if (sessionLoading || !userId) {
    return <p className="text-sm text-muted-foreground">Loading shift log...</p>
  }

  return (
    <section className="space-y-6">
      {/* Header */}
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
              onClick={openAddShift}
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
            <p className="mt-1 text-lg font-semibold text-foreground">
              {weeks.reduce((sum, week) => sum + week.shifts.length, 0)}
            </p>
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
                This week:{' '}
                <span className="font-semibold text-foreground">
                  ${currentWeekSummary.totalPay.toFixed(2)}
                </span>{' '}
                of ${weeklyGoal.toFixed(2)} goal
              </p>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  currentWeekSummary.goalMet
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {currentWeekSummary.goalMet
                  ? `+$${Math.abs(currentWeekSummary.stillNeed).toFixed(2)} over`
                  : `$${Math.abs(currentWeekSummary.stillNeed).toFixed(2)} to go`}
              </span>
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50/80 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        ) : null}
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
        {/* Weekly goal settings */}
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

        <ManageEmployersCard
          employers={employers}
          locations={locations}
          saving={saving}
          employerForm={employerForm}
          locationForm={locationForm}
          onEmployerFormChange={(updates) => setEmployerForm((current) => ({ ...current, ...updates }))}
          onLocationFormChange={(updates) => setLocationForm((current) => ({ ...current, ...updates }))}
          onAddEmployer={() => {
            void onAddEmployer()
          }}
          onAddLocation={() => {
            void onAddLocation()
          }}
        />
      </div>

      {/* Weekly shift blocks */}
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
        onClose={closeAddShift}
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
