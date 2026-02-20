import { useCallback, useState } from 'react'
import { SubscriptionRow } from '@/components/subscriptions/SubscriptionRow'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import type {
  SubscriptionClassification,
  SubscriptionHistoryRow,
  SubscriptionRecord,
} from '@/lib/types'
import { hasPriceIncrease, type DensityMode } from '@/lib/subscriptionFormatters'

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
      className={`hidden rounded-lg border border-slate-200 bg-slate-50 font-semibold uppercase tracking-wide text-muted-foreground xl:grid xl:grid-cols-[minmax(0,2.1fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,1fr)_auto] xl:items-center xl:gap-3 ${
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
  const toggleExpanded = useCallback(() => {
    setExpanded((current) => !current)
  }, [])

  return (
    <Card className="overflow-hidden border-slate-200 shadow-sm">
      <button
        type="button"
        onClick={toggleExpanded}
        aria-expanded={expanded}
        aria-controls={contentId}
        className={`flex w-full items-center justify-between gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${compact ? 'p-3' : 'p-3.5'}`}
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
        <CardContent id={contentId} className={`border-t border-slate-200 ${compact ? 'p-2.5' : 'p-3'}`}>
          {rows.length === 0 ? (
            <p className={`text-muted-foreground ${compact ? 'text-xs' : 'text-sm'}`}>{emptyText}</p>
          ) : (
            <div className={compact ? 'space-y-1.5' : 'space-y-2'}>
              <ListHeaderRow density={density} showClassifyControl={showClassifyControl} />
              {rows.map((subscription) => (
                <SubscriptionRow
                  key={subscription.id}
                  merchant={subscription.merchant_normalized}
                  cadence={subscription.cadence}
                  confidence={subscription.confidence}
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
