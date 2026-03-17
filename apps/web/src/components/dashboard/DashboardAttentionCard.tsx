import { AlertTriangle, CheckCircle2 } from 'lucide-react'
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
      ? [{ count: counts.reviewSubscriptions, label: `subscription${counts.reviewSubscriptions === 1 ? '' : 's'} need review`, to: '/subscriptions#subscription-section-needs-review' }]
      : []),
    ...(counts.unownedAccounts > 0
      ? [{ count: counts.unownedAccounts, label: `account${counts.unownedAccounts === 1 ? '' : 's'} need an owner assigned`, to: '/overview' }]
      : []),
  ]

  if (items.length === 0) {
    return (
      <Card className="border-border/75 bg-card/95 shadow-[0_8px_18px_-20px_hsl(var(--foreground)/0.28)]">
        <CardContent className="flex items-center gap-3 p-3.5 sm:p-4">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-muted/45">
            <CheckCircle2 className="h-4 w-4 text-foreground/70" />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">All clear</p>
            <p className="text-xs text-muted-foreground">Nothing needs your attention right now.</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-border/75 bg-card/95 shadow-[0_8px_18px_-20px_hsl(var(--foreground)/0.28)]">
      <CardContent className="p-3.5 sm:p-4">
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <AlertTriangle className="h-3.5 w-3.5" />
            Needs attention
          </p>
          <p className="text-xs text-muted-foreground">{items.length} item{items.length === 1 ? '' : 's'}</p>
        </div>
        <ul className="grid gap-2">
          {items.map((item) => (
            <li key={item.to}>
              <Link
                to={item.to}
                className="inline-flex min-h-10 w-full items-center justify-between gap-2 rounded-lg border border-border/70 bg-muted/20 px-3 py-2 text-sm font-medium text-foreground transition-colors duration-150 hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span>{item.label}</span>
                <span className="rounded-full border border-border/75 bg-background/80 px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                  {item.count}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
