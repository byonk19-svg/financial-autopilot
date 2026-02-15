import { useState } from 'react'
import { Lock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  formatIncreaseDelta,
  toCadenceLabel,
  toCurrency,
  toNumber,
  toShortDate,
  type DensityMode,
  type SubscriptionCadence,
} from '../lib/subscriptionFormatters'

export type SubscriptionRowProps = {
  merchant: string
  cadence: SubscriptionCadence
  confidence: number | string
  lastAmount: number | string | null
  prevAmount: number | string | null
  nextExpected: string | null
  hasIncrease: boolean
  classification: 'needs_review' | 'subscription' | 'bill_loan' | 'transfer' | 'ignore'
  userLocked: boolean
  density: DensityMode
  isUpdating: boolean
  onMarkInactive: () => void | Promise<void>
  onSetClassification?: (
    next: 'needs_review' | 'subscription' | 'bill_loan' | 'transfer' | 'ignore',
    createRule: boolean,
  ) => void | Promise<void>
  showClassifyControl?: boolean
  onToggleLock?: () => void | Promise<void>
  onUndoClassification?: () => void | Promise<void>
}

function classificationLabel(classification: SubscriptionRowProps['classification']): string {
  if (classification === 'subscription') return 'Subscription'
  if (classification === 'bill_loan') return 'Bill/Loan'
  if (classification === 'transfer') return 'Transfer'
  if (classification === 'ignore') return 'Ignore'
  return 'Needs review'
}

