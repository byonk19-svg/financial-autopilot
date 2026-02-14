import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useSession } from '../lib/session'

type FeedItem = {
  id: string
  item_type: string
  title: string
  summary: string
  is_read: boolean
  created_at: string
  action_label: string | null
  action_url: string | null
}

function itemTypeLabel(itemType: string): string {
  if (itemType === 'weekly_insight') return 'Weekly Insight'
  if (itemType === 'sync_notice') return 'Sync Notice'
  if (itemType === 'rule_suggestion') return 'Rule Suggestion'
  if (itemType === 'anomaly') return 'Anomaly'
  return 'Info'
}

export default function Feed() {
  const navigate = useNavigate()
  const { session, loading } = useSession()
  const [items, setItems] = useState<FeedItem[]>([])
  const [fetching, setFetching] = useState(true)
  const [error, setError] = useState('')

  const loadFeed = async () => {
    if (!session?.user) return
    setFetching(true)
    setError('')

    const { data, error: fetchError } = await supabase
      .from('autopilot_feed_items')
      .select('id, item_type, title, summary, is_read, created_at, action_label, action_url')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(100)

    if (fetchError) {
      setError('Could not load feed.')
      setFetching(false)
      return
    }

    setItems((data ?? []) as FeedItem[])
    setFetching(false)
  }

  useEffect(() => {
    if (loading) return
    if (!session?.user) {
      navigate('/login', { replace: true })
      return
    }

    void loadFeed()
  }, [loading, navigate, session])

  const markAllRead = async () => {
    if (!session?.user) return

    const { error: updateError } = await supabase
      .from('autopilot_feed_items')
      .update({ is_read: true })
      .eq('user_id', session.user.id)
      .eq('is_read', false)

    if (updateError) {
      setError('Could not mark feed items as read.')
      return
    }

    await loadFeed()
  }

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Autopilot Feed</h1>
            <p className="mt-2 text-sm text-slate-600">
              Weekly insights and automation notices for your finances.
            </p>
          </div>
          <button
            onClick={markAllRead}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            Mark all read
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {fetching ? (
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-slate-600">Loading feed...</p>
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm text-slate-600">
              No feed items yet. Weekly insights will appear after scheduled runs.
            </p>
          </div>
        ) : (
          items.map((item) => (
            <article
              key={item.id}
              className={`rounded-xl border p-5 shadow-sm ${
                item.is_read ? 'border-slate-200 bg-white' : 'border-cyan-200 bg-cyan-50/50'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-slate-900 px-2 py-1 text-xs font-semibold text-white">
                    {itemTypeLabel(item.item_type)}
                  </span>
                  {!item.is_read && (
                    <span className="rounded-md bg-cyan-600 px-2 py-1 text-xs font-semibold text-white">
                      New
                    </span>
                  )}
                </div>
                <span className="text-xs text-slate-500">{new Date(item.created_at).toLocaleString()}</span>
              </div>
              <h2 className="mt-3 text-lg font-semibold text-slate-900">{item.title}</h2>
              <p className="mt-2 text-sm text-slate-700">{item.summary}</p>
              {item.action_url && (
                <button
                  onClick={() => navigate(item.action_url ?? '/')}
                  className="mt-4 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
                >
                  {item.action_label ?? 'Open'}
                </button>
              )}
            </article>
          ))
        )}
      </div>

      {error && <p className="text-sm text-rose-600">{error}</p>}
    </section>
  )
}
