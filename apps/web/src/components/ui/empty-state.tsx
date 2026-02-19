import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

type EmptyStateProps = {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex min-h-[180px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-4 py-6 text-center",
        className
      )}
    >
      {icon ? <div className="mb-3 text-muted-foreground">{icon}</div> : null}
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {description ? <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}
