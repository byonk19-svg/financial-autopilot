type LowPoint = {
  date: string
  balance: number
  triggeredBy: string[]
}

type ProjectedWarningProps = {
  lowPoints: LowPoint[]
}

export default function ProjectedWarning({ lowPoints }: ProjectedWarningProps) {
  if (lowPoints.length === 0) return null

  const first = lowPoints[0]
  const triggerText = first.triggeredBy.slice(0, 2).join(', ')

  return (
    <section className="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-sm text-amber-900">
      Heads up: projected balance drops to ${first.balance.toFixed(2)} on {first.date}
      {triggerText ? ` (${triggerText})` : ''}.
    </section>
  )
}
