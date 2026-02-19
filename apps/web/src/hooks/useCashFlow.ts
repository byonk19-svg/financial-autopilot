import { addMonths, endOfMonth, format, parse, startOfMonth } from 'date-fns'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { findUpcomingLowPoints, getBillsForMonth, buildMonthLedger } from '@/lib/cashFlowLedger'
import { captureException } from '@/lib/errorReporting'
import { supabase } from '@/lib/supabase'
import type {
  CashFlowBillTemplate,
  CashFlowLedgerDay,
  CashFlowProjectedIncome,
  CashFlowTransaction,
  EmployerRecord,
  MonthBalanceRecord,
} from '@/lib/types'
import { toNumber } from '@/lib/subscriptionFormatters'

const DEFAULT_LOW_BALANCE_THRESHOLD = 500

export type NewBillTemplateInput = {
  name: string
  amount: number
  dueDayOfMonth: number
  category: 'bill' | 'expense' | 'transfer'
  color: string
}

export type NewProjectedIncomeInput = {
  expectedDate: string
  amount: number
  description: string
  employerId: string | null
}

export type CashFlowSummary = {
  incomeTotal: number
  expenseTotal: number
  netTotal: number
  projectedIncome: number
  projectedExpense: number
  lowestBalance: number
  lowestBalanceDate: string | null
}

function toMonthKey(date: Date): string {
  return format(startOfMonth(date), 'yyyy-MM')
}

