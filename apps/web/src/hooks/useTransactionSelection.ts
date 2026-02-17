import { useCallback, useMemo, useState } from 'react'

export function useTransactionSelection(visibleTransactionIds: string[]) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const visibleIdSet = useMemo(() => new Set(visibleTransactionIds), [visibleTransactionIds])

  const selectedIdsArray = useMemo(() => Array.from(selectedIds), [selectedIds])
  const selectedCount = selectedIdsArray.length

  const selectedVisibleCount = useMemo(
    () => visibleTransactionIds.reduce((count, id) => count + (selectedIds.has(id) ? 1 : 0), 0),
    [selectedIds, visibleTransactionIds],
  )
  const allVisibleSelected = visibleTransactionIds.length > 0 && selectedVisibleCount === visibleTransactionIds.length
  const someVisibleSelected = selectedVisibleCount > 0 && !allVisibleSelected

  const isSelected = useCallback((id: string) => selectedIds.has(id), [selectedIds])

  const toggleOne = useCallback((id: string, checked: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }, [])

  const toggleAllVisible = useCallback(
    (checked: boolean) => {
      setSelectedIds((current) => {
        const next = new Set(current)
        for (const id of visibleTransactionIds) {
          if (checked) next.add(id)
          else next.delete(id)
        }
        return next
      })
    },
    [visibleTransactionIds],
  )

  const replaceSelection = useCallback((ids: string[]) => {
    setSelectedIds(new Set(ids))
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  const keepOnlyVisible = useCallback(() => {
    setSelectedIds((current) => {
      const next = new Set<string>()
      for (const id of current) {
        if (visibleIdSet.has(id)) next.add(id)
      }
      return next
    })
  }, [visibleIdSet])

  return {
    allVisibleSelected,
    someVisibleSelected,
    selectedIdsArray,
    selectedCount,
    isSelected,
    toggleOne,
    toggleAllVisible,
    replaceSelection,
    clearSelection,
    keepOnlyVisible,
  }
}
