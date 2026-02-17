import { useEffect, useMemo, useState } from 'react'
import type { Insight } from '@/lib/types'
import { supabase } from '../lib/supabase'

type InsightFeedProps = {
  userId: string
}

const INSIGHTS_PAGE_SIZE = 20

function weekLabel(weekOf: string): string {
  const parsed = new Date(`${weekOf}T00:00:00.000Z`)
  return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function typeBadge(type: Insight['type']): string {
  if (type === 'warning') return 'Warning'
  if (type === 'opportunity') return 'Opportunity'
  if (type === 'projection') return 'Projection'
  return 'Pattern'
}

function typeBadgeClass(type: Insight['type']): string {
  if (type === 'warning') return 'bg-amber-50 text-amber-700'
  if (type === 'opportunity') return 'bg-emerald-50 text-emerald-700'
  if (type === 'projection') return 'bg-purple-50 text-purple-700'
  return 'bg-primary/10 text-primary'
}

function LightbulbIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M9 18h6M10 21h4M8.8 14.5c-1.5-1-2.3-2.7-2.3-4.6A5.5 5.5 0 0 1 12 4.5a5.5 5.5 0 0 1 5.5 5.4c0 1.9-.8 3.6-2.3 4.6-.8.6-1.2 1.2-1.3 2H10c-.1-.8-.5-1.4-1.2-2Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default function InsightFeed({ userId }: InsightFeedProps) {
  const [insights, setInsights] = useState<Insight[]>([])
  const [fetching, setFetching] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState('')

  const loadInsights = async (targetPage: number, mode: 'replace' | 'append') => {
    if (mode === 'replace') {
      setFetching(true)
    } else {
      setLoadingMore(true)
    }
    setError('')

    const from = (targetPage - 1) * INSIGHTS_PAGE_SIZE
    const to = from + INSIGHTS_PAGE_SIZE - 1

    const { data, error: fetchError } = await supabase
      .from('insights')
      .select('id, type, title, body, week_of, created_at, is_read, is_dismissed')
      .eq('user_id', userId)
      .eq('is_dismissed', false)
      .order('week_of', { ascending: false })
      .order('created_at', { ascending: false })
      .range(from, to)

    if (fetchError) {
      setError('Could not load insights.')
      setFetching(false)
      setLoadingMore(false)
      return
    }

    const rows = (data ?? []) as Insight[]
    setInsights((current) => {
      if (mode === 'replace') return rows

      const merged = [...current]
      const seen = new Set(current.map((item) => item.id))
      for (const row of rows) {
        if (!seen.has(row.id)) merged.push(row)
      }
      return merged
    })

    setPage(targetPage)
    setHasMore(rows.length === INSIGHTS_PAGE_SIZE)
    setFetching(false)
    setLoadingMore(false)
  }

  useEffect(() => {
    setInsights([])
    setPage(1)
    setHasMore(false)
    void loadInsights(1, 'replace')
  }, [userId])

  const grouped = useMemo(() => {
    const map = new Map<string, Insight[]>()
    for (const insight of insights) {
      const list = map.get(insight.week_of) ?? []
      list.push(insight)
      map.set(insight.week_of, list)
    }
    return [...map.entries()]
  }, [insights])

  const markRead = async (insight: Insight) => {
    if (insight.is_read) return

    const { error: updateError } = await supabase
      .from('insights')
      .update({ is_read: true })
      .eq('id', insight.id)
      .eq('user_id', userId)

    if (updateError) {
      setError('Could not mark insight as read.')
      return
    }

    setInsights((current) =>
      current.map((item) => (item.id === insight.id ? { ...item, is_read: true } : item)),
    )
  }

  const dismissInsight = async (id: string) => {
    const { error: updateError } = await supabase
      .from('insights')
      .update({ is_dismissed: true })
      .eq('id', id)
      .eq('user_id', userId)

    if (updateError) {
      setError('Could not dismiss insight.')
      return
    }

    setInsights((current) => current.filter((insight) => insight.id !== id))
  }

  if (fetching) {
    return (
      <section className="rounded-xl border border bg-card p-5 shadow-sm">
        <p className="text-sm text-muted-foreground">Loading insights...</p>
      </section>
    )
  }

  if (error) {
    return (
      <section className="rounded-xl border border-rose-200 bg-rose-50 p-5 shadow-sm">
        <p className="text-sm text-rose-700">{error}</p>
      </section>
    )
  }

  if (insights.length === 0) {
    return (
      <section className="rounded-xl border border bg-card p-5 shadow-sm">
        <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-foreground">
          <LightbulbIcon className="h-5 w-5 text-primary" />
          Insight Feed
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">No insights yet. Run sync and wait for the weekly job.</p>
      </section>
    )
  }

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border bg-card p-5 shadow-sm">
        <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-foreground">
          <LightbulbIcon className="h-5 w-5 text-primary" />
          Insight Feed
        </h2>
      </div>

      {grouped.map(([weekOf, items]) => (
        <div key={weekOf} className="rounded-xl border border bg-card p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Week Of {weekLabel(weekOf)}
          </h2>
          <div className="mt-4 space-y-3">
            {items.map((insight) => (
              <article
                key={insight.id}
                onClick={() => void markRead(insight)}
                className={`group cursor-pointer rounded-lg border p-4 transition ${
                  insight.is_read ? 'border bg-card' : 'border-primary/20 bg-primary/5'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className={`rounded-md px-2 py-1 text-xs font-semibold ${typeBadgeClass(insight.type)}`}>
                    {typeBadge(insight.type)}
                  </span>
                  <button
                    onClick={(event) => {
                      event.stopPropagation()
                      void dismissInsight(insight.id)
                    }}
                    className="text-xs font-medium text-muted-foreground underline-offset-2 opacity-0 transition-opacity group-hover:opacity-100 hover:text-foreground hover:underline focus-visible:opacity-100"
                  >
                    Dismiss
                  </button>
                </div>
                <h3 className="mt-3 text-base font-semibold text-foreground">{insight.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{insight.body}</p>
                <p className="mt-3 text-xs text-muted-foreground">
                  {new Date(insight.created_at).toLocaleString()}
                  {!insight.is_read && ' - Unread'}
                </p>
              </article>
            ))}
          </div>
        </div>
      ))}

      {hasMore && (
        <div className="rounded-xl border border bg-card p-4 text-center shadow-sm">
          <button
            type="button"
            onClick={() => void loadInsights(page + 1, 'append')}
            disabled={loadingMore}
            className="rounded-md border border px-3 py-1.5 text-sm font-medium text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loadingMore ? 'Loading...' : 'Load more'}
          </button>
        </div>
      )}
    </section>
  )
}
