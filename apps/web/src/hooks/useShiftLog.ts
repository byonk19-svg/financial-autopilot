import { useCallback, useEffect, useMemo, useState } from 'react'
import { captureException } from '@/lib/errorReporting'
import { supabase } from '@/lib/supabase'
import { groupShiftsByWeek } from '@/lib/shiftWeeks'
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

  return {
    loading,
    saving,
    error,
    success,
    weeklyGoal,
    weekStartsOn,
    employers,
    locations,
    shifts,
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
    reload: loadShiftLogData,
    clearMessages: () => {
      setError('')
      setSuccess('')
    },
  }
}

