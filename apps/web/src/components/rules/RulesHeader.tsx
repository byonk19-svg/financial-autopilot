import type { RunState } from '@/hooks/useRules'
import { formatTime } from '@/hooks/useRules'
import { CheckCircleIcon, XCircleIcon } from '@/components/rules/RuleIcons'

type RulesHeaderProps = {
  activeAliasCount: number
  aliasCount: number
  activeRuleCount: number
  ruleCount: number
  running: boolean
  runState: RunState | null
  onRunAnalysis: () => void
}

export function RulesHeader({
  activeAliasCount,
  aliasCount,
  activeRuleCount,
  ruleCount,
  running,
  runState,
  onRunAnalysis,
}: RulesHeaderProps) {
  return (
    <div className="rounded-xl border border bg-card p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Rules</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Start simple: aliases rename merchants, transaction rules force behavior.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Aliases: {activeAliasCount}/{aliasCount} active • Behavior rules: {activeRuleCount}/{ruleCount} active
          </p>
        </div>
        <button
          type="button"
          onClick={onRunAnalysis}
          disabled={running}
          className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-colors-fast hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {running ? 'Running...' : 'Run analysis now'}
        </button>
      </div>
      {runState && (
        <div className={`mt-3 rounded-lg border px-3 py-2 text-sm ${runState.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
          <p className="inline-flex items-center gap-1.5 font-semibold">
            {runState.ok ? <CheckCircleIcon /> : <XCircleIcon />}
            {runState.ok ? 'Succeeded' : 'Failed'} • Request ID: {runState.requestId}
          </p>
          <p className="mt-1 text-xs">At: {formatTime(runState.at)}</p>
          <p className="mt-1">{runState.message}</p>
        </div>
      )}
    </div>
  )
}
