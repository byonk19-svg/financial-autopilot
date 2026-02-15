import { useEffect, useMemo, useState } from 'react'
import { Check, SlidersHorizontal } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { SubscriptionRow } from '@/components/SubscriptionRow'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  hasPriceIncrease,
  parseDate,
  toCurrency,
  toNumber,
  type DensityMode,
  type SubscriptionCadence,
} from '@/lib/subscriptionFormatters'
import { functionUrl } from '@/lib/functions'
import { supabase } from '@/lib/supabase'
import { useSession } from '@/lib/session'

type SubscriptionClassification = 'needs_review' | 'subscription' | 'bill_loan' | 'transfer' | 'ignore'

type SubscriptionRecord = {
  id: string
  merchant_normalized: string
  cadence: SubscriptionCadence
  classification: SubscriptionClassification
  user_locked: boolean
  last_amount: number | string | null
  prev_amount: number | string | null
  next_expected_at: string | null
  confidence: number | string
  is_active: boolean
}

type GroupedRecurringResponse = {
  ok: boolean
  grouped: Record<SubscriptionClassification, SubscriptionRecord[]>
}

type CadenceFilter = 'all' | 'weekly' | 'monthly' | 'annual'

const DENSITY_STORAGE_KEY = 'subscriptions_density'
const ENABLE_RERUN_DETECTION = import.meta.env.VITE_ENABLE_RERUN_DETECTION === 'true'

const DENSITY_LABELS: Record<DensityMode, string> = {
  comfortable: 'Comfortable',
  compact: 'Compact',
}

function toMonthlyAmount(row: SubscriptionRecord): number {
  const amount = toNumber(row.last_amount)
  if (amount <= 0) return 0
  if (row.cadence === 'weekly') return amount * (52 / 12)
  if (row.cadence === 'monthly') return amount
  if (row.cadence === 'quarterly') return amount / 3
  if (row.cadence === 'yearly') return amount / 12
  return amount
}

function normalizeClassification(value: string): SubscriptionClassification {
  if (value === 'subscription') return 'subscription'
  if (value === 'bill_loan') return 'bill_loan'
  if (value === 'transfer') return 'transfer'
  if (value === 'ignore') return 'ignore'
  return 'needs_review'
}

function StatTile({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint: string
}) {
  return (
    <Card className="border-slate-200 shadow-sm">
      <CardContent className="px-3 py-2.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-0.5 text-lg font-semibold text-foreground md:text-xl">{value}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  )
}

function FilterBar({
  searchQuery,
  onSearchChange,
  cadenceFilter,
  onCadenceChange,
  priceIncreaseOnly,
  onPriceIncreaseOnlyChange,
  showIgnored,
  onShowIgnoredChange,
  density,
  onDensityChange,
  hasFiltersApplied,
  onClearFilters,
}: {
  searchQuery: string
  onSearchChange: (value: string) => void
  cadenceFilter: CadenceFilter
  onCadenceChange: (value: CadenceFilter) => void
  priceIncreaseOnly: boolean
  onPriceIncreaseOnlyChange: (value: boolean) => void
  showIgnored: boolean
  onShowIgnoredChange: (value: boolean) => void
  density: DensityMode
  onDensityChange: (value: DensityMode) => void
  hasFiltersApplied: boolean
  onClearFilters: () => void
}) {
  const compact = density === 'compact'

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardContent className={`space-y-3 ${compact ? 'p-3' : 'p-3.5'}`}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search merchant"
            className={compact ? 'h-8 text-xs' : 'h-9 text-sm'}
          />

          <div className="flex shrink-0 items-center gap-2">
            <Button
              type="button"
              variant={priceIncreaseOnly ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => onPriceIncreaseOnlyChange(!priceIncreaseOnly)}
            >
              {priceIncreaseOnly && <Check className="h-3.5 w-3.5" />}
              Price increase only
            </Button>
            <Button
              type="button"
              variant={showIgnored ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => onShowIgnoredChange(!showIgnored)}
            >
              {showIgnored && <Check className="h-3.5 w-3.5" />}
              Show ignored
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" size="sm" className="gap-1.5">
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  Options
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Density</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={density}
                  onValueChange={(value: string) => onDensityChange(value as DensityMode)}
                >
                  <DropdownMenuRadioItem value="comfortable">Comfortable</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="compact">Compact</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>

                {hasFiltersApplied && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={onClearFilters}>Clear filters</DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <Tabs
          value={cadenceFilter}
          onValueChange={(value: string) => onCadenceChange(value as CadenceFilter)}
        >
          <TabsList className="h-8 w-full justify-start overflow-x-auto">
            <TabsTrigger value="all" className="text-xs">
              All cadence
            </TabsTrigger>
            <TabsTrigger value="weekly" className="text-xs">
              Weekly
            </TabsTrigger>
            <TabsTrigger value="monthly" className="text-xs">
              Monthly
            </TabsTrigger>
            <TabsTrigger value="annual" className="text-xs">
              Annual
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <p className="text-xs text-muted-foreground">
          Needs Review is sorted by confidence (lowest first), then next expected date. Other sections sort by next
          expected date. Density is set to <span className="font-medium text-foreground">{DENSITY_LABELS[density]}</span>.
        </p>
      </CardContent>
    </Card>
  )
}

