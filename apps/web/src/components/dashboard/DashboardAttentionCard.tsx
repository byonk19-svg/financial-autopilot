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
      ? [{ count: counts.reviewSubscriptions, label: `subscription${counts.reviewSubscriptions === 1 ? '' : 's'} need review`, to: '/subscriptions' }]
      : []),
    ...(counts.unownedAccounts > 0
      ? [{ count: counts.unownedAccounts, label: `account${counts.unownedAccounts === 1 ? '' : 's'} need an owner assigned`, to: '/overview' }]
      : []),
  ]

  if (items.length === 0) {
    return (
      <Card className="border-[hsl(var(--success)/0.35)] bg-[hsl(var(--success)/0.09)] motion-fade-up motion-stagger-2">
        <CardContent className="flex items-center gap-3 p-4 sm:p-5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[hsl(var(--success)/0.32)] bg-[hsl(var(--success)/0.14)]">
            <CheckCircle2 className="h-4 w-4 text-[hsl(var(--success))]" />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">All clear</p>
            <p className="text-sm text-muted-foreground">Nothing needs your attention right now.</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-[hsl(var(--warning)/0.35)] bg-[hsl(var(--warning)/0.1)] motion-fade-up motion-stagger-2">
      <CardContent className="p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[hsl(var(--warning))]">
            <AlertTriangle className="h-3.5 w-3.5" />
            Needs attention
          </p>
          <p className="text-xs text-muted-foreground">{items.length} item{items.length === 1 ? '' : 's'}</p>
        </div>
        <ul className="grid gap-2 sm:grid-cols-2">
          {items.map((item) => (
            <li key={item.to}>
              <Link
                to={item.to}
                className="inline-flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border border-[hsl(var(--warning)/0.38)] bg-card/95 px-3 py-2 text-sm font-medium text-[hsl(var(--warning))] transition-all duration-150 hover:-translate-y-0.5 hover:bg-[hsl(var(--warning)/0.16)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:min-h-9 md:py-1.5"
              >
                <span>{item.label}</span>
                <span className="rounded-full bg-[hsl(var(--warning)/0.2)] px-2 py-0.5 text-xs font-semibold">{item.count}</span>
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
