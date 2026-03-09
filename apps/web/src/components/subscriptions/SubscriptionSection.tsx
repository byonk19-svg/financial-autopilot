import { useCallback, useMemo, useState } from 'react'
import { SubscriptionRow } from '@/components/subscriptions/SubscriptionRow'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import type {
  OwnerValue,
  SubscriptionClassification,
  SubscriptionHistoryRow,
  SubscriptionRecord,
} from '@/lib/types'
import {
  hasPriceIncrease,
  parseDate,
  toCurrency,
  toMonthlyEquivalentAmount,
  type DensityMode,
} from '@/lib/subscriptionFormatters'

const PAYER_ORDER: OwnerValue[] = ['household', 'brianna', 'elaine', 'unknown']

function normalizePayer(value: SubscriptionRecord['primary_payer']): OwnerValue {
  if (value === 'brianna' || value === 'elaine' || value === 'household') {
    return value
  }
  return 'unknown'
}

function payerLabel(value: OwnerValue): string {
  if (value === 'brianna') return 'Brianna'
  if (value === 'elaine') return 'Elaine'
  if (value === 'household') return 'Household'
  return 'Unknown'
}

function ListHeaderRow({
  density,
  showClassifyControl,
}: {
  density: DensityMode
  showClassifyControl: boolean
}) {
  const compact = density === 'compact'
  return (
    <div
      className={`hidden rounded-xl border border-border/80 bg-muted/35 font-semibold uppercase tracking-wide text-muted-foreground xl:grid xl:grid-cols-[minmax(0,2.1fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,1fr)_auto] xl:items-center xl:gap-3 ${
        compact ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs'
      }`}
    >
      <span>Merchant</span>
      <span className="text-right">Last</span>
      <span className="text-right">Previous</span>
      <span className="text-right">Next expected</span>
      <span className="text-right">{showClassifyControl ? 'Classify / Action' : 'Action'}</span>
    </div>
  )
}

type SubscriptionSectionProps = {
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
  onUpdateNotifyDaysBefore: (subscription: SubscriptionRecord, notifyDaysBefore: number | null) => Promise<void>
  onRenameMerchant: (subscription: SubscriptionRecord, nextMerchant: string) => Promise<void>
  onCreateWebIdSplitAliases: (
    subscription: SubscriptionRecord,
    splits: Array<{ webId: string; normalized: string }>,
  ) => Promise<void>
  onCreateAmountSplitRules: (
    subscription: SubscriptionRecord,
    splits: Array<{ amount: number; normalized: string }>,
  ) => Promise<void>
  onToggleClassificationLock: (subscription: SubscriptionRecord) => Promise<void>
  onUndoClassification: (subscription: SubscriptionRecord) => Promise<void>
  onMarkFalsePositive: (subscription: SubscriptionRecord, rerunAfterMark: boolean) => Promise<void>
  onLoadHistory: (subscriptionId: string) => Promise<void>
  historyBySubscriptionId: Record<string, SubscriptionHistoryRow[]>
  dailyTotalsBySubscriptionId: Record<string, Record<string, number>>
  historyLoadingIds: Record<string, boolean>
  showClassifyControl?: boolean
  density: DensityMode
  defaultExpanded?: boolean
}

