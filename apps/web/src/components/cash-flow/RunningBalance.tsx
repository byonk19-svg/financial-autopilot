type RunningBalanceProps = {
  balance: number
  isProjected: boolean
  isBelowThreshold: boolean
}

export default function RunningBalance({ balance, isProjected, isBelowThreshold }: RunningBalanceProps) {
  return (
    <p
      className={`text-sm font-semibold ${
        isBelowThreshold ? 'text-rose-700' : 'text-foreground'
      } ${isProjected ? 'opacity-80' : ''}`}
    >
      ${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
    </p>
  )
}