export function SubscriptionRow({
  merchant,
  cadence,
  confidence,
  lastAmount,
  prevAmount,
  nextExpected,
  hasIncrease,
  classification,
  userLocked,
  density,
  isUpdating,
  onMarkInactive,
  onSetClassification,
  showClassifyControl = false,
  onToggleLock,
  onUndoClassification,
}: SubscriptionRowProps) {
  const compact = density === 'compact'
  const badgeSize = compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-xs'
  const buttonSize = compact ? 'h-7 px-2.5 text-[11px]' : 'h-8 px-3 text-xs'

  const [expanded, setExpanded] = useState(false)
  const [applyToFutureCharges, setApplyToFutureCharges] = useState(true)
  const parsedLastAmount = toNumber(lastAmount)
  const parsedPrevAmount = toNumber(prevAmount)
  const confidencePercent = Math.round(toNumber(confidence) * 100)
  const amountChange = parsedPrevAmount > 0 ? parsedLastAmount - parsedPrevAmount : 0
  const increaseDelta = hasIncrease
    ? formatIncreaseDelta({ lastAmount: parsedLastAmount, prevAmount: parsedPrevAmount })
    : ''

  return (
    <Card className="overflow-hidden border-slate-200 shadow-sm transition hover:border-slate-300 hover:shadow">
      <div
        role="button"
        tabIndex={0}
        onClick={() => setExpanded((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            setExpanded((current) => !current)
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
              <h3 className={`truncate font-semibold text-slate-900 ${compact ? 'text-sm' : 'text-base'}`}>
                {merchant}
              </h3>
              <Badge variant="secondary" className={`${badgeSize} rounded-full`}>
                {classificationLabel(classification)}
              </Badge>
              {userLocked && (
                <Badge variant="outline" className={`${badgeSize} rounded-full border-slate-300 text-slate-700`}>
                  <Lock className="mr-1 h-3 w-3" />
                  Locked
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
            <p className={`mt-1 text-slate-600 ${compact ? 'text-xs' : 'text-sm'}`}>
              {toCadenceLabel(cadence)} and {confidencePercent}% confidence
            </p>
          </div>

          <div className={`${compact ? 'text-xs' : 'text-sm'} md:text-right`}>
            <p className={`${compact ? 'text-[11px]' : 'text-xs'} uppercase tracking-wide text-slate-500`}>Last</p>
            <p className={`${compact ? 'text-sm' : 'text-base'} font-medium text-slate-900`}>
              {toCurrency(parsedLastAmount)}
            </p>
          </div>

          <div className={`${compact ? 'text-xs' : 'text-sm'} md:text-right`}>
            <p className={`${compact ? 'text-[11px]' : 'text-xs'} uppercase tracking-wide text-slate-500`}>
              Previous
            </p>
            <p className={`${compact ? 'text-sm' : 'text-base'} font-medium text-slate-900`}>
              {parsedPrevAmount > 0 ? toCurrency(parsedPrevAmount) : 'N/A'}
            </p>
          </div>

          <div className={`${compact ? 'text-xs' : 'text-sm'} md:text-right`}>
            <p className={`${compact ? 'text-[11px]' : 'text-xs'} uppercase tracking-wide text-slate-500`}>
              Next expected
            </p>
            <p className={`${compact ? 'text-sm' : 'text-base'} font-medium text-slate-900`}>
              {toShortDate(nextExpected)}
            </p>
          </div>

          <div className="flex justify-start xl:justify-end">
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
              className={`grid grid-cols-1 border-t border-slate-200 sm:grid-cols-2 lg:grid-cols-4 ${
                compact ? 'mt-2 gap-2 pt-2' : 'mt-3 gap-3 pt-3'
              }`}
            >
              <div className={`rounded-lg bg-slate-50 ${compact ? 'px-2.5 py-1.5' : 'px-3 py-2'}`}>
                <p className={`${compact ? 'text-[11px]' : 'text-xs'} uppercase tracking-wide text-slate-500`}>
                  Cadence
                </p>
                <p className={`mt-1 font-medium text-slate-900 ${compact ? 'text-xs' : 'text-sm'}`}>
                  {toCadenceLabel(cadence)}
                </p>
              </div>
              <div className={`rounded-lg bg-slate-50 ${compact ? 'px-2.5 py-1.5' : 'px-3 py-2'}`}>
                <p className={`${compact ? 'text-[11px]' : 'text-xs'} uppercase tracking-wide text-slate-500`}>
                  Confidence
                </p>
                <p className={`mt-1 font-medium text-slate-900 ${compact ? 'text-xs' : 'text-sm'}`}>
                  {confidencePercent}%
                </p>
              </div>
              <div className={`rounded-lg bg-slate-50 ${compact ? 'px-2.5 py-1.5' : 'px-3 py-2'}`}>
                <p className={`${compact ? 'text-[11px]' : 'text-xs'} uppercase tracking-wide text-slate-500`}>
                  Amount change
                </p>
                <p className={`mt-1 font-medium text-slate-900 ${compact ? 'text-xs' : 'text-sm'}`}>
                  {parsedPrevAmount > 0 ? toCurrency(amountChange) : 'N/A'}
                </p>
              </div>
              <div className={`rounded-lg bg-slate-50 ${compact ? 'px-2.5 py-1.5' : 'px-3 py-2'}`}>
                <p className={`${compact ? 'text-[11px]' : 'text-xs'} uppercase tracking-wide text-slate-500`}>
                  Classification
                </p>
                <p className={`mt-1 font-medium text-slate-900 ${compact ? 'text-xs' : 'text-sm'}`}>
                  {classificationLabel(classification)}
                </p>
              </div>
            </div>

            {(showClassifyControl || onToggleLock || onUndoClassification) && (
              <div
                className={`mt-2 flex flex-wrap items-center gap-2 ${compact ? 'text-[11px]' : 'text-xs'}`}
                onClick={(event) => event.stopPropagation()}
              >
                {showClassifyControl && onSetClassification && (
                  <select
                    value={classification}
                    disabled={isUpdating}
                    onChange={(event) =>
                      void onSetClassification(
                        event.target.value as 'needs_review' | 'subscription' | 'bill_loan' | 'transfer' | 'ignore',
                        applyToFutureCharges,
                      )
                    }
                    className={`rounded-md border border-slate-300 bg-white text-slate-900 ${
                      compact ? 'h-7 px-2' : 'h-8 px-2.5'
                    }`}
                  >
                    <option value="needs_review">Needs review</option>
                    <option value="subscription">Subscription</option>
                    <option value="bill_loan">Bill/Loan</option>
                    <option value="transfer">Transfer</option>
                    <option value="ignore">Ignore (not recurring)</option>
                  </select>
                )}
                {showClassifyControl && onSetClassification && (
                  <label className="inline-flex items-center gap-1.5 text-slate-600">
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 rounded border-slate-300"
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
          </>
        )}

        <p className={`mt-1.5 text-slate-500 ${compact ? 'text-[11px]' : 'text-xs'}`}>
          {expanded ? 'Click row to collapse details' : 'Click row to expand details'}
        </p>
      </div>
    </Card>
  )
}