function parseMonthKey(monthKey: string): Date {
  return startOfMonth(parse(`${monthKey}-01`, 'yyyy-MM-dd', new Date()))
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

export function useCashFlow(userId: string | undefined) {
  const [selectedMonth, setSelectedMonth] = useState(() => toMonthKey(new Date()))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [transactions, setTransactions] = useState<CashFlowTransaction[]>([])
  const [billTemplates, setBillTemplates] = useState<CashFlowBillTemplate[]>([])
  const [projectedIncomes, setProjectedIncomes] = useState<CashFlowProjectedIncome[]>([])
  const [employers, setEmployers] = useState<EmployerRecord[]>([])
  const [monthBalance, setMonthBalance] = useState<MonthBalanceRecord | null>(null)
  const [inferredBalance, setInferredBalance] = useState<number | null>(null)

  const monthDate = useMemo(() => parseMonthKey(selectedMonth), [selectedMonth])
  const monthStart = useMemo(() => format(startOfMonth(monthDate), 'yyyy-MM-dd'), [monthDate])
  const monthEnd = useMemo(() => format(endOfMonth(monthDate), 'yyyy-MM-dd'), [monthDate])
  const nextMonthStart = useMemo(() => format(startOfMonth(addMonths(monthDate, 1)), 'yyyy-MM-dd'), [monthDate])

  // Use manual balance if saved; otherwise fall back to the inferred estimate.
  const isBalanceInferred = monthBalance === null || toNumber(monthBalance.opening_balance) === 0
  const openingBalance = isBalanceInferred
    ? (inferredBalance ?? 0)
    : toNumber(monthBalance.opening_balance)
  const lowBalanceThreshold = toNumber(monthBalance?.low_balance_threshold ?? DEFAULT_LOW_BALANCE_THRESHOLD)

  const loadCashFlowData = useCallback(async () => {
    if (!userId) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')

    try {
      const [transactionsResult, billTemplatesResult, projectedIncomeResult, monthBalanceResult, employersResult] = await Promise.all([
        supabase
          .from('transactions')
          .select('id, posted_at, amount, description_short, merchant_canonical, merchant_normalized')
          .eq('user_id', userId)
          .eq('is_deleted', false)
          .eq('is_pending', false)
          .eq('is_credit', false)   // checking/savings only — excludes CC charges
          .gte('posted_at', `${monthStart}T00:00:00.000Z`)
          .lt('posted_at', `${nextMonthStart}T00:00:00.000Z`)
          .order('posted_at', { ascending: true })
          .limit(5000),
        supabase
          .from('bill_templates')
          .select('id, user_id, name, amount, due_day_of_month, account_id, category, color, is_active, created_at, updated_at')
          .eq('user_id', userId)
          .order('due_day_of_month', { ascending: true }),
        supabase
          .from('projected_incomes')
          .select('id, user_id, expected_date, amount, description, employer_id, is_active, created_at, updated_at')
          .eq('user_id', userId)
          .eq('is_active', true)
          .gte('expected_date', monthStart)
          .lte('expected_date', monthEnd)
          .order('expected_date', { ascending: true }),
        supabase
          .from('month_balances')
          .select('user_id, month_key, opening_balance, low_balance_threshold, created_at, updated_at')
          .eq('user_id', userId)
          .eq('month_key', monthStart)
          .maybeSingle(),
        supabase
          .from('employers')
          .select('id, user_id, name, short_code, color, pay_schedule, pay_lag_days, pto_policy_hours_per_hour, is_active')
          .eq('user_id', userId)
          .eq('is_active', true)
          .order('name', { ascending: true }),
      ])

      if (transactionsResult.error) throw transactionsResult.error
      if (billTemplatesResult.error) throw billTemplatesResult.error
      if (projectedIncomeResult.error) throw projectedIncomeResult.error
      if (monthBalanceResult.error) throw monthBalanceResult.error
      if (employersResult.error && employersResult.error.code !== '42P01') throw employersResult.error

      setTransactions((transactionsResult.data ?? []) as CashFlowTransaction[])
      setBillTemplates((billTemplatesResult.data ?? []) as CashFlowBillTemplate[])
      setProjectedIncomes((projectedIncomeResult.data ?? []) as CashFlowProjectedIncome[])
      setMonthBalance((monthBalanceResult.data ?? null) as MonthBalanceRecord | null)
      setEmployers((employersResult.data ?? []) as EmployerRecord[])

      // If no manual balance is saved for this month, fetch the inferred estimate.
      const savedBalance = monthBalanceResult.data
      if (!savedBalance || toNumber(savedBalance.opening_balance) === 0) {
        const { data: inferData } = await supabase.rpc('infer_checking_opening_balance', {
          p_month: monthStart,
        })
        setInferredBalance(inferData !== null && inferData !== undefined ? toNumber(inferData) : null)
      } else {
        setInferredBalance(null)
      }
    } catch (loadError) {
      captureException(loadError, {
        component: 'useCashFlow',
        action: 'load-cash-flow-data',
      })
      setError(loadError instanceof Error ? loadError.message : 'Could not load cash flow data.')
    } finally {
      setLoading(false)
    }
  }, [monthEnd, monthStart, nextMonthStart, userId])

  useEffect(() => {
    void loadCashFlowData()
  }, [loadCashFlowData])

  const saveMonthSettings = useCallback(
    async (nextOpeningBalance: number, nextLowBalanceThreshold: number): Promise<boolean> => {
      if (!userId) return false
      setSaving(true)
      setError('')
      setSuccess('')

      try {
        const payload = {
          user_id: userId,
          month_key: monthStart,
          opening_balance: round2(nextOpeningBalance),
          low_balance_threshold: round2(nextLowBalanceThreshold),
        }
        const { data, error: upsertError } = await supabase
          .from('month_balances')
          .upsert(payload, { onConflict: 'user_id,month_key' })
          .select('user_id, month_key, opening_balance, low_balance_threshold, created_at, updated_at')
          .single()

        if (upsertError) throw upsertError
        setMonthBalance(data as MonthBalanceRecord)
        setSuccess('Month settings saved.')
        return true
      } catch (saveError) {
        captureException(saveError, {
          component: 'useCashFlow',
          action: 'save-month-settings',
        })
        setError(saveError instanceof Error ? saveError.message : 'Could not save month settings.')
        return false
      } finally {
        setSaving(false)
      }
    },
    [monthStart, userId],
  )

  const addBillTemplate = useCallback(
    async (input: NewBillTemplateInput): Promise<boolean> => {
      if (!userId) return false
      setSaving(true)
      setError('')
      setSuccess('')

      try {
        const { data, error: insertError } = await supabase
          .from('bill_templates')
          .insert({
            user_id: userId,
            name: input.name.trim(),
            amount: round2(-Math.abs(input.amount)),
            due_day_of_month: Math.min(31, Math.max(1, Math.trunc(input.dueDayOfMonth))),
            category: input.category,
            color: input.color,
            is_active: true,
          })
          .select('id, user_id, name, amount, due_day_of_month, account_id, category, color, is_active, created_at, updated_at')
          .single()

        if (insertError) throw insertError
        setBillTemplates((current) =>
          [...current, data as CashFlowBillTemplate].sort((a, b) => a.due_day_of_month - b.due_day_of_month),
        )
        setSuccess('Recurring bill added.')
        return true
      } catch (insertError) {
        captureException(insertError, {
          component: 'useCashFlow',
          action: 'add-bill-template',
        })
        setError(insertError instanceof Error ? insertError.message : 'Could not add recurring bill.')
        return false
      } finally {
        setSaving(false)
      }
    },
    [userId],
  )

  const toggleBillTemplate = useCallback(
    async (templateId: string, isActive: boolean): Promise<void> => {
      if (!userId) return
      setSaving(true)
      setError('')
      setSuccess('')

      try {
        const { error: updateError } = await supabase
          .from('bill_templates')
          .update({ is_active: isActive })
          .eq('id', templateId)
          .eq('user_id', userId)

        if (updateError) throw updateError
        setBillTemplates((current) =>
          current.map((template) => (template.id === templateId ? { ...template, is_active: isActive } : template)),
        )
        setSuccess(isActive ? 'Bill re-enabled.' : 'Bill disabled.')
      } catch (updateError) {
        captureException(updateError, {
          component: 'useCashFlow',
          action: 'toggle-bill-template',
          template_id: templateId,
        })
        setError(updateError instanceof Error ? updateError.message : 'Could not update recurring bill.')
      } finally {
        setSaving(false)
      }
    },
    [userId],
  )

  const addProjectedIncome = useCallback(
    async (input: NewProjectedIncomeInput): Promise<boolean> => {
      if (!userId) return false
      setSaving(true)
      setError('')
      setSuccess('')

      try {
        const { data, error: insertError } = await supabase
          .from('projected_incomes')
          .insert({
            user_id: userId,
            expected_date: input.expectedDate,
            amount: round2(Math.abs(input.amount)),
            description: input.description.trim(),
            employer_id: input.employerId,
            is_active: true,
          })
          .select('id, user_id, expected_date, amount, description, employer_id, is_active, created_at, updated_at')
          .single()

        if (insertError) throw insertError
        setProjectedIncomes((current) =>
          [...current, data as CashFlowProjectedIncome].sort((a, b) => a.expected_date.localeCompare(b.expected_date)),
        )
        setSuccess('Projected income added.')
        return true
      } catch (insertError) {
        captureException(insertError, {
          component: 'useCashFlow',
          action: 'add-projected-income',
        })
        setError(insertError instanceof Error ? insertError.message : 'Could not add projected income.')
        return false
      } finally {
        setSaving(false)
      }
    },
    [userId],
  )

  const removeProjectedIncome = useCallback(
    async (incomeId: string): Promise<void> => {
      if (!userId) return
      setSaving(true)
      setError('')
      setSuccess('')

      try {
        const { error: deleteError } = await supabase
          .from('projected_incomes')
          .delete()
          .eq('id', incomeId)
          .eq('user_id', userId)

        if (deleteError) throw deleteError
        setProjectedIncomes((current) => current.filter((income) => income.id !== incomeId))
        setSuccess('Projected income removed.')
      } catch (deleteError) {
        captureException(deleteError, {
          component: 'useCashFlow',
          action: 'remove-projected-income',
        })
        setError(deleteError instanceof Error ? deleteError.message : 'Could not remove projected income.')
      } finally {
        setSaving(false)
      }
    },
    [userId],
  )

  const ledger = useMemo<CashFlowLedgerDay[]>(
    () =>
      buildMonthLedger({
        month: monthDate,
        openingBalance,
        lowBalanceThreshold,
        transactions,
        billTemplates,
        projectedIncomes,
      }),
    [billTemplates, lowBalanceThreshold, monthDate, openingBalance, projectedIncomes, transactions],
  )

  const billsThisMonth = useMemo(() => getBillsForMonth(billTemplates, monthDate), [billTemplates, monthDate])

  const lowPoints = useMemo(
    () => findUpcomingLowPoints(ledger, lowBalanceThreshold),
    [ledger, lowBalanceThreshold],
  )

  const summary = useMemo<CashFlowSummary>(() => {
    const entries = ledger.flatMap((day) => day.entries)
    const incomeTotal = entries.filter((entry) => entry.amount > 0).reduce((sum, entry) => sum + entry.amount, 0)
    const expenseTotal = entries.filter((entry) => entry.amount < 0).reduce((sum, entry) => sum + Math.abs(entry.amount), 0)
    const projectedIncome = entries
      .filter((entry) => entry.isProjected && entry.amount > 0)
      .reduce((sum, entry) => sum + entry.amount, 0)
    const projectedExpense = entries
      .filter((entry) => entry.isProjected && entry.amount < 0)
      .reduce((sum, entry) => sum + Math.abs(entry.amount), 0)

    const lowestDay = ledger.reduce<CashFlowLedgerDay | null>((lowest, day) => {
      if (!lowest || day.runningBalance < lowest.runningBalance) return day
      return lowest
    }, null)

    return {
      incomeTotal: round2(incomeTotal),
      expenseTotal: round2(expenseTotal),
      netTotal: round2(incomeTotal - expenseTotal),
      projectedIncome: round2(projectedIncome),
      projectedExpense: round2(projectedExpense),
      lowestBalance: round2(lowestDay?.runningBalance ?? openingBalance),
      lowestBalanceDate: lowestDay?.date ?? null,
    }
  }, [ledger, openingBalance])

  const goToPreviousMonth = useCallback(() => {
    setSelectedMonth((current) => toMonthKey(addMonths(parseMonthKey(current), -1)))
  }, [])

  const goToNextMonth = useCallback(() => {
    setSelectedMonth((current) => toMonthKey(addMonths(parseMonthKey(current), 1)))
  }, [])

  const setMonthFromInput = useCallback((monthValue: string) => {
    if (!monthValue) return
    setSelectedMonth(monthValue)
  }, [])

  return {
    loading,
    saving,
    error,
    success,
    selectedMonth,
    monthDate,
    monthStart,
    monthEnd,
    openingBalance,
    isBalanceInferred,
    lowBalanceThreshold,
    billTemplates,
    projectedIncomes,
    employers,
    ledger,
    billsThisMonth,
    lowPoints,
    summary,
    saveMonthSettings,
    addBillTemplate,
    toggleBillTemplate,
    addProjectedIncome,
    removeProjectedIncome,
    reload: loadCashFlowData,
    goToPreviousMonth,
    goToNextMonth,
    setMonthFromInput,
    clearMessages: () => {
      setError('')
      setSuccess('')
    },
  }
}
