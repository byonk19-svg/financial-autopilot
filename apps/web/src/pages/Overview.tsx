import { Link } from 'react-router-dom'
import { CardIcon } from '@/components/accounts/CardIcon'
import { OwnerSelect } from '@/components/accounts/OwnerSelect'
import { useOverview } from '@/hooks/useOverview'
import { toNumber } from '@/lib/subscriptionFormatters'

function toCurrency(value: number, currency = 'USD') {
  return value.toLocaleString(undefined, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  })
}

function isInvestment(type: string): boolean {
  return /invest|broker|retirement|401|ira|roth|wealth/i.test(type)
}

export default function Overview() {
  const { loading, accounts, fetching, syncing, message, error, groups, netWorth, assignOwner, onSyncNow } =
    useOverview()

  return (
    <section className="space-y-4">
      {/* Header */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Accounts</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Account balances across all linked accounts. Assign each account to Brianna, Elaine, or
              Household.
            </p>
          </div>
          <button
            onClick={() => {
              void onSyncNow()
            }}
            disabled={syncing || loading}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-colors-fast hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {syncing ? 'Syncing...' : 'Sync now'}
          </button>
        </div>

        {!fetching && accounts.length > 0 && (
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {groups.map((group) => (
              <div key={group.label} className="rounded-lg border border-border bg-muted/30 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{group.label}</p>
                <p
                  className={`mt-1 text-xl font-semibold ${
                    group.isDebt && toNumber(group.total) < 0 ? 'text-rose-600' : 'text-foreground'
                  }`}
                >
                  {toCurrency(toNumber(group.total))}
                </p>
              </div>
            ))}
            <div className="rounded-lg border border-border bg-primary/5 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Net worth</p>
              <p className={`mt-1 text-xl font-semibold ${netWorth < 0 ? 'text-rose-600' : 'text-foreground'}`}>
                {toCurrency(netWorth)}
              </p>
            </div>
          </div>
        )}

        {message && (
          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-sm text-emerald-700">
            {message}
          </div>
        )}
        {error && (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50/80 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}
      </div>

      {/* Account groups */}
      {fetching ? (
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="space-y-2.5">
            {Array.from({ length: 5 }).map((_, index) => (
              <div
                key={index}
                className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-3"
              >
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-36 animate-pulse rounded bg-muted" />
                </div>
                <div className="h-3 w-20 animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
        </div>
      ) : accounts.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="rounded-lg border border-dashed border bg-muted/30 px-4 py-6 text-center">
            <p className="text-sm text-muted-foreground">
              No accounts yet. Connect your bank to start syncing balances.
            </p>
            <Link
              to="/connect"
              className="mt-3 inline-flex rounded-md border border-border px-3 py-1.5 text-sm font-semibold text-foreground transition-colors-fast hover:bg-muted"
            >
              Go to Connect
            </Link>
          </div>
        </div>
      ) : (
        groups.map((group) => (
          <div key={group.label} className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-foreground">{group.label}</h2>
              <span
                className={`text-sm font-semibold ${
                  group.isDebt && toNumber(group.total) < 0 ? 'text-rose-600' : 'text-muted-foreground'
                }`}
              >
                {toCurrency(toNumber(group.total))}
              </span>
            </div>

            <ul className="mt-3 space-y-2">
              {group.accounts.map((account) => {
                const bal = toNumber(account.balance)
                const available =
                  account.available_balance !== null && account.available_balance !== undefined
                    ? toNumber(account.available_balance)
                    : null

                return (
                  <li
                    key={account.id}
                    className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2.5 transition-colors-fast hover:bg-muted/60"
                  >
                    <span className="flex items-center gap-2.5 text-sm text-foreground">
                      <CardIcon isCredit={account.is_credit} isInvest={isInvestment(account.type)} />
                      <span className="flex flex-col gap-0.5">
                        <span className="font-medium leading-tight">{account.name}</span>
                        {account.institution && (
                          <span className="text-xs text-muted-foreground">{account.institution}</span>
                        )}
                      </span>
                      <OwnerSelect accountId={account.id} owner={account.owner} onSave={assignOwner} />
                    </span>

                    <span className="flex flex-col items-end gap-0.5">
                      <span
                        className={`text-sm font-semibold ${
                          group.isDebt && bal < 0 ? 'text-rose-600' : 'text-foreground'
                        }`}
                      >
                        {toCurrency(bal, account.currency || 'USD')}
                      </span>
                      {available !== null && group.isDebt && (
                        <span className="text-[11px] text-muted-foreground">
                          {toCurrency(available, account.currency || 'USD')} avail
                        </span>
                      )}
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        ))
      )}
    </section>
  )
}
