import * as React from 'react'
import { cn } from '@/lib/utils'

type ProgressProps = React.HTMLAttributes<HTMLDivElement> & {
  value?: number | null
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, ...props }, ref) => {
    const safeValue = Number.isFinite(value ?? 0) ? Math.min(Math.max(Number(value), 0), 100) : 0

    return (
      <div
        ref={ref}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(safeValue)}
        className={cn('relative h-2 w-full overflow-hidden rounded-full bg-secondary', className)}
        {...props}
      >
        <div className="h-full bg-primary transition-all" style={{ width: `${safeValue}%` }} />
      </div>
    )
  }
)
Progress.displayName = 'Progress'

export { Progress }
