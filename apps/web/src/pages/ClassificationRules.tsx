import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClassificationRuleForm } from '@/components/classification-rules/ClassificationRuleForm'
import { ClassificationRulesHeader } from '@/components/classification-rules/ClassificationRulesHeader'
import { ClassificationRulesList } from '@/components/classification-rules/ClassificationRulesList'
import { useClassificationRules } from '@/hooks/useClassificationRules'
import { getLoginRedirectPath } from '@/lib/loginRedirect'
import { useSession } from '@/lib/session'

export default function ClassificationRules() {
  const navigate = useNavigate()
  const { session, loading } = useSession()
  const {
    rules,
    fetching,
    submitting,
    editingId,
    editingForm,
    newRuleForm,
    error,
    message,
    activeCount,
    setEditingForm,
    setNewRuleForm,
    createRule,
    startEdit,
    cancelEdit,
    saveEdit,
    toggleActive,
    deleteRule,
  } = useClassificationRules(session?.user?.id)

  useEffect(() => {
    if (loading) return
    if (!session?.user) {
      navigate(getLoginRedirectPath(), { replace: true })
    }
  }, [loading, navigate, session])

  return (
    <section className="space-y-4">
      <ClassificationRulesHeader activeCount={activeCount} totalCount={rules.length} />
      <ClassificationRuleForm form={newRuleForm} submitting={submitting} onSetForm={(updater) => setNewRuleForm(updater)} onSubmit={createRule} />
      <ClassificationRulesList rules={rules} fetching={fetching} submitting={submitting} editingId={editingId} editingForm={editingForm} onSetEditingForm={(updater) => setEditingForm(updater)} onStartEdit={startEdit} onCancelEdit={cancelEdit} onSaveEdit={saveEdit} onToggleActive={toggleActive} onDeleteRule={deleteRule} />
      {message && <p className="text-sm text-emerald-700">{message}</p>}
      {error && <p className="text-sm text-rose-600">{error}</p>}
    </section>
  )
}