function ListHeaderRow({ density }: { density: DensityMode }) {
  const compact = density === 'compact'
  return (
    <div
      className={`hidden rounded-lg border border-slate-200 bg-slate-50 font-semibold uppercase tracking-wide text-muted-foreground xl:grid xl:grid-cols-[minmax(0,2.1fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,1fr)_auto] xl:items-center xl:gap-3 ${
        compact ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs'
      }`}
    >
      <span>Merchant</span>
      <span className="text-right">Last</span>
      <span className="text-right">Previous</span>
      <span className="text-right">Next expected</span>
      <span className="text-right">Action</span>
    </div>
  )
}

function LoadingSkeleton({ density }: { density: DensityMode }) {
  const compact = density === 'compact'
  const rowCount = compact ? 10 : 8

  return (
    <section className="space-y-2.5 overflow-hidden" aria-live="polite" aria-busy="true">
      <div className="h-5 w-56 animate-pulse rounded bg-slate-200" />
      <div className="hidden h-8 animate-pulse rounded-lg bg-slate-100 xl:block" />
      <div className={compact ? 'space-y-1.5' : 'space-y-2'}>
        {Array.from({ length: rowCount }).map((_, index) => (
          <Card
            key={index}
            className={`animate-pulse border-slate-200 shadow-sm ${compact ? 'p-2.5' : 'p-3'}`}
          >
            <div
              className={`grid grid-cols-1 md:grid-cols-2 xl:grid-cols-[minmax(0,2.1fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,1fr)_auto] ${compact ? 'gap-2' : 'gap-3'}`}
            >
              <div className="space-y-2">
                <div className={`rounded bg-slate-200 ${compact ? 'h-3 w-40' : 'h-4 w-48'}`} />
                <div className={`rounded bg-slate-100 ${compact ? 'h-2.5 w-28' : 'h-3 w-36'}`} />
              </div>
              <div className="space-y-2 md:text-right">
                <div className={`ml-auto rounded bg-slate-100 ${compact ? 'h-2.5 w-10' : 'h-3 w-12'}`} />
                <div className={`ml-auto rounded bg-slate-200 ${compact ? 'h-3 w-16' : 'h-4 w-20'}`} />
              </div>
              <div className="space-y-2 md:text-right">
                <div className={`ml-auto rounded bg-slate-100 ${compact ? 'h-2.5 w-14' : 'h-3 w-16'}`} />
                <div className={`ml-auto rounded bg-slate-200 ${compact ? 'h-3 w-16' : 'h-4 w-20'}`} />
              </div>
              <div className="space-y-2 md:text-right">
                <div className={`ml-auto rounded bg-slate-100 ${compact ? 'h-2.5 w-16' : 'h-3 w-20'}`} />
                <div className={`ml-auto rounded bg-slate-200 ${compact ? 'h-3 w-20' : 'h-4 w-24'}`} />
              </div>
              <div className="flex justify-start xl:justify-end">
                <div
                  className={`rounded border border-slate-200 bg-slate-100 ${compact ? 'h-6 w-20' : 'h-7 w-24'}`}
                />
              </div>
            </div>
          </Card>
        ))}
      </div>
    </section>
  )
}

