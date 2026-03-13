import { useCallback, useRef } from 'react'
import type { FormEvent } from 'react'
import { useModalA11y } from '@/hooks/useModalA11y'

type CreateCategoryModalProps = {
  createCategoryError: string
  createCategoryName: string
  createCategorySubmitting: boolean
  onClose: () => void
  onCreate: () => void
  onNameChange: (value: string) => void
}

export function CreateCategoryModal({
  createCategoryError,
  createCategoryName,
  createCategorySubmitting,
  onClose,
  onCreate,
  onNameChange,
}: CreateCategoryModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = useCallback((event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void onCreate()
  }, [onCreate])

  useModalA11y({
    open: true,
    onClose,
    containerRef: modalRef,
    initialFocusRef: inputRef,
  })

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-category-title"
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        className="w-full max-w-sm rounded-xl border border bg-card p-5 shadow-xl"
      >
        <h3 id="create-category-title" className="text-lg font-semibold text-foreground">
          New category
        </h3>
        <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="text"
            value={createCategoryName}
            onChange={(event) => onNameChange(event.target.value)}
            placeholder="Category name"
            disabled={createCategorySubmitting}
            className="w-full rounded-md border border px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
          />
          {createCategoryError ? (
            <p className="text-sm text-rose-600">{createCategoryError}</p>
          ) : null}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={createCategorySubmitting}
              onClick={onClose}
              className="min-h-11 rounded-md border border px-3 py-2 text-sm font-medium text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60 md:min-h-9 md:py-1.5"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createCategorySubmitting || !createCategoryName.trim()}
              className="min-h-11 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60 md:min-h-9 md:py-1.5"
            >
              {createCategorySubmitting ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
