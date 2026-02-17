import { Card } from '@/components/ui/card'
import type { DensityMode } from '@/lib/subscriptionFormatters'

export function SubscriptionLoadingSkeleton({ density }: { density: DensityMode }) {
  const compact = density === 'compact'
  const rowCount = compact ? 10 : 8

  return (
    <section className="space-y-2.5 overflow-hidden" aria-live="polite" aria-busy="true">
      <div className="h-5 w-56 animate-pulse rounded bg-slate-200" />
      <div className="hidden h-8 animate-pulse rounded-lg bg-slate-100 xl:block" />
      <div className={compact ? 'space-y-1.5' : 'space-y-2'}>
        {Array.from({ length: rowCount }).map((_, index) => (
          <Card
            key={index}
            className={`animate-pulse border-slate-200 shadow-sm ${compact ? 'p-2.5' : 'p-3'}`}
          >
            <div
              className={`grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,2.1fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,1fr)_auto] ${
                compact ? 'gap-2' : 'gap-3'
              }`}
            >
              <div className="space-y-2">
                <div className={`rounded bg-slate-200 ${compact ? 'h-3 w-40' : 'h-4 w-48'}`} />
                <div className={`rounded bg-slate-100 ${compact ? 'h-2.5 w-28' : 'h-3 w-36'}`} />
              </div>
              <div className="space-y-2 md:text-right">
                <div className={`ml-auto rounded bg-slate-100 ${compact ? 'h-2.5 w-10' : 'h-3 w-12'}`} />
                <div className={`ml-auto rounded bg-slate-200 ${compact ? 'h-3 w-16' : 'h-4 w-20'}`} />
              </div>
              <div className="space-y-2 md:text-right">
                <div className={`ml-auto rounded bg-slate-100 ${compact ? 'h-2.5 w-14' : 'h-3 w-16'}`} />
                <div className={`ml-auto rounded bg-slate-200 ${compact ? 'h-3 w-16' : 'h-4 w-20'}`} />
              </div>
              <div className="space-y-2 md:text-right">
                <div className={`ml-auto rounded bg-slate-100 ${compact ? 'h-2.5 w-16' : 'h-3 w-20'}`} />
                <div className={`ml-auto rounded bg-slate-200 ${compact ? 'h-3 w-20' : 'h-4 w-24'}`} />
              </div>
              <div className="flex justify-start xl:justify-end">
                <div
                  className={`rounded border border-slate-200 bg-slate-100 ${compact ? 'h-6 w-20' : 'h-7 w-24'}`}
                />
              </div>
            </div>
          </Card>
        ))}
      </div>
    </section>
  )
}