function Section({
  title,
  description,
  emptyText,
  rows,
  processingId,
  onMarkInactive,
  onSetClassification,
  onToggleClassificationLock,
  onUndoClassification,
  showClassifyControl = false,
  density,
  defaultExpanded = true,
}: {
  title: string
  description: string
  emptyText: string
  rows: SubscriptionRecord[]
  processingId: string
  onMarkInactive: (subscription: SubscriptionRecord) => Promise<void>
  onSetClassification: (
    subscription: SubscriptionRecord,
    classification: SubscriptionClassification,
    createRule: boolean,
  ) => Promise<void>
  onToggleClassificationLock: (subscription: SubscriptionRecord) => Promise<void>
  onUndoClassification: (subscription: SubscriptionRecord) => Promise<void>
  showClassifyControl?: boolean
  density: DensityMode
  defaultExpanded?: boolean
}) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const compact = density === 'compact'

  return (
    <Card className="overflow-hidden border-slate-200 shadow-sm">
      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        aria-expanded={expanded}
        className={`flex w-full items-center justify-between gap-3 text-left ${compact ? 'p-3' : 'p-3.5'}`}
      >
        <div>
          <h2 className={`font-semibold text-foreground ${compact ? 'text-base' : 'text-lg'}`}>{title}</h2>
          <p className={`text-muted-foreground ${compact ? 'text-xs' : 'text-sm'}`}>{description}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className={compact ? 'text-[10px]' : 'text-xs'}>
            {rows.length}
          </Badge>
          <span className={`${compact ? 'text-xs' : 'text-sm'} font-medium text-muted-foreground`}>
            {expanded ? 'Hide' : 'Show'}
          </span>
        </div>
      </button>

      {expanded && (
        <CardContent className={`border-t border-slate-200 ${compact ? 'p-2.5' : 'p-3'}`}>
          {rows.length === 0 ? (
            <p className={`text-muted-foreground ${compact ? 'text-xs' : 'text-sm'}`}>{emptyText}</p>
          ) : (
            <div className={compact ? 'space-y-1.5' : 'space-y-2'}>
              <ListHeaderRow density={density} />
              {rows.map((subscription) => (
                <SubscriptionRow
                  key={subscription.id}
                  merchant={subscription.merchant_normalized}
                  cadence={subscription.cadence}
                  confidence={subscription.confidence}
                  lastAmount={subscription.last_amount}
                  prevAmount={subscription.prev_amount}
                  nextExpected={subscription.next_expected_at}
                  hasIncrease={
                    hasPriceIncrease({
                      lastAmount: subscription.last_amount,
                      prevAmount: subscription.prev_amount,
                    })
                  }
                  classification={subscription.classification}
                  userLocked={subscription.user_locked}
                  density={density}
                  isUpdating={processingId === subscription.id}
                  onMarkInactive={() => onMarkInactive(subscription)}
                  onSetClassification={
                    showClassifyControl
                      ? (classification, createRule) =>
                          onSetClassification(subscription, classification, createRule)
                      : undefined
                  }
                  showClassifyControl={showClassifyControl}
                  onToggleLock={() => onToggleClassificationLock(subscription)}
                  onUndoClassification={() => onUndoClassification(subscription)}
                />
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}

export default function Subscriptions() {
  const navigate = useNavigate()
  const { session, loading } = useSession()

  const [subscriptions, setSubscriptions] = useState<SubscriptionRecord[]>([])
  const [fetching, setFetching] = useState(true)
  const [processingId, setProcessingId] = useState('')
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [cadenceFilter, setCadenceFilter] = useState<CadenceFilter>('all')
  const [priceIncreaseOnly, setPriceIncreaseOnly] = useState(false)
  const [showIgnored, setShowIgnored] = useState(false)
  const [rerunningDetection, setRerunningDetection] = useState(false)
  const [density, setDensity] = useState<DensityMode>(() => {
    if (typeof window === 'undefined') return 'comfortable'
    const savedDensity = window.localStorage.getItem(DENSITY_STORAGE_KEY)
    return savedDensity === 'compact' ? 'compact' : 'comfortable'
  })

  const getAccessToken = async (): Promise<string | null> => {
    const { data: current } = await supabase.auth.getSession()
    const currentSession = current.session

    if (currentSession?.access_token) {
      const expiresAtMs = (currentSession.expires_at ?? 0) * 1000
      const oneMinuteFromNow = Date.now() + 60_000
      if (!expiresAtMs || expiresAtMs > oneMinuteFromNow) {
        return currentSession.access_token
      }
    }

    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession()
    if (!refreshError && refreshed.session?.access_token) {
      return refreshed.session.access_token
    }

    return currentSession?.access_token ?? null
  }

  const fetchRecurring = async (): Promise<SubscriptionRecord[]> => {
    const token = await getAccessToken()
    if (!token) {
      throw new Error('Your session expired. Please log in again.')
    }

    const response = await fetch(functionUrl('recurring'), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    const payload = (await response.json().catch(() => ({}))) as
      | GroupedRecurringResponse
      | { error?: string }

    if (!response.ok) {
      throw new Error((payload as { error?: string }).error ?? 'Could not load recurring patterns.')
    }

    const grouped = (payload as GroupedRecurringResponse).grouped
    const orderedClasses: SubscriptionClassification[] = [
      'subscription',
      'bill_loan',
      'needs_review',
      'transfer',
      'ignore',
    ]

    return orderedClasses.flatMap((classification) =>
      (grouped?.[classification] ?? []).map((row) => ({
        ...row,
        classification: normalizeClassification(row.classification ?? 'needs_review'),
        user_locked: row.user_locked === true,
        is_active: true,
      })),
    )
  }

  const classifyRecurring = async (
    subscriptionId: string,
    body: { classification: SubscriptionClassification; lock?: boolean; createRule?: boolean },
  ) => {
    const token = await getAccessToken()
    if (!token) {
      throw new Error('Your session expired. Please log in again.')
    }

    const response = await fetch(functionUrl(`recurring/${subscriptionId}/classify`), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    })

    const payload = (await response.json().catch(() => ({}))) as {
      error?: string
      recurring?: Partial<SubscriptionRecord>
    }

    if (!response.ok) {
      throw new Error(payload.error ?? 'Could not classify recurring pattern.')
    }

    return payload.recurring ?? null
  }

  const loadSubscriptions = async () => {
    if (!session?.user) return
    setFetching(true)
    setError('')
    try {
      const rows = await fetchRecurring()
      setSubscriptions(rows)
    } catch (loadError) {
      const detail = loadError instanceof Error ? loadError.message : 'Could not load subscriptions.'
      setError(detail)
    } finally {
      setFetching(false)
    }
  }

  useEffect(() => {
    if (loading) return
    if (!session?.user) {
      navigate('/login', { replace: true })
      return
    }
    void loadSubscriptions()
  }, [loading, navigate, session])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(DENSITY_STORAGE_KEY, density)
  }, [density])

  const markInactive = async (subscription: SubscriptionRecord) => {
    if (!session?.user) return
    setProcessingId(subscription.id)
    setError('')

    const { error: updateError } = await supabase
      .from('subscriptions')
      .update({ is_active: false })
      .eq('id', subscription.id)
      .eq('user_id', session.user.id)

    if (updateError) {
      setError('Could not mark subscription inactive.')
      setProcessingId('')
      return
    }

    setSubscriptions((current) => current.filter((row) => row.id !== subscription.id))
    setProcessingId('')
  }

  const setClassification = async (
    subscription: SubscriptionRecord,
    classification: SubscriptionClassification,
    createRule: boolean,
  ) => {
    if (!session?.user) return
    setProcessingId(subscription.id)
    setError('')

    let previousState: SubscriptionRecord[] = []
    setSubscriptions((current) => {
      previousState = current
      return current.map((row) =>
        row.id === subscription.id
          ? {
              ...row,
              classification,
              user_locked: true,
            }
          : row,
      )
    })

    try {
      const recurring = await classifyRecurring(subscription.id, {
        classification,
        lock: true,
        createRule,
      })
      setSubscriptions((current) =>
        current.map((row) =>
          row.id === subscription.id
            ? {
                ...row,
                ...(recurring ?? {}),
              }
            : row,
        ),
      )
    } catch (updateError) {
      setSubscriptions(previousState)
      const detail = updateError instanceof Error ? updateError.message : 'Could not update classification.'
      setError(detail)
    } finally {
      setProcessingId('')
    }
  }

  const toggleClassificationLock = async (subscription: SubscriptionRecord) => {
    if (!session?.user) return
    setProcessingId(subscription.id)
    setError('')

    try {
      const nextLocked = !subscription.user_locked
      const recurring = await classifyRecurring(subscription.id, {
        classification: normalizeClassification(subscription.classification),
        lock: nextLocked,
        createRule: false,
      })
      setSubscriptions((current) =>
        current.map((row) =>
          row.id === subscription.id
            ? {
                ...row,
                user_locked: nextLocked,
                ...(recurring ?? {}),
              }
            : row,
        ),
      )
    } catch (updateError) {
      const detail = updateError instanceof Error ? updateError.message : 'Could not update lock state.'
      setError(detail)
    } finally {
      setProcessingId('')
    }
  }

  const undoClassification = async (subscription: SubscriptionRecord) => {
    if (!session?.user) return
    setProcessingId(subscription.id)
    setError('')

    let previousState: SubscriptionRecord[] = []
    setSubscriptions((current) => {
      previousState = current
      return current.map((row) =>
        row.id === subscription.id
          ? {
              ...row,
              classification: 'needs_review',
              user_locked: false,
            }
          : row,
      )
    })

    try {
      const recurring = await classifyRecurring(subscription.id, {
        classification: 'needs_review',
        lock: false,
        createRule: false,
      })
      setSubscriptions((current) =>
        current.map((row) =>
          row.id === subscription.id
            ? {
                ...row,
                ...(recurring ?? {}),
              }
            : row,
        ),
      )
    } catch (undoError) {
      setSubscriptions(previousState)
      const detail = undoError instanceof Error ? undoError.message : 'Could not undo classification.'
      setError(detail)
    } finally {
      setProcessingId('')
    }
  }

  const clearFilters = () => {
    setSearchQuery('')
    setCadenceFilter('all')
    setPriceIncreaseOnly(false)
    setShowIgnored(false)
  }

  const rerunDetection = async () => {
    if (!ENABLE_RERUN_DETECTION) return
    setRerunningDetection(true)
    setError('')

    try {
      const { error: invokeError } = await supabase.functions.invoke('analysis-daily', {
        body: {},
      })

      if (invokeError) {
        throw invokeError
      }

      await loadSubscriptions()
    } catch {
      setError('Could not re-run detection from this environment.')
    } finally {
      setRerunningDetection(false)
    }
  }

  const allSubscriptionRows = useMemo(() => subscriptions.filter((row) => row.classification === 'subscription'), [subscriptions])
  const allBillAndLoanRows = useMemo(() => subscriptions.filter((row) => row.classification === 'bill_loan'), [subscriptions])
  const allReviewRows = useMemo(() => subscriptions.filter((row) => row.classification === 'needs_review'), [subscriptions])

  const filteredRows = useMemo(() => {
    const search = searchQuery.trim().toLowerCase()

    return subscriptions.filter((row) => {
      const merchant = row.merchant_normalized.toLowerCase()
      const matchesSearch = search.length === 0 || merchant.includes(search)

      const matchesCadence =
        cadenceFilter === 'all'
          ? true
          : cadenceFilter === 'annual'
            ? row.cadence === 'yearly'
            : row.cadence === cadenceFilter

      const matchesIncrease =
        !priceIncreaseOnly ||
        hasPriceIncrease({
          lastAmount: row.last_amount,
          prevAmount: row.prev_amount,
        })

      const matchesIgnored = showIgnored ? true : row.classification !== 'ignore'

      return matchesSearch && matchesCadence && matchesIncrease && matchesIgnored
    })
  }, [subscriptions, searchQuery, cadenceFilter, priceIncreaseOnly, showIgnored])

  const sortByNextExpected = (a: SubscriptionRecord, b: SubscriptionRecord) => {
    const aDate = parseDate(a.next_expected_at)
    const bDate = parseDate(b.next_expected_at)
    if (aDate && bDate) return aDate.getTime() - bDate.getTime()
    if (aDate && !bDate) return -1
    if (!aDate && bDate) return 1
    return a.merchant_normalized.localeCompare(b.merchant_normalized)
  }

  const reviewRows = useMemo(() => {
    return filteredRows
      .filter((row) => row.classification === 'needs_review')
      .sort((a, b) => {
        const confidenceDiff = toNumber(a.confidence) - toNumber(b.confidence)
        if (confidenceDiff !== 0) return confidenceDiff
        return sortByNextExpected(a, b)
      })
  }, [filteredRows])

  const subscriptionRows = useMemo(
    () => filteredRows.filter((row) => row.classification === 'subscription').sort(sortByNextExpected),
    [filteredRows]
  )
  const billAndLoanRows = useMemo(
    () => filteredRows.filter((row) => row.classification === 'bill_loan').sort(sortByNextExpected),
    [filteredRows]
  )
  const transferRows = useMemo(
    () => filteredRows.filter((row) => row.classification === 'transfer').sort(sortByNextExpected),
    [filteredRows]
  )
  const ignoredRows = useMemo(
    () => filteredRows.filter((row) => row.classification === 'ignore').sort(sortByNextExpected),
    [filteredRows]
  )

  const monthlySubscriptionsTotal = useMemo(
    () => allSubscriptionRows.reduce((sum, row) => sum + toMonthlyAmount(row), 0),
    [allSubscriptionRows]
  )
  const billsAndLoansTotal = useMemo(
    () => allBillAndLoanRows.reduce((sum, row) => sum + toNumber(row.last_amount), 0),
    [allBillAndLoanRows]
  )
  const nextSevenDaysSummary = useMemo(() => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const cutoff = new Date(today)
    cutoff.setDate(cutoff.getDate() + 7)

    return subscriptions.reduce(
      (acc, row) => {
        const dueDate = parseDate(row.next_expected_at)
        if (!dueDate) return acc
        if (dueDate >= today && dueDate <= cutoff) {
          acc.count += 1
          acc.amount += toNumber(row.last_amount)
        }
        return acc
      },
      { count: 0, amount: 0 }
    )
  }, [subscriptions])

  const flaggedIncreases = useMemo(
    () =>
      subscriptions.filter((row) =>
        hasPriceIncrease({
          lastAmount: row.last_amount,
          prevAmount: row.prev_amount,
        })
      ).length,
    [subscriptions]
  )

  const hasFiltersApplied = searchQuery.trim().length > 0 || cadenceFilter !== 'all' || priceIncreaseOnly || showIgnored
  const isEmptyData = !fetching && subscriptions.length === 0
  const visibleRowCount =
    reviewRows.length + subscriptionRows.length + billAndLoanRows.length + transferRows.length + (showIgnored ? ignoredRows.length : 0)
  const isNoMatches = !fetching && subscriptions.length > 0 && visibleRowCount === 0

  return (
    <section className="mx-auto w-full max-w-6xl space-y-4 overflow-x-hidden">
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="space-y-2 p-4">
          <CardTitle className="text-2xl md:text-3xl">Recurring Charge Dashboard</CardTitle>
          <CardDescription className="text-sm md:text-base">
            Review subscriptions, bills or loans, and low-confidence candidates in one place.
          </CardDescription>
        </CardHeader>
        {!fetching && (
          <CardContent className="grid grid-cols-2 gap-3 p-4 pt-0 lg:grid-cols-4">
            <StatTile
              label="Monthly Subs Total"
              value={toCurrency(monthlySubscriptionsTotal)}
              hint={`${allSubscriptionRows.length} active services`}
            />
            <StatTile
              label="Bills/Loans Total"
              value={toCurrency(billsAndLoansTotal)}
              hint={`${allBillAndLoanRows.length} fixed obligations`}
            />
            <StatTile
              label="Next 7 Days Due"
              value={`${nextSevenDaysSummary.count}`}
              hint={toCurrency(nextSevenDaysSummary.amount)}
            />
            <StatTile
              label="Flagged Increases"
              value={`${flaggedIncreases}`}
              hint={`${allReviewRows.length} candidates to review`}
            />
          </CardContent>
        )}
      </Card>

      {!fetching && (
        <FilterBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          cadenceFilter={cadenceFilter}
          onCadenceChange={setCadenceFilter}
          priceIncreaseOnly={priceIncreaseOnly}
          onPriceIncreaseOnlyChange={setPriceIncreaseOnly}
          showIgnored={showIgnored}
          onShowIgnoredChange={setShowIgnored}
          density={density}
          onDensityChange={setDensity}
          hasFiltersApplied={hasFiltersApplied}
          onClearFilters={clearFilters}
        />
      )}

      {fetching ? (
        <LoadingSkeleton density={density} />
      ) : isEmptyData ? (
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="p-5">
            <CardTitle className="text-lg">No subscriptions found yet</CardTitle>
            <CardDescription>
              We have not detected recurring charges yet. Sync your latest transactions and run detection.
            </CardDescription>
          </CardHeader>
          {ENABLE_RERUN_DETECTION && (
            <CardContent className="p-5 pt-0">
              <Button type="button" onClick={() => void rerunDetection()} disabled={rerunningDetection}>
                {rerunningDetection ? 'Re-running detection...' : 'Re-run detection'}
              </Button>
            </CardContent>
          )}
        </Card>
      ) : isNoMatches ? (
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="p-5">
            <CardTitle className="text-lg">No matches</CardTitle>
            <CardDescription>No recurring charges match your current search and filters.</CardDescription>
          </CardHeader>
          {hasFiltersApplied && (
            <CardContent className="p-5 pt-0">
              <Button type="button" variant="outline" onClick={clearFilters}>
                Clear filters
              </Button>
            </CardContent>
          )}
        </Card>
      ) : (
        <div className="space-y-4">
          <Section
            title="Subscriptions"
            description="Streaming, apps, and service subscriptions."
            emptyText="No active subscriptions found."
            rows={subscriptionRows}
            processingId={processingId}
            onMarkInactive={markInactive}
            onSetClassification={setClassification}
            onToggleClassificationLock={toggleClassificationLock}
            onUndoClassification={undoClassification}
            density={density}
          />
          <Section
            title="Bills and Loans"
            description="Fixed obligations such as utilities, insurance, and loan payments."
            emptyText="No active bills or loans found."
            rows={billAndLoanRows}
            processingId={processingId}
            onMarkInactive={markInactive}
            onSetClassification={setClassification}
            onToggleClassificationLock={toggleClassificationLock}
            onUndoClassification={undoClassification}
            density={density}
          />
          <Section
            title="Transfers"
            description="Recurring transfer patterns."
            emptyText="No recurring transfers found."
            rows={transferRows}
            processingId={processingId}
            onMarkInactive={markInactive}
            onSetClassification={setClassification}
            onToggleClassificationLock={toggleClassificationLock}
            onUndoClassification={undoClassification}
            density={density}
          />
          <Section
            title="Needs Review"
            description="Only recurring candidates still awaiting your decision."
            emptyText="No low-confidence candidates to review."
            rows={reviewRows}
            processingId={processingId}
            onMarkInactive={markInactive}
            onSetClassification={setClassification}
            onToggleClassificationLock={toggleClassificationLock}
            onUndoClassification={undoClassification}
            showClassifyControl
            density={density}
          />
          {showIgnored && (
            <Section
              title="Ignored"
              description="Patterns marked to be ignored."
              emptyText="No ignored recurring patterns."
              rows={ignoredRows}
              processingId={processingId}
              onMarkInactive={markInactive}
              onSetClassification={setClassification}
              onToggleClassificationLock={toggleClassificationLock}
              onUndoClassification={undoClassification}
              density={density}
            />
          )}
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </section>
  )
}
