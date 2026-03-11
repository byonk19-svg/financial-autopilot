import { useEffect, useRef, useState } from 'react'
import type { AccountRow } from '@/lib/types'

type OwnerSelectProps = {
  accountId: string
  owner: AccountRow['owner']
  onSave: (accountId: string, owner: AccountRow['owner']) => Promise<boolean>
}

export function OwnerSelect({ accountId, owner, onSave }: OwnerSelectProps) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handlePick = async (next: AccountRow['owner']) => {
    if (next === owner) {
      setOpen(false)
      return
    }
    setSaving(true)
    setOpen(false)
    await onSave(accountId, next)
    setSaving(false)
  }

  const triggerClass =
    owner === 'brianna'
      ? 'bg-primary/10 text-primary'
      : owner === 'elaine'
        ? 'bg-violet-100 text-violet-700'
        : 'bg-muted/60 text-muted-foreground border border-dashed border-border'

  const triggerLabel =
    owner === 'brianna' ? 'Brianna' : owner === 'elaine' ? 'Elaine' : saving ? '…' : '+ Assign'

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={saving}
        className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition-opacity hover:opacity-80 disabled:opacity-50 ${triggerClass}`}
      >
        {triggerLabel}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 min-w-[110px] overflow-hidden rounded-lg border border-border bg-card shadow-md">
          {(['brianna', 'elaine', 'household'] as const).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => {
                void handlePick(opt)
              }}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-muted/60 ${
                opt === owner ? 'font-semibold text-foreground' : 'text-muted-foreground'
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  opt === 'brianna'
                    ? 'bg-primary'
                    : opt === 'elaine'
                      ? 'bg-violet-500'
                      : 'bg-muted-foreground/40'
                }`}
              />
              {opt === 'brianna' ? 'Brianna' : opt === 'elaine' ? 'Elaine' : 'Household'}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
