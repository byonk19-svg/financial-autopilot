import type { EmployerRecord } from '@/lib/types'

type EmployerBadgeProps = {
  employer: EmployerRecord | undefined
}

export default function EmployerBadge({ employer }: EmployerBadgeProps) {
  if (!employer) {
    return <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">Unknown</span>
  }

  return (
    <span
      className="inline-flex rounded-full px-2 py-0.5 text-xs font-semibold text-white"
      style={{ backgroundColor: employer.color || '#2563EB' }}
      title={employer.name}
    >
      {employer.short_code}
    </span>
  )
}

