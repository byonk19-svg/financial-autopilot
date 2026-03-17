import type { HideFollowUpState } from '@/lib/types'
import { FollowUpBannerShell } from './FollowUpBannerShell'

type HideFollowUpBannerProps = {
  hideFollowUp: HideFollowUpState
  accountNameById: Map<string, string>
  onDismiss: () => void
  onAccountScopeToggle: (checked: boolean) => void
  onHideEverywhere: () => void
}

export function HideFollowUpBanner({
  hideFollowUp,
  accountNameById,
  onDismiss,
  onAccountScopeToggle,
  onHideEverywhere,
}: HideFollowUpBannerProps) {
  return (
    <FollowUpBannerShell>
      <div
        className="rounded-2xl border border-border/90 bg-card/95 p-4 shadow-[0_20px_48px_-24px_hsl(var(--foreground)/0.48)] backdrop-blur-[2px] sm:p-5"
        role="status"
        aria-live="polite"
      >
        <p className="text-sm font-semibold text-foreground">Hide all matching transactions?</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Hide all past{' '}
          <span className="font-medium text-foreground">{hideFollowUp.merchantCanonical}</span>{' '}
          transactions and create a rule to auto-hide future ones.
        </p>

        <label className="mt-3 flex items-start gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-sm text-foreground">
          <input
            type="checkbox"
            checked={hideFollowUp.includeAccountScope}
            disabled={hideFollowUp.pending}
            onChange={(e) => onAccountScopeToggle(e.target.checked)}
            className="mt-0.5 rounded border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <span>
            Only this account
            <span className="block text-xs text-muted-foreground">
              {accountNameById.get(hideFollowUp.accountId) ?? 'Current account'}
            </span>
          </span>
        </label>

        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
          <button
            type="button"
            disabled={hideFollowUp.pending}
            onClick={onDismiss}
            className="rounded-xl border border-border px-3 py-2 text-sm font-medium text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
          >
            Just this one
          </button>
          <button
            type="button"
            disabled={hideFollowUp.pending}
            onClick={onHideEverywhere}
            className="rounded-xl border border-primary bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
          >
            {hideFollowUp.pending ? 'Hiding...' : 'Hide everywhere (past + future)'}
          </button>
        </div>
      </div>
    </FollowUpBannerShell>
  )
}
