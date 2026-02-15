import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

type Insight = {
  id: string
  type: 'pattern' | 'opportunity' | 'warning' | 'projection'
  title: string
  body: string
  week_of: string
  created_at: string
  is_read: boolean
  is_dismissed: boolean
}

type InsightFeedProps = {
  userId: string
}

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

export default function InsightFeed({ userId }: InsightFeedProps) {
  const [insights, setInsights] = useState<Insight[]>([])
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState('')

  const loadInsights = async () => {
    setFetching(true)
    setError('')

    const { data, error: fetchError } = await supabase
      .from('insights')
      .select('id, type, title, body, week_of, created_at, is_read, is_dismissed')
      .eq('user_id', userId)
      .eq('is_dismissed', false)
      .order('week_of', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(200)

    if (fetchError) {
      setError('Could not load insights.')
      setFetching(false)
      return
    }

    setInsights((data ?? []) as Insight[])
    setFetching(false)
  }

  useEffect(() => {
    void loadInsights()
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
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm text-slate-600">Loading insights...</p>
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
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Insight Feed</h2>
        <p className="mt-2 text-sm text-slate-600">No insights yet. Run sync and wait for the weekly job.</p>
      </section>
    )
  }

  return (
    <section className="space-y-4">
      {grouped.map(([weekOf, items]) => (
        <div key={weekOf} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Week Of {weekLabel(weekOf)}
          </h2>
          <div className="mt-4 space-y-3">
            {items.map((insight) => (
              <article
                key={insight.id}
                onClick={() => void markRead(insight)}
                className={`cursor-pointer rounded-lg border p-4 transition ${
                  insight.is_read ? 'border-slate-200 bg-white' : 'border-cyan-200 bg-cyan-50/40'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="rounded-md bg-slate-900 px-2 py-1 text-xs font-semibold text-white">
                    {typeBadge(insight.type)}
                  </span>
                  <button
                    onClick={(event) => {
                      event.stopPropagation()
                      void dismissInsight(insight.id)
                    }}
                    className="text-xs font-medium text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline"
                  >
                    Dismiss
                  </button>
                </div>
                <h3 className="mt-3 text-base font-semibold text-slate-900">{insight.title}</h3>
                <p className="mt-2 text-sm text-slate-700">{insight.body}</p>
                <p className="mt-3 text-xs text-slate-500">
                  {new Date(insight.created_at).toLocaleString()}
                  {!insight.is_read && ' • Unread'}
                </p>
              </article>
            ))}
          </div>
        </div>
      ))}
    </section>
  )
}
