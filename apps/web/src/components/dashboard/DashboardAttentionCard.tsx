import { Link } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import type { DashboardAttentionCounts } from '@/hooks/useDashboard'

type AttentionItem = {
  count: number
  label: string
  to: string
}

type Props = {
  counts: DashboardAttentionCounts
}

export function DashboardAttentionCard({ counts }: Props) {
  const items: AttentionItem[] = [
    ...(counts.unreadAlerts > 0
      ? [{ count: counts.unreadAlerts, label: `unread alert${counts.unreadAlerts === 1 ? '' : 's'}`, to: '/alerts' }]
      : []),
    ...(counts.uncategorizedTransactions > 0
      ? [{ count: counts.uncategorizedTransactions, label: `transaction${counts.uncategorizedTransactions === 1 ? '' : 's'} need categorization`, to: '/transactions?category=__uncategorized__' }]
      : []),
    ...(counts.reviewSubscriptions > 0
      ? [{ count: counts.reviewSubscriptions, label: `subscription${counts.reviewSubscriptions === 1 ? '' : 's'} need review`, to: '/subscriptions' }]
      : []),
    ...(counts.unownedAccounts > 0
      ? [{ count: counts.unownedAccounts, label: `account${counts.unownedAccounts === 1 ? '' : 's'} need an owner assigned`, to: '/overview' }]
      : []),
  ]

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2.5 p-4">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">
            ✓
          </span>
          <p className="text-sm text-muted-foreground">Nothing needs your attention right now.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-amber-200 bg-amber-50/40">
      <CardContent className="p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-amber-800">
          Needs attention
        </p>
        <ul className="flex flex-wrap gap-2">
          {items.map((item) => (
            <li key={item.to}>
              <Link
                to={item.to}
                className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-white px-3 py-1.5 text-sm font-medium text-amber-900 transition-colors hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="font-semibold">{item.count}</span>
                <span>{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