export function SubscriptionSection({
  title,
  description,
  emptyText,
  rows,
  processingId,
  onMarkInactive,
  onSetClassification,
  onUpdateNotifyDaysBefore,
  onRenameMerchant,
  onCreateWebIdSplitAliases,
  onCreateAmountSplitRules,
  onToggleClassificationLock,
  onUndoClassification,
  onMarkFalsePositive,
  onLoadHistory,
  historyBySubscriptionId,
  dailyTotalsBySubscriptionId,
  historyLoadingIds,
  showClassifyControl = false,
  density,
  defaultExpanded = true,
}: SubscriptionSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const compact = density === 'compact'
  const sectionSlug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  const contentId = `subscription-section-${sectionSlug}`
  const headingId = `${contentId}-heading`
  const toggleExpanded = useCallback(() => {
    setExpanded((current) => !current)
  }, [])

  const groupedRows = useMemo(() => {
    const buckets = new Map<OwnerValue, SubscriptionRecord[]>(
      PAYER_ORDER.map((payer) => [payer, []]),
    )

    for (const row of rows) {
      const payer = normalizePayer(row.primary_payer)
      const group = buckets.get(payer) ?? []
      group.push(row)
      buckets.set(payer, group)
    }

    return PAYER_ORDER
      .map((payer) => ({
        payer,
        rows: buckets.get(payer) ?? [],
      }))
      .filter((group) => group.rows.length > 0)
  }, [rows])

  const monthlyEstimate = useMemo(
    () =>
      rows.reduce(
        (sum, row) =>
          sum +
          toMonthlyEquivalentAmount({
            lastAmount: row.last_amount,
            cadence: row.cadence,
          }),
        0,
      ),
    [rows],
  )

  const dueSoonCount = useMemo(() => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    const maxDays = 7

    return rows.reduce((count, row) => {
      const renewalDate = parseDate(row.next_expected_at)
      if (!renewalDate) return count

      const renewalDay = new Date(
        renewalDate.getFullYear(),
        renewalDate.getMonth(),
        renewalDate.getDate(),
      ).getTime()
      const daysAway = Math.round((renewalDay - today) / (24 * 60 * 60 * 1000))
      return daysAway >= 0 && daysAway <= maxDays ? count + 1 : count
    }, 0)
  }, [rows])

  return (
    <Card className="overflow-hidden border-border/80 bg-card/95 shadow-[0_16px_40px_-28px_hsl(var(--foreground)/0.44)] motion-fade-up" data-testid={`recurring-section-${sectionSlug}`}>
      <button
        type="button"
        onClick={toggleExpanded}
        aria-expanded={expanded}
        aria-controls={contentId}
        className={`flex w-full items-center justify-between gap-3 text-left transition-colors-fast hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${compact ? 'p-3' : 'p-3.5'}`}
      >
        <div>
          <h2 id={headingId} className={`font-semibold text-foreground ${compact ? 'text-base' : 'text-lg'}`}>{title}</h2>
          <p className={`text-muted-foreground ${compact ? 'text-xs' : 'text-sm'}`}>{description}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden rounded-lg border border-border/70 bg-muted/30 px-2.5 py-1 text-right sm:block">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Est. monthly</p>
            <p className={`font-semibold text-foreground ${compact ? 'text-xs' : 'text-sm'}`}>{toCurrency(monthlyEstimate)}</p>
          </div>
          <div className="hidden rounded-lg border border-border/70 bg-muted/30 px-2.5 py-1 text-right sm:block">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Due in 7d</p>
            <p className={`font-semibold text-foreground ${compact ? 'text-xs' : 'text-sm'}`}>{dueSoonCount}</p>
          </div>
          <Badge variant="secondary" className={compact ? 'text-[10px]' : 'text-xs'}>
            {rows.length}
          </Badge>
          <span className={`${compact ? 'text-xs' : 'text-sm'} font-medium text-muted-foreground`}>
            {expanded ? 'Hide' : 'Show'}
          </span>
        </div>
      </button>

      {expanded && (
        <CardContent
          id={contentId}
          role="region"
          aria-labelledby={headingId}
          className={`border-t border-border/80 ${compact ? 'p-2.5' : 'p-3'}`}
        >
          {rows.length === 0 ? (
            <p className={`text-muted-foreground ${compact ? 'text-xs' : 'text-sm'}`}>{emptyText}</p>
          ) : (
            <div className={compact ? 'space-y-1.5' : 'space-y-2'}>
              <ListHeaderRow density={density} showClassifyControl={showClassifyControl} />
              {groupedRows.map((group) => (
                <div key={group.payer} className={compact ? 'space-y-1.5' : 'space-y-2'}>
                  {groupedRows.length > 1 && (
                    <div className="flex items-center justify-between px-1">
                      <p className={`font-semibold uppercase tracking-[0.08em] text-muted-foreground ${compact ? 'text-[10px]' : 'text-[11px]'}`}>
                        Paid by {payerLabel(group.payer)}
                      </p>
                      <Badge variant="outline" className={compact ? 'text-[10px]' : 'text-xs'}>
                        {group.rows.length}
                      </Badge>
                    </div>
                  )}

                  {group.rows.map((subscription) => (
                    <SubscriptionRow
                      key={subscription.id}
                      merchant={subscription.merchant_normalized}
                      cadence={subscription.cadence}
                      confidence={subscription.confidence}
                      primaryPayer={subscription.primary_payer}
                      lastAmount={subscription.last_amount}
                      prevAmount={subscription.prev_amount}
                      nextExpected={subscription.next_expected_at}
                      notifyDaysBefore={subscription.notify_days_before}
                      hasIncrease={hasPriceIncrease({
                        lastAmount: subscription.last_amount,
                        prevAmount: subscription.prev_amount,
                      })}
                      classification={subscription.classification}
                      isFalsePositive={subscription.is_false_positive === true}
                      userLocked={subscription.user_locked}
                      density={density}
                      isUpdating={processingId === subscription.id}
                      onMarkInactive={() => onMarkInactive(subscription)}
                      historyRows={historyBySubscriptionId[subscription.id] ?? []}
                      dailyTotals={dailyTotalsBySubscriptionId[subscription.id] ?? {}}
                      historyLoading={historyLoadingIds[subscription.id] === true}
                      onExpandChange={(expanded) => {
                        if (expanded) {
                          void onLoadHistory(subscription.id)
                        }
                      }}
                      onMarkFalsePositive={(rerunAfterMark) =>
                        onMarkFalsePositive(subscription, rerunAfterMark)
                      }
                      onSetClassification={
                        showClassifyControl
                          ? (classification, createRule) =>
                              onSetClassification(subscription, classification, createRule)
                          : undefined
                      }
                      onUpdateNotifyDaysBefore={(notifyDaysBefore) =>
                        onUpdateNotifyDaysBefore(subscription, notifyDaysBefore)
                      }
                      onRenameMerchant={(nextMerchant) => onRenameMerchant(subscription, nextMerchant)}
                      onCreateWebIdSplitAliases={(splits) =>
                        onCreateWebIdSplitAliases(subscription, splits)
                      }
                      onCreateAmountSplitRules={(splits) =>
                        onCreateAmountSplitRules(subscription, splits)
                      }
                      showClassifyControl={showClassifyControl}
                      onToggleLock={() => onToggleClassificationLock(subscription)}
                      onUndoClassification={() => onUndoClassification(subscription)}
                    />
                  ))}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}
