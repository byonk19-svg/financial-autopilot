import { useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AliasFormCard } from '@/components/rules/AliasFormCard'
import { AliasRulesList } from '@/components/rules/AliasRulesList'
import { BehaviorRuleFormCard } from '@/components/rules/BehaviorRuleFormCard'
import { BehaviorRulesList } from '@/components/rules/BehaviorRulesList'
import { RulesHeader } from '@/components/rules/RulesHeader'
import { useRules } from '@/hooks/useRules'
import { getLoginRedirectPath } from '@/lib/loginRedirect'
import { useSession } from '@/lib/session'

export default function Rules() {
  const navigate = useNavigate()
  const { session, loading } = useSession()
  const {
    aliases,
    rules,
    accounts,
    aliasForm,
    ruleForm,
    fetching,
    saving,
    running,
    showAliasAdvanced,
    showRuleAdvanced,
    runState,
    message,
    error,
    activeAliasCount,
    activeRuleCount,
    setAliasForm,
    setRuleForm,
    setShowAliasAdvanced,
    setShowRuleAdvanced,
    submitAlias,
    submitRule,
    runAnalysisNow,
    toggleAlias,
    deleteAlias,
    toggleRule,
    deleteRule,
  } = useRules(session?.user?.id)

  useEffect(() => {
    if (loading) return
    if (!session?.user) {
      navigate(getLoginRedirectPath(), { replace: true })
    }
  }, [loading, navigate, session])

  const onRunAnalysisClick = useCallback(() => {
    void runAnalysisNow()
  }, [runAnalysisNow])

  return (
    <section className="space-y-4">
      <RulesHeader
        activeAliasCount={activeAliasCount}
        aliasCount={aliases.length}
        activeRuleCount={activeRuleCount}
        ruleCount={rules.length}
        running={running}
        runState={runState}
        onRunAnalysis={onRunAnalysisClick}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <AliasFormCard form={aliasForm} accounts={accounts} saving={saving} showAdvanced={showAliasAdvanced} onSetForm={(updater) => setAliasForm(updater)} onToggleAdvanced={() => setShowAliasAdvanced((current) => !current)} onSubmit={submitAlias} />
        <BehaviorRuleFormCard form={ruleForm} accounts={accounts} saving={saving} showAdvanced={showRuleAdvanced} onSetForm={(updater) => setRuleForm(updater)} onToggleAdvanced={() => setShowRuleAdvanced((current) => !current)} onSubmit={submitRule} />
      </div>

      <AliasRulesList aliases={aliases} fetching={fetching} saving={saving} onToggleAlias={toggleAlias} onDeleteAlias={deleteAlias} />
      <BehaviorRulesList rules={rules} fetching={fetching} saving={saving} onToggleRule={toggleRule} onDeleteRule={deleteRule} />

      {message && <p className="text-sm text-emerald-700">{message}</p>}
      {error && <p className="text-sm text-rose-600">{error}</p>}
    </section>
  )
}
