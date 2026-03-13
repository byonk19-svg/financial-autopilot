import { Link } from 'react-router-dom'
import type { TransactionToast } from '@/lib/types'

type TransactionsToastProps = {
  onDismiss: () => void
  toast: TransactionToast
}

export function TransactionsToast({ onDismiss, toast }: TransactionsToastProps) {
  return (
    <div
      key={toast.id}
      className={`fixed bottom-4 right-4 z-50 max-w-sm rounded-lg px-4 py-3 text-sm shadow-lg ${
        toast.tone === 'error'
          ? 'border border-rose-300 bg-rose-50 text-rose-700'
          : 'border border-primary/30 bg-primary/10 text-primary'
      }`}
      role="status"
      aria-live="polite"
    >
      {toast.message}
      {toast.link ? (
        <Link to={toast.link.href} className="ml-1 font-medium underline" onClick={onDismiss}>
          {toast.link.label}
        </Link>
      ) : null}
    </div>
  )
}
