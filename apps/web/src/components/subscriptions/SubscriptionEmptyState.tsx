import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ENABLE_RERUN_DETECTION } from '@/hooks/useSubscriptions'

type SubscriptionEmptyStateProps = {
  rerunningDetection: boolean
  onRerunDetection: () => void
}

export function SubscriptionEmptyState({
  rerunningDetection,
  onRerunDetection,
}: SubscriptionEmptyStateProps) {
  return (
    <Card className="border-slate-200 shadow-sm" role="status" aria-live="polite">
      <CardHeader className="p-5">
        <CardTitle className="text-lg">No subscriptions found yet</CardTitle>
        <CardDescription>
          We have not detected recurring charges yet. Sync your latest transactions and run detection.
        </CardDescription>
      </CardHeader>
      {ENABLE_RERUN_DETECTION && (
        <CardContent className="p-5 pt-0">
          <Button type="button" onClick={onRerunDetection} disabled={rerunningDetection}>
            {rerunningDetection ? 'Re-running detection...' : 'Re-run detection'}
          </Button>
        </CardContent>
      )}
    </Card>
  )
}

type SubscriptionNoMatchesProps = {
  hasFiltersApplied: boolean
  onClearFilters: () => void
}

export function SubscriptionNoMatches({
  hasFiltersApplied,
  onClearFilters,
}: SubscriptionNoMatchesProps) {
  return (
    <Card className="border-slate-200 shadow-sm" role="status" aria-live="polite">
      <CardHeader className="p-5">
        <CardTitle className="text-lg">No matches</CardTitle>
        <CardDescription>No recurring charges match your current search and filters.</CardDescription>
      </CardHeader>
      {hasFiltersApplied && (
        <CardContent className="p-5 pt-0">
          <Button type="button" variant="outline" onClick={onClearFilters}>
            Clear filters
          </Button>
        </CardContent>
      )}
    </Card>
  )
}
