import { format, parseISO } from 'date-fns'
import { ActivityIcon } from '@/components/dashboard/DashboardIcons'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toNumber } from '@/lib/subscriptionFormatters'
import type { ShiftWeekSummaryRpc } from '@/lib/types'

function safeDateLabel(value: string | null | undefined, pattern: string): string {
  if (!value) return 'N/A'
  try {
    return format(parseISO(value), pattern)
  } catch {
    return value ?? 'N/A'
  }
}

function formatCurrency(value: number): string {
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

type DashboardShiftWeekCardProps = {
  shiftSummary: ShiftWeekSummaryRpc | null
  shiftLoading: boolean
}

export function DashboardShiftWeekCard({ shiftSummary, shiftLoading }: DashboardShiftWeekCardProps) {
  const shiftRows = shiftSummary?.shifts ?? []
  const shiftBreakdown = shiftSummary?.employer_breakdown ?? []

  const maxBreakdownPay = shiftBreakdown.reduce((max, row) => Math.max(max, toNumber(row.gross_pay ?? null)), 0)

  return (
    <Card className="md:col-span-2 border-border/75 bg-card/95 shadow-[0_10px_24px_-22px_hsl(var(--foreground)/0.35)]">
      <CardHeader className="pb-4 sm:pb-5">
        <CardTitle className="text-base font-semibold tracking-tight sm:text-lg">
          {shiftSummary
            ? `Week of ${safeDateLabel(shiftSummary.week_start, 'MMM d')} - ${toNumber(shiftSummary.total_hours ?? null).toFixed(2)} hrs - ${formatCurrency(toNumber(shiftSummary.total_gross_pay ?? null))}`
            : "This Week's Shifts"}
        </CardTitle>
        <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
          Logged shifts and employer pay distribution
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {shiftLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : shiftRows.length === 0 ? (
          <EmptyState
            className="min-h-[132px]"
            icon={<ActivityIcon className="h-5 w-5" />}
            title="No shifts logged this week"
            description="As shifts are added, weekly totals and employer breakdown will appear here."
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border/75 bg-background/20">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Employer</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-right">Hours</TableHead>
                  <TableHead className="text-right">Gross Pay</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shiftRows.map((shift) => (
                  <TableRow key={shift.shift_id}>
                    <TableCell>{safeDateLabel(shift.shift_date, 'MMM d')}</TableCell>
                    <TableCell>{shift.employer_name}</TableCell>
                    <TableCell>{shift.location_name || '--'}</TableCell>
                    <TableCell className="text-right">{toNumber(shift.hours_worked ?? null).toFixed(2)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(toNumber(shift.gross_pay ?? null))}</TableCell>
                    <TableCell className="capitalize">{shift.status}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {!shiftLoading && shiftBreakdown.length > 0 && (
          <div className="space-y-3 border-t border-dashed border-border pt-4">
            {shiftBreakdown.map((row) => {
              const grossPay = toNumber(row.gross_pay ?? null)
              const value = maxBreakdownPay > 0 ? (grossPay / maxBreakdownPay) * 100 : 0
              return (
                <div key={row.employer_name} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <p className="font-medium text-foreground">{row.employer_name}</p>
                    <p className="text-muted-foreground">
                      {toNumber(row.hours ?? null).toFixed(2)} hrs - {formatCurrency(grossPay)}
                    </p>
                  </div>
                  <Progress value={value} />
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
