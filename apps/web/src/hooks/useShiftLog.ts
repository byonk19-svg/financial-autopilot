import { useCallback, useEffect, useMemo, useState } from 'react'
import { captureException } from '@/lib/errorReporting'
import { supabase } from '@/lib/supabase'
import { calcWeekSummary, groupShiftsByWeek } from '@/lib/shiftWeeks'
import type {
  EmployerLocationRecord,
  EmployerPaySchedule,
  EmployerRecord,
  ShiftRecord,
  ShiftWeek,
} from '@/lib/types'

const DEFAULT_WEEKLY_GOAL = 2040

export type NewEmployerInput = {
  name: string
  shortCode: string
  color: string
  paySchedule: EmployerPaySchedule
  payLagDays: number
  ptoPolicyHoursPerHour: number | null
}

export type NewLocationInput = {
  employerId: string
  name: string
  shortCode: string
}

export type NewShiftInput = {
  shiftDate: string
  employerId: string
  locationId: string | null
  hoursWorked: number
  grossPay: number
  notes: string
  isNonPay: boolean
}

export type UpdateShiftInput = NewShiftInput & {
  shiftId: string
}

export type EmployerFormState = {
  name: string
  shortCode: string
  color: string
  paySchedule: EmployerPaySchedule
  payLagDays: string
  ptoPolicyHoursPerHour: string
}

export type LocationFormState = {
  employerId: string
  name: string
  shortCode: string
}

function normalizeNumber(value: number): number {
  if (Number.isNaN(value)) return 0
  return Math.round(value * 100) / 100
}

