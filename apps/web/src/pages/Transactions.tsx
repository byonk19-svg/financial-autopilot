import { format } from 'date-fns'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useSession } from '../lib/session'

type AccountOption = {
  id: string
  name: string
}

type CategoryOption = {
  id: string
  name: string
}

type TransactionRow = {
  id: string
  account_id: string
  category_id: string | null
  user_category_id: string | null
  posted_at: string
  merchant_normalized: string | null
  description_short: string
  amount: number | string
  currency: string
}

function parseAmount(value: number | string): number {
  if (typeof value === 'number') return value
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function dateOnly(isoDate: string): string {
  return isoDate.slice(0, 10)
}

export default function Transactions() {
  const navigate = useNavigate()
  const { session, loading } = useSession()

  const [accounts, setAccounts] = useState<AccountOption[]>([])
  const [categories, setCategories] = useState<CategoryOption[]>([])
  const [transactions, setTransactions] = useState<TransactionRow[]>([])
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState('')

  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [accountFilter, setAccountFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [search, setSearch] = useState('')

  const accountNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const account of accounts) map.set(account.id, account.name)
    return map
  }, [accounts])

  const categoryNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const category of categories) map.set(category.id, category.name)
    return map
  }, [categories])

  useEffect(() => {
    const loadData = async () => {
      if (loading) return
      if (!session?.user) {
        navigate('/login', { replace: true })
        return
      }

      setFetching(true)
      setError('')

      const [accountsResult, categoriesResult, transactionsResult] = await Promise.all([
        supabase
          .from('accounts')
          .select('id, name')
          .eq('user_id', session.user.id)
          .order('name', { ascending: true }),
        supabase
          .from('categories')
          .select('id, name')
          .eq('user_id', session.user.id)
          .order('name', { ascending: true }),
        supabase
          .from('transactions')
          .select(
            'id, account_id, category_id, user_category_id, posted_at, merchant_normalized, description_short, amount, currency',
          )
          .eq('user_id', session.user.id)
          .eq('is_deleted', false)
          .order('posted_at', { ascending: false })
          .limit(1000),
      ])

      if (accountsResult.error || categoriesResult.error || transactionsResult.error) {
        setError('Could not load transactions.')
        setFetching(false)
        return
      }

      setAccounts((accountsResult.data ?? []) as AccountOption[])
      setCategories((categoriesResult.data ?? []) as CategoryOption[])
      setTransactions((transactionsResult.data ?? []) as TransactionRow[])
      setFetching(false)
    }

    void loadData()
  }, [loading, navigate, session])

  const filteredTransactions = useMemo(() => {
    const query = search.trim().toLowerCase()

    return transactions.filter((transaction) => {
      if (accountFilter && transaction.account_id !== accountFilter) return false

      const effectiveCategoryId = transaction.user_category_id ?? transaction.category_id ?? ''
      if (categoryFilter && effectiveCategoryId !== categoryFilter) return false

      const postedDate = dateOnly(transaction.posted_at)
      if (startDate && postedDate < startDate) return false
      if (endDate && postedDate > endDate) return false

      if (!query) return true

      const searchable = `${transaction.merchant_normalized ?? ''} ${transaction.description_short}`
        .toLowerCase()
      return searchable.includes(query)
    })
  }, [accountFilter, categoryFilter, endDate, search, startDate, transactions])

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Transactions</h1>
        <p className="mt-2 text-sm text-slate-600">Filter and review synced transactions.</p>

        <div className="mt-6 grid gap-3 md:grid-cols-2 lg:grid-cols-5">
          <input
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none ring-cyan-500 focus:ring-2"
          />
          <input
            type="date"
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none ring-cyan-500 focus:ring-2"
          />
          <select
            value={accountFilter}
            onChange={(event) => setAccountFilter(event.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-cyan-500 focus:ring-2"
          >
            <option value="">All accounts</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
          <select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-cyan-500 focus:ring-2"
          >
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search merchant or description"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none ring-cyan-500 focus:ring-2"
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        {fetching ? (
          <p className="p-6 text-sm text-slate-600">Loading transactions...</p>
        ) : error ? (
          <p className="p-6 text-sm text-rose-600">{error}</p>
        ) : (
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-100 text-left text-slate-700">
              <tr>
                <th className="px-4 py-3 font-semibold">Date</th>
                <th className="px-4 py-3 font-semibold">Merchant</th>
                <th className="px-4 py-3 font-semibold">Description</th>
                <th className="px-4 py-3 font-semibold">Amount</th>
                <th className="px-4 py-3 font-semibold">Category</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTransactions.map((transaction) => {
                const amount = parseAmount(transaction.amount)
                const effectiveCategoryId = transaction.user_category_id ?? transaction.category_id
                const categoryName = effectiveCategoryId
                  ? categoryNameById.get(effectiveCategoryId)
                  : null

                return (
                  <tr key={transaction.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-700">
                      {format(new Date(transaction.posted_at), 'yyyy-MM-dd')}
                    </td>
                    <td className="px-4 py-3 text-slate-800">
                      {transaction.merchant_normalized || accountNameById.get(transaction.account_id) || '-'}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{transaction.description_short}</td>
                    <td
                      className={`px-4 py-3 font-medium ${amount < 0 ? 'text-emerald-700' : 'text-slate-900'}`}
                    >
                      {amount.toLocaleString(undefined, {
                        style: 'currency',
                        currency: transaction.currency || 'USD',
                      })}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{categoryName ?? 'Uncategorized'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </section>
  )
}
