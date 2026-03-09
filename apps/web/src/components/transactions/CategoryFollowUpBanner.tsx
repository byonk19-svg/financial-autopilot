import type { CategoryFollowUpPromptState } from '@/lib/types'

type CategoryFollowUpBannerProps = {
  prompt: CategoryFollowUpPromptState
  accountNameById: Map<string, string>
  onDismiss: () => void
  onAccountScopeToggle: (checked: boolean) => void
  onApplySimilar: () => void
  onApplyAndCreateRule: () => void
}

export function CategoryFollowUpBanner({
  prompt,
  accountNameById,
  onDismiss,
  onAccountScopeToggle,
  onApplySimilar,
  onApplyAndCreateRule,
}: CategoryFollowUpBannerProps) {
  const isPending = prompt.pendingAction !== null

  return (
    <div
      className="fixed bottom-4 left-4 z-50 w-full max-w-md rounded-lg border border-border bg-card p-4 shadow-lg"
      role="status"
      aria-live="polite"
    >
      <p className="text-sm font-semibold text-foreground">Apply to similar past transactions?</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Apply <span className="font-medium text-foreground">{prompt.categoryName}</span> to matching{' '}
        <span className="font-medium text-foreground">{prompt.merchantCanonical}</span> transactions in the
        last 12 months.
      </p>

      <label className="mt-3 flex items-start gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-foreground">
        <input
          type="checkbox"
          checked={prompt.includeAccountScope}
          disabled={isPending}
          onChange={(event) => onAccountScopeToggle(event.target.checked)}
          className="mt-0.5 rounded border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <span>
          Only this account
          <span className="block text-xs text-muted-foreground">
            {accountNameById.get(prompt.accountId) ?? 'Current account'}
          </span>
        </span>
      </label>

      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          disabled={isPending}
          onClick={onDismiss}
          className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
        >
          Dismiss
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={onApplySimilar}
          className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
        >
          {prompt.pendingAction === 'apply_similar' ? 'Applying...' : 'Past only'}
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={onApplyAndCreateRule}
          className="rounded-md border border-primary bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
        >
          {prompt.pendingAction === 'apply_and_rule' ? 'Applying...' : 'Fix everywhere (past + future)'}
        </button>
      </div>
    </div>
  )
}