export function useShiftLog(userId: string | undefined) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [weeklyGoal, setWeeklyGoal] = useState<number>(DEFAULT_WEEKLY_GOAL)
  const [weekStartsOn, setWeekStartsOn] = useState<0 | 1>(0)

  const [employers, setEmployers] = useState<EmployerRecord[]>([])
  const [locations, setLocations] = useState<EmployerLocationRecord[]>([])
  const [shifts, setShifts] = useState<ShiftRecord[]>([])

  const loadShiftLogData = useCallback(async () => {
    if (!userId) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')

    try {
      const [prefsResult, employersResult, locationsResult, shiftsResult] = await Promise.all([
        supabase
          .from('user_preferences')
          .select('weekly_income_goal, week_starts_on')
          .eq('user_id', userId)
          .maybeSingle(),
        supabase
          .from('employers')
          .select('id, user_id, name, short_code, color, pay_schedule, pay_lag_days, pto_policy_hours_per_hour, is_active')
          .eq('user_id', userId)
          .eq('is_active', true)
          .order('name', { ascending: true }),
        supabase
          .from('employer_locations')
          .select('id, user_id, employer_id, name, short_code, is_active')
          .eq('user_id', userId)
          .eq('is_active', true)
          .order('name', { ascending: true }),
        supabase
          .from('shifts')
          .select('id, user_id, shift_date, employer_id, location_id, hours_worked, gross_pay, notes, is_non_pay, created_at')
          .eq('user_id', userId)
          .order('shift_date', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(5000),
      ])

      if (prefsResult.error) throw prefsResult.error
      if (employersResult.error) throw employersResult.error
      if (locationsResult.error) throw locationsResult.error
      if (shiftsResult.error) throw shiftsResult.error

      setWeeklyGoal(Number(prefsResult.data?.weekly_income_goal ?? DEFAULT_WEEKLY_GOAL))
      setWeekStartsOn((prefsResult.data?.week_starts_on ?? 0) === 1 ? 1 : 0)
      setEmployers((employersResult.data ?? []) as EmployerRecord[])
      setLocations((locationsResult.data ?? []) as EmployerLocationRecord[])
      setShifts((shiftsResult.data ?? []) as ShiftRecord[])
    } catch (loadError) {
      captureException(loadError, {
        component: 'useShiftLog',
        action: 'load-shift-log-data',
      })
      setError(loadError instanceof Error ? loadError.message : 'Could not load shift log data.')
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    void loadShiftLogData()
  }, [loadShiftLogData])

  const savePreferences = useCallback(
    async (nextWeeklyGoal: number, nextWeekStartsOn: 0 | 1) => {
      if (!userId) return false
      setSaving(true)
      setError('')
      setSuccess('')

      try {
        const { error: upsertError } = await supabase.from('user_preferences').upsert(
          {
            user_id: userId,
            weekly_income_goal: normalizeNumber(nextWeeklyGoal),
            week_starts_on: nextWeekStartsOn,
          },
          { onConflict: 'user_id' },
        )

        if (upsertError) throw upsertError

        setWeeklyGoal(normalizeNumber(nextWeeklyGoal))
        setWeekStartsOn(nextWeekStartsOn)
        setSuccess('Weekly goal preferences saved.')
      } catch (saveError) {
        captureException(saveError, {
          component: 'useShiftLog',
          action: 'save-preferences',
        })
        setError(saveError instanceof Error ? saveError.message : 'Could not save preferences.')
      } finally {
        setSaving(false)
      }
    },
    [userId],
  )

  const addEmployer = useCallback(
    async (input: NewEmployerInput): Promise<boolean> => {
      if (!userId) return false

      setSaving(true)
      setError('')
      setSuccess('')

      try {
        const { data, error: insertError } = await supabase
          .from('employers')
          .insert({
            user_id: userId,
            name: input.name.trim(),
            short_code: input.shortCode.trim().toUpperCase(),
            color: input.color,
            pay_schedule: input.paySchedule,
            pay_lag_days: input.payLagDays,
            pto_policy_hours_per_hour: input.ptoPolicyHoursPerHour,
            is_active: true,
          })
          .select('id, user_id, name, short_code, color, pay_schedule, pay_lag_days, pto_policy_hours_per_hour, is_active')
          .single()

        if (insertError) throw insertError

        setEmployers((current) => [...current, data as EmployerRecord].sort((a, b) => a.name.localeCompare(b.name)))
        setSuccess('Employer added.')
        return true
      } catch (insertError) {
        captureException(insertError, {
          component: 'useShiftLog',
          action: 'add-employer',
        })
        setError(insertError instanceof Error ? insertError.message : 'Could not add employer.')
        return false
      } finally {
        setSaving(false)
      }
    },
    [userId],
  )

  const addLocation = useCallback(
    async (input: NewLocationInput): Promise<boolean> => {
      if (!userId) return false

      setSaving(true)
      setError('')
      setSuccess('')

      try {
        const { data, error: insertError } = await supabase
          .from('employer_locations')
          .insert({
            user_id: userId,
            employer_id: input.employerId,
            name: input.name.trim(),
            short_code: input.shortCode.trim().toUpperCase(),
            is_active: true,
          })
          .select('id, user_id, employer_id, name, short_code, is_active')
          .single()

        if (insertError) throw insertError

        setLocations((current) => [...current, data as EmployerLocationRecord].sort((a, b) => a.name.localeCompare(b.name)))
        setSuccess('Location added.')
        return true
      } catch (insertError) {
        captureException(insertError, {
          component: 'useShiftLog',
          action: 'add-location',
        })
        setError(insertError instanceof Error ? insertError.message : 'Could not add location.')
        return false
      } finally {
        setSaving(false)
      }
    },
    [userId],
  )

  const addShift = useCallback(
    async (input: NewShiftInput): Promise<boolean> => {
      if (!userId) return false

      setSaving(true)
      setError('')
      setSuccess('')

      try {
        const { data, error: insertError } = await supabase
          .from('shifts')
          .insert({
            user_id: userId,
            shift_date: input.shiftDate,
            employer_id: input.employerId,
            location_id: input.locationId,
            hours_worked: normalizeNumber(input.hoursWorked),
            gross_pay: input.isNonPay ? 0 : normalizeNumber(input.grossPay),
            notes: input.notes.trim() || null,
            is_non_pay: input.isNonPay,
          })
          .select('id, user_id, shift_date, employer_id, location_id, hours_worked, gross_pay, notes, is_non_pay, created_at')
          .single()

        if (insertError) throw insertError

        setShifts((current) => [data as ShiftRecord, ...current])
        setSuccess('Shift logged.')
        return true
      } catch (insertError) {
        captureException(insertError, {
          component: 'useShiftLog',
          action: 'add-shift',
        })
        setError(insertError instanceof Error ? insertError.message : 'Could not save shift.')
        return false
      } finally {
        setSaving(false)
      }
    },
    [userId],
  )

  const updateShift = useCallback(
    async (input: UpdateShiftInput): Promise<boolean> => {
      if (!userId) return false

      setSaving(true)
      setError('')
      setSuccess('')

      const previousShifts = shifts

      setShifts((current) =>
        current.map((shift) =>
          shift.id === input.shiftId
            ? {
                ...shift,
                shift_date: input.shiftDate,
                employer_id: input.employerId,
                location_id: input.locationId,
                hours_worked: normalizeNumber(input.hoursWorked),
                gross_pay: input.isNonPay ? 0 : normalizeNumber(input.grossPay),
                notes: input.notes.trim() || null,
                is_non_pay: input.isNonPay,
              }
            : shift,
        ),
      )

      try {
        const { data, error: updateError } = await supabase
          .from('shifts')
          .update({
            shift_date: input.shiftDate,
            employer_id: input.employerId,
            location_id: input.locationId,
            hours_worked: normalizeNumber(input.hoursWorked),
            gross_pay: input.isNonPay ? 0 : normalizeNumber(input.grossPay),
            notes: input.notes.trim() || null,
            is_non_pay: input.isNonPay,
          })
          .eq('id', input.shiftId)
          .eq('user_id', userId)
          .select('id, user_id, shift_date, employer_id, location_id, hours_worked, gross_pay, notes, is_non_pay, created_at')
          .single()

        if (updateError) throw updateError

        setShifts((current) => current.map((shift) => (shift.id === input.shiftId ? (data as ShiftRecord) : shift)))
        setSuccess('Shift updated.')
        return true
      } catch (updateError) {
        captureException(updateError, {
          component: 'useShiftLog',
          action: 'update-shift',
          shift_id: input.shiftId,
        })
        setShifts(previousShifts)
        setError(updateError instanceof Error ? updateError.message : 'Could not update shift.')
        return false
      } finally {
        setSaving(false)
      }
    },
    [shifts, userId],
  )

  const deleteShift = useCallback(
    async (shiftId: string) => {
      if (!userId) return

      setSaving(true)
      setError('')
      setSuccess('')

      const previousShifts = shifts
      setShifts((current) => current.filter((shift) => shift.id !== shiftId))

      try {
        const { error: deleteError } = await supabase
          .from('shifts')
          .delete()
          .eq('id', shiftId)
          .eq('user_id', userId)

        if (deleteError) throw deleteError

        setSuccess('Shift removed.')
      } catch (deleteError) {
        captureException(deleteError, {
          component: 'useShiftLog',
          action: 'delete-shift',
        })
        setShifts(previousShifts)
        setError(deleteError instanceof Error ? deleteError.message : 'Could not remove shift.')
      } finally {
        setSaving(false)
      }
    },
    [shifts, userId],
  )

  const employersById = useMemo<Record<string, EmployerRecord>>(
    () => employers.reduce((map, employer) => ({ ...map, [employer.id]: employer }), {}),
    [employers],
  )

  const locationsByEmployerId = useMemo<Record<string, EmployerLocationRecord[]>>(() => {
    return locations.reduce<Record<string, EmployerLocationRecord[]>>((map, location) => {
      const list = map[location.employer_id] ?? []
      list.push(location)
      map[location.employer_id] = list
      return map
    }, {})
  }, [locations])

  const locationsById = useMemo<Record<string, EmployerLocationRecord>>(
    () => locations.reduce((map, location) => ({ ...map, [location.id]: location }), {}),
    [locations],
  )

  const weeks = useMemo<ShiftWeek[]>(() => groupShiftsByWeek(shifts, weekStartsOn), [shifts, weekStartsOn])

  // ─── UI / page-level state ────────────────────────────────────────────────

  const [goalDraft, setGoalDraft] = useState(String(weeklyGoal))
  const [weekStartsDraft, setWeekStartsDraft] = useState<0 | 1>(weekStartsOn)
  const [employerForm, setEmployerForm] = useState<EmployerFormState>({
    name: '',
    shortCode: '',
    color: '#2563EB',
    paySchedule: 'biweekly',
    payLagDays: '14',
    ptoPolicyHoursPerHour: '',
  })
  const [locationForm, setLocationForm] = useState<LocationFormState>({
    employerId: '',
    name: '',
    shortCode: '',
  })
  const [isAddShiftOpen, setIsAddShiftOpen] = useState(false)
  const [editingShift, setEditingShift] = useState<ShiftRecord | null>(null)
  const [busyShiftId, setBusyShiftId] = useState<string | null>(null)
  const [quickAdding, setQuickAdding] = useState(false)

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

  const clearMessages = useCallback(() => {
    setError('')
    setSuccess('')
  }, [])

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
      setLocationForm((current) => ({ ...current, name: '', shortCode: '' }))
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

  const onEditShift = useCallback(
    (shift: ShiftRecord) => {
      clearMessages()
      setEditingShift(shift)
      setIsAddShiftOpen(true)
    },
    [clearMessages],
  )

  const onSubmitShift = useCallback(
    async (input: NewShiftInput) => {
      if (editingShift) {
        return updateShift({ shiftId: editingShift.id, ...input })
      }
      return addShift(input)
    },
    [addShift, editingShift, updateShift],
  )

  const openAddShift = useCallback(() => {
    clearMessages()
    setEditingShift(null)
    setIsAddShiftOpen(true)
  }, [clearMessages])

  const closeAddShift = useCallback(() => {
    setIsAddShiftOpen(false)
    setEditingShift(null)
  }, [])

  return {
    // data layer
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
    reload: loadShiftLogData,
    clearMessages,
    // UI state
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
    // derived
    totalPayAllWeeks,
    mostRecentShift,
    currentWeekSummary,
    // callbacks
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
  }
}

