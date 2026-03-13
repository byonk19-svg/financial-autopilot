import { Scale } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import type { DashboardOwnerResponsibility, DashboardOwnerResponsibilityRow } from '@/hooks/useDashboard'
import { toCurrency } from '@/lib/subscriptionFormatters'

type DashboardOwnerResponsibilityCardProps = {
  ownerResponsibility: DashboardOwnerResponsibility
}

function ownerLabelClass(owner: DashboardOwnerResponsibilityRow['owner']): string {
  if (owner === 'brianna') return 'bg-primary/10 text-primary/85'
  if (owner === 'elaine') return 'bg-[hsl(var(--chart-2)/0.1)] text-[hsl(var(--chart-2)/0.9)]'
  if (owner === 'household') return 'bg-[hsl(var(--chart-3)/0.1)] text-[hsl(var(--chart-3)/0.9)]'
  return 'bg-muted/70 text-foreground/80'
}

function formatShare(value: number | null): string {
  if (value === null) return 'n/a'
  return `${Math.max(0, Math.min(100, value)).toFixed(0)}%`
}

function progressValue(value: number | null): number {
  if (value === null) return 0
  return Math.max(0, Math.min(100, value))
}

export function DashboardOwnerResponsibilityCard({ ownerResponsibility }: DashboardOwnerResponsibilityCardProps) {
  return (
    <Card className="border-[hsl(var(--chart-3)/0.22)] bg-[hsl(var(--chart-3)/0.04)] shadow-[0_10px_24px_-22px_hsl(var(--foreground)/0.35)]">
      <CardHeader className="pb-3">
        <CardTitle className="inline-flex items-center gap-2 text-base font-semibold">
          <Scale className="h-4 w-4 text-[hsl(var(--chart-3)/0.85)]" />
          Responsibility Split
        </CardTitle>
        <p className="text-xs text-muted-foreground">Month-to-date spend by owner</p>
      </CardHeader>
      <CardContent className="space-y-2.5">
        <ul className="space-y-2.5">
          {ownerResponsibility.rows.map((row) => (
            <li key={row.owner} className="rounded-lg border border-border/65 bg-muted/30 px-3 py-2.5">
              <div className="flex items-center justify-between gap-3">
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${ownerLabelClass(
                    row.owner,
                  )}`}
                >
                  {row.label}
                </span>
                <span className="text-sm font-semibold text-foreground">{toCurrency(row.spendMtd)}</span>
              </div>

              <div className="mt-2 flex items-center gap-2">
                <Progress value={progressValue(row.spendSharePct)} className="h-2" />
                <span className="w-10 text-right text-[11px] font-medium text-muted-foreground">
                  {formatShare(row.spendSharePct)}
                </span>
              </div>

              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Income {toCurrency(row.incomeMtd)}</span>
                <span className={row.cashFlowMtd >= 0 ? 'text-[hsl(var(--success)/0.9)]' : 'text-[hsl(var(--destructive)/0.9)]'}>
                  Net {toCurrency(row.cashFlowMtd)}
                </span>
              </div>
            </li>
          ))}
        </ul>

        <div className="rounded-lg border border-border/65 bg-muted/35 px-3 py-2 text-xs text-muted-foreground">
          Total income:{' '}
          <span className="font-semibold text-foreground">{toCurrency(ownerResponsibility.totalIncomeMtd)}</span>
          {' | '}
          Total spend:{' '}
          <span className="font-semibold text-foreground">{toCurrency(ownerResponsibility.totalSpendMtd)}</span>
        </div>
      </CardContent>
    </Card>
  )
}
