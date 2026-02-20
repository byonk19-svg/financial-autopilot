import { useState } from 'react'
import { Lock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type {
  SubscriptionCadence,
  SubscriptionClassification,
  SubscriptionHistoryRow,
} from '@/lib/types'
import {
  defaultNotifyDaysForCadence,
  effectiveNotifyDays,
  formatIncreaseDelta,
  toCadenceLabel,
  toCurrency,
  toMonthlyEquivalentAmount,
  toNumber,
  toRenewalLabel,
  toShortDate,
  type DensityMode,
} from '@/lib/subscriptionFormatters'

export type SubscriptionRowProps = {
  merchant: string
  cadence: SubscriptionCadence
  confidence: number | string
  lastAmount: number | string | null
  prevAmount: number | string | null
  nextExpected: string | null
  notifyDaysBefore: number | null
  hasIncrease: boolean
  classification: SubscriptionClassification
  isFalsePositive: boolean
  userLocked: boolean
  density: DensityMode
  isUpdating: boolean
  historyRows: SubscriptionHistoryRow[]
  historyLoading: boolean
  onExpandChange?: (expanded: boolean) => void
  onMarkFalsePositive?: (rerunAfterMark: boolean) => void | Promise<void>
  onMarkInactive: () => void | Promise<void>
  onSetClassification?: (next: SubscriptionClassification, createRule: boolean) => void | Promise<void>
  onUpdateNotifyDaysBefore?: (next: number | null) => void | Promise<void>
  showClassifyControl?: boolean
  onToggleLock?: () => void | Promise<void>
  onUndoClassification?: () => void | Promise<void>
}

function classificationLabel(classification: SubscriptionRowProps['classification']): string {
  if (classification === 'subscription') return 'Subscription'
  if (classification === 'bill_loan') return 'Bills/Loans'
  if (classification === 'transfer') return 'Transfers'
  if (classification === 'ignore') return 'Ignored'
  return 'Needs Review'
}

export function SubscriptionRow({
  merchant,
  cadence,
  confidence,
  lastAmount,
  prevAmount,
  nextExpected,
  notifyDaysBefore,
  hasIncrease,
  classification,
  isFalsePositive,
  userLocked,
  density,
  isUpdating,
  historyRows,
  historyLoading,
  onExpandChange,
  onMarkFalsePositive,
  onMarkInactive,
  onSetClassification,
  onUpdateNotifyDaysBefore,
  showClassifyControl = false,
  onToggleLock,
  onUndoClassification,
}: SubscriptionRowProps) {
  const compact = density === 'compact'
  const badgeSize = compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-xs'
  const buttonSize = compact ? 'h-7 px-2.5 text-[11px]' : 'h-8 px-3 text-xs'

  const [expanded, setExpanded] = useState(false)
  const [applyToFutureCharges, setApplyToFutureCharges] = useState(true)
  const [rerunAfterFalsePositive, setRerunAfterFalsePositive] = useState(false)

  const parsedLastAmount = toNumber(lastAmount)
  const parsedPrevAmount = toNumber(prevAmount)
  const confidencePercent = Math.round(toNumber(confidence) * 100)
  const amountChange = parsedPrevAmount > 0 ? parsedLastAmount - parsedPrevAmount : 0
  const increaseDelta = hasIncrease
    ? formatIncreaseDelta({ lastAmount: parsedLastAmount, prevAmount: parsedPrevAmount })
    : ''

  const monthlyEquivalent = toMonthlyEquivalentAmount({ lastAmount: parsedLastAmount, cadence })
  const renewalLabel = toRenewalLabel(nextExpected)
  const defaultNotifyDays = defaultNotifyDaysForCadence(cadence)
  const effectiveNotify = effectiveNotifyDays({ cadence, notifyDaysBefore })
  const notifyFieldId = `notify-${merchant.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${cadence}`
  const falsePositiveFieldId = `false-positive-rerun-${merchant.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${cadence}`
  const historyAmounts = historyRows.map((row) => Math.abs(toNumber(row.amount)))
  const latestHistoryAmount = historyAmounts[0] ?? 0
  const priorAverageAmount =
    historyAmounts.length > 1
      ? historyAmounts.slice(1).reduce((sum, value) => sum + value, 0) / (historyAmounts.length - 1)
      : 0
  const trendRatio = priorAverageAmount > 0 ? (latestHistoryAmount - priorAverageAmount) / priorAverageAmount : 0
  const trendLabel =
    historyRows.length < 2
      ? 'Trend: need at least 2 charges'
      : Math.abs(trendRatio) < 0.03
        ? `Trend: stable vs recent average (${toCurrency(priorAverageAmount)})`
        : trendRatio > 0
          ? `Trend: up ${(trendRatio * 100).toFixed(1)}% vs recent average (${toCurrency(priorAverageAmount)})`
          : `Trend: down ${Math.abs(trendRatio * 100).toFixed(1)}% vs recent average (${toCurrency(priorAverageAmount)})`

  const toggleExpanded = () => {
    setExpanded((current) => {
      const next = !current
      onExpandChange?.(next)
      return next
    })
  }

  return (
    <Card className="overflow-hidden border shadow-sm transition hover:shadow">
      <div
        role="button"
        tabIndex={0}
        onClick={toggleExpanded}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            toggleExpanded()
          }
        }}
        className={`cursor-pointer ${compact ? 'p-2.5' : 'p-3'}`}
      >
        <div
          className={`grid min-w-0 grid-cols-1 items-center md:grid-cols-2 xl:grid-cols-[minmax(0,2.1fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,1fr)_auto] ${
            compact ? 'gap-2' : 'gap-3'
          }`}
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className={`truncate font-semibold text-foreground ${compact ? 'text-sm' : 'text-base'}`}>
                {merchant}
              </h3>
              <Badge variant="secondary" className={`${badgeSize} rounded-full`}>
                {classificationLabel(classification)}
              </Badge>
              {userLocked && (
                <Badge variant="outline" className={`${badgeSize} rounded-full`}>
                  <Lock className="mr-1 h-3 w-3" />
                  Locked
                </Badge>
              )}
              {isFalsePositive && (
                <Badge
                  variant="outline"
                  className={`${badgeSize} rounded-full border-amber-300 bg-amber-50 text-amber-900`}
                >
                  False positive
                </Badge>
              )}
              {hasIncrease && (
                <Badge
                  variant="secondary"
                  className={`${badgeSize} whitespace-nowrap gap-1 rounded-full border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-50`}
                  aria-label={`Price increase ${increaseDelta}`}
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 16 16"
                    className={compact ? 'h-2.5 w-2.5' : 'h-3 w-3'}
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M4.5 11.5L11.5 4.5M6 4.5H11.5V10"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span>{increaseDelta}</span>
                </Badge>
              )}
            </div>
            <p className={`mt-1 text-muted-foreground ${compact ? 'text-xs' : 'text-sm'}`}>
              {toCadenceLabel(cadence)} and {confidencePercent}% confidence
            </p>
          </div>

          <div className={`${compact ? 'text-xs' : 'text-sm'} md:text-right`}>
            <p className={`${compact ? 'text-[11px]' : 'text-xs'} uppercase tracking-wide text-muted-foreground`}>Last</p>
            <p className={`${compact ? 'text-sm' : 'text-base'} font-medium text-foreground`}>
              {toCurrency(parsedLastAmount)}
            </p>
            <p className={`${compact ? 'text-[11px]' : 'text-xs'} text-muted-foreground`}>
              Monthly eq {toCurrency(monthlyEquivalent)}
            </p>
          </div>

          <div className={`${compact ? 'text-xs' : 'text-sm'} md:text-right`}>
            <p className={`${compact ? 'text-[11px]' : 'text-xs'} uppercase tracking-wide text-muted-foreground`}>
              Previous
            </p>
            <p className={`${compact ? 'text-sm' : 'text-base'} font-medium text-foreground`}>
              {parsedPrevAmount > 0 ? toCurrency(parsedPrevAmount) : 'N/A'}
            </p>
          </div>

          <div className={`${compact ? 'text-xs' : 'text-sm'} md:text-right`}>
            <p className={`${compact ? 'text-[11px]' : 'text-xs'} uppercase tracking-wide text-muted-foreground`}>
              Next expected
            </p>
            <p className={`${compact ? 'text-sm' : 'text-base'} font-medium text-foreground`}>
              {toShortDate(nextExpected)}
            </p>
            <p className={`${compact ? 'text-[11px]' : 'text-xs'} text-muted-foreground`}>{renewalLabel}</p>
          </div>

          <div className="flex flex-wrap items-center justify-start gap-2 xl:justify-end">
            {showClassifyControl && onSetClassification && (
              <select
                aria-label={`Classify ${merchant}`}
                value={classification}
                disabled={isUpdating}
                onClick={(event) => event.stopPropagation()}
                onChange={(event) =>
                  void onSetClassification(
                    event.target.value as SubscriptionClassification,
                    applyToFutureCharges,
                  )
                }
                className={`rounded-md border bg-background text-foreground ${compact ? 'h-7 px-2 text-[11px]' : 'h-8 px-2.5 text-xs'}`}
              >
                <option value="needs_review">Needs review</option>
                <option value="subscription">Subscription</option>
                <option value="bill_loan">Bills/Loans</option>
                <option value="transfer">Transfers</option>
                <option value="ignore">Ignored</option>
              </select>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={(event) => {
                event.stopPropagation()
                void onMarkInactive()
              }}
              disabled={isUpdating}
              className={buttonSize}
            >
              {isUpdating ? 'Updating...' : 'Mark inactive'}
            </Button>
          </div>
        </div>

        {expanded && (
          <>
            <div
              className={`grid grid-cols-1 border-t sm:grid-cols-2 lg:grid-cols-5 ${
                compact ? 'mt-2 gap-2 pt-2' : 'mt-3 gap-3 pt-3'
              }`}
            >
              <div className={`rounded-lg bg-muted/40 ${compact ? 'px-2.5 py-1.5' : 'px-3 py-2'}`}>
                <p className={`${compact ? 'text-[11px]' : 'text-xs'} uppercase tracking-wide text-muted-foreground`}>
                  Cadence
                </p>
                <p className={`mt-1 font-medium text-foreground ${compact ? 'text-xs' : 'text-sm'}`}>
                  {toCadenceLabel(cadence)}
                </p>
              </div>
              <div className={`rounded-lg bg-muted/40 ${compact ? 'px-2.5 py-1.5' : 'px-3 py-2'}`}>
                <p className={`${compact ? 'text-[11px]' : 'text-xs'} uppercase tracking-wide text-muted-foreground`}>
                  Confidence
                </p>
                <p className={`mt-1 font-medium text-foreground ${compact ? 'text-xs' : 'text-sm'}`}>
                  {confidencePercent}%
                </p>
              </div>
              <div className={`rounded-lg bg-muted/40 ${compact ? 'px-2.5 py-1.5' : 'px-3 py-2'}`}>
                <p className={`${compact ? 'text-[11px]' : 'text-xs'} uppercase tracking-wide text-muted-foreground`}>
                  Amount change
                </p>
                <p className={`mt-1 font-medium text-foreground ${compact ? 'text-xs' : 'text-sm'}`}>
                  {parsedPrevAmount > 0 ? toCurrency(amountChange) : 'N/A'}
                </p>
              </div>
              <div className={`rounded-lg bg-muted/40 ${compact ? 'px-2.5 py-1.5' : 'px-3 py-2'}`}>
                <p className={`${compact ? 'text-[11px]' : 'text-xs'} uppercase tracking-wide text-muted-foreground`}>
                  Classification
                </p>
                <p className={`mt-1 font-medium text-foreground ${compact ? 'text-xs' : 'text-sm'}`}>
                  {classificationLabel(classification)}
                </p>
              </div>
              <div className={`rounded-lg bg-muted/40 ${compact ? 'px-2.5 py-1.5' : 'px-3 py-2'}`}>
                <p className={`${compact ? 'text-[11px]' : 'text-xs'} uppercase tracking-wide text-muted-foreground`}>
                  Notify before
                </p>
                <p className={`mt-1 font-medium text-foreground ${compact ? 'text-xs' : 'text-sm'}`}>
                  {effectiveNotify} day{effectiveNotify === 1 ? '' : 's'}
                </p>
              </div>
            </div>

            {(showClassifyControl || onToggleLock || onUndoClassification || onUpdateNotifyDaysBefore) && (
              <div
                className={`mt-2 flex flex-wrap items-center gap-2 ${compact ? 'text-[11px]' : 'text-xs'}`}
                onClick={(event) => event.stopPropagation()}
              >
                {onUpdateNotifyDaysBefore && (
                  <div className="flex items-center gap-2">
                    <label className="font-medium text-muted-foreground" htmlFor={notifyFieldId}>
                      Renewal alert
                    </label>
                    <select
                      id={notifyFieldId}
                      value={notifyDaysBefore === null ? 'default' : String(notifyDaysBefore)}
                      disabled={isUpdating}
                      onChange={(event) => {
                        const value = event.target.value
                        void onUpdateNotifyDaysBefore(value === 'default' ? null : Number.parseInt(value, 10))
                      }}
                      className={`rounded-md border bg-background text-foreground ${compact ? 'h-7 px-2' : 'h-8 px-2.5'}`}
                    >
                      <option value="default">Default ({defaultNotifyDays} days)</option>
                      <option value="1">1 day</option>
                      <option value="3">3 days</option>
                      <option value="5">5 days</option>
                      <option value="7">7 days</option>
                      <option value="14">14 days</option>
                    </select>
                  </div>
                )}

                {showClassifyControl && onSetClassification && (
                  <select
                    value={classification}
                    disabled={isUpdating}
                    onChange={(event) =>
                      void onSetClassification(
                        event.target.value as SubscriptionClassification,
                        applyToFutureCharges,
                      )
                    }
                    className={`rounded-md border bg-background text-foreground ${compact ? 'h-7 px-2' : 'h-8 px-2.5'}`}
                  >
                    <option value="needs_review">Needs review</option>
                    <option value="subscription">Subscription</option>
                    <option value="bill_loan">Bills/Loans</option>
                    <option value="transfer">Transfers</option>
                    <option value="ignore">Ignored (not recurring)</option>
                  </select>
                )}
                {showClassifyControl && onSetClassification && (
                  <label className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 rounded border"
                      checked={applyToFutureCharges}
                      disabled={isUpdating}
                      onChange={(event) => setApplyToFutureCharges(event.target.checked)}
                    />
                    Apply to future charges from this merchant
                  </label>
                )}
                {onToggleLock && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isUpdating}
                    onClick={() => void onToggleLock()}
                    className={buttonSize}
                  >
                    {userLocked ? 'Unlock' : 'Lock'}
                  </Button>
                )}
                {onUndoClassification && (classification !== 'needs_review' || userLocked) && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isUpdating}
                    onClick={() => void onUndoClassification()}
                    className={buttonSize}
                  >
                    Undo
                  </Button>
                )}
              </div>
            )}

            {(onMarkFalsePositive || historyLoading || historyRows.length > 0) && (
              <div className={`mt-3 rounded-lg border bg-muted/20 ${compact ? 'p-2.5' : 'p-3'}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className={`font-semibold text-foreground ${compact ? 'text-xs' : 'text-sm'}`}>
                    Linked transaction history
                  </h4>
                  <p className={`text-muted-foreground ${compact ? 'text-[11px]' : 'text-xs'}`}>{trendLabel}</p>
                </div>

                {historyLoading ? (
                  <p className={`mt-2 text-muted-foreground ${compact ? 'text-xs' : 'text-sm'}`}>
                    Loading recent linked transactions...
                  </p>
                ) : historyRows.length === 0 ? (
                  <p className={`mt-2 text-muted-foreground ${compact ? 'text-xs' : 'text-sm'}`}>
                    No linked transactions found for this recurring pattern yet.
                  </p>
                ) : (
                  <ul className={`mt-2 divide-y rounded-md border bg-background ${compact ? 'text-xs' : 'text-sm'}`}>
                    {historyRows.map((row) => (
                      <li
                        key={row.id}
                        className={`grid grid-cols-1 gap-1 sm:grid-cols-[minmax(0,1fr)_auto] ${
                          compact ? 'px-2.5 py-1.5' : 'px-3 py-2'
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="truncate text-foreground">{row.description_short}</p>
                          <p className={`text-muted-foreground ${compact ? 'text-[11px]' : 'text-xs'}`}>
                            {toShortDate(row.posted_at)} | {row.account_name ?? 'Unknown account'}
                          </p>
                        </div>
                        <p className="font-medium text-foreground">
                          {toCurrency(Math.abs(toNumber(row.amount)))}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}

                {onMarkFalsePositive && (
                  <div
                    className={`mt-3 flex flex-wrap items-center gap-2 ${compact ? 'text-[11px]' : 'text-xs'}`}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <label className="inline-flex items-center gap-1.5 text-muted-foreground" htmlFor={falsePositiveFieldId}>
                      <input
                        id={falsePositiveFieldId}
                        type="checkbox"
                        className="h-3.5 w-3.5 rounded border"
                        checked={rerunAfterFalsePositive}
                        disabled={isUpdating}
                        onChange={(event) => setRerunAfterFalsePositive(event.target.checked)}
                      />
                      Re-run analysis after save
                    </label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isUpdating || isFalsePositive}
                      onClick={() => void onMarkFalsePositive(rerunAfterFalsePositive)}
                      className={buttonSize}
                    >
                      {isFalsePositive ? 'Marked false positive' : 'Not a subscription'}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        <p className={`mt-1.5 text-muted-foreground ${compact ? 'text-[11px]' : 'text-xs'}`}>
          {expanded ? 'Click row to collapse details' : 'Click row to expand details'}
        </p>
      </div>
    </Card>
  )
}
