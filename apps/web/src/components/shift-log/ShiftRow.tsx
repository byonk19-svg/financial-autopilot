import { format, parseISO } from 'date-fns'
import EmployerBadge from './EmployerBadge'
import type { EmployerLocationRecord, EmployerRecord, ShiftRecord } from '@/lib/types'
import { toNumber } from '@/lib/subscriptionFormatters'

type ShiftRowProps = {
  shift: ShiftRecord
  employer: EmployerRecord | undefined
  location: EmployerLocationRecord | undefined
  onEdit: (shift: ShiftRecord) => void
  onDuplicate: (shift: ShiftRecord) => void
  onDelete: (shiftId: string) => void
  busy: boolean
}

export default function ShiftRow({ shift, employer, location, onEdit, onDuplicate, onDelete, busy }: ShiftRowProps) {
  const dateLabel = format(parseISO(`${shift.shift_date}T00:00:00`), 'EEE, MMM d')

  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <EmployerBadge employer={employer} />
          {location ? <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{location.short_code}</span> : null}
          <span className="text-xs text-muted-foreground">{dateLabel}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onEdit(shift)}
            disabled={busy}
            className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground transition-colors-fast hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => onDuplicate(shift)}
            disabled={busy}
            className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground transition-colors-fast hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
          >
            Duplicate
          </button>
          <button
            type="button"
            onClick={() => onDelete(shift.id)}
            disabled={busy}
            className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground transition-colors-fast hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? 'Working...' : 'Remove'}
          </button>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <div>
          <p className="text-xs text-muted-foreground">Hours</p>
          <p className="font-medium text-foreground">{toNumber(shift.hours_worked).toFixed(2)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Gross</p>
          <p className="font-medium text-foreground">${toNumber(shift.gross_pay).toFixed(2)}</p>
        </div>
        <div className="col-span-2">
          <p className="text-xs text-muted-foreground">Notes</p>
          <p className="font-medium text-foreground">
            {shift.is_non_pay ? 'Non-pay day' : shift.notes?.trim() ? shift.notes : '—'}
          </p>
        </div>
      </div>
    </div>
  )
}

