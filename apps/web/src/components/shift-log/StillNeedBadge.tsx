type StillNeedBadgeProps = {
  stillNeed: number
}

export default function StillNeedBadge({ stillNeed }: StillNeedBadgeProps) {
  const exceeded = stillNeed <= 0
  const amount = Math.abs(stillNeed)

  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
        exceeded ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'
      }`}
    >
      {exceeded ? `+$${amount.toFixed(2)} over` : `$${amount.toFixed(2)} to go`}
    </span>
  )
}

