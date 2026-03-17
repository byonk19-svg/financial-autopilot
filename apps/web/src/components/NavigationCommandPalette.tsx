import type { ChangeEvent } from 'react'
import { Link } from 'react-router-dom'
import { Search, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type NavigationCommandPaletteItem = {
  description: string
  icon: LucideIcon
  label: string
  to: string
}

type NavigationCommandPaletteProps = {
  navItems: NavigationCommandPaletteItem[]
  navSearch: string
  onClose: () => void
  onNavClick: () => void
  onSearchChange: (event: ChangeEvent<HTMLInputElement>) => void
  open: boolean
  preloadRoute: (item: NavigationCommandPaletteItem) => void
}

export function filterNavigationItems(
  navItems: NavigationCommandPaletteItem[],
  navSearch: string,
): NavigationCommandPaletteItem[] {
  const query = navSearch.trim().toLowerCase()
  if (!query) return navItems

  return navItems.filter((item) => item.label.toLowerCase().includes(query))
}

export function NavigationCommandPalette({
  navItems,
  navSearch,
  onClose,
  onNavClick,
  onSearchChange,
  open,
  preloadRoute,
}: NavigationCommandPaletteProps) {
  if (!open) return null

  const filteredNavItems = filterNavigationItems(navItems, navSearch)

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center px-4 pb-6 pt-[12vh] sm:px-6" role="dialog" aria-modal={true} aria-label="Navigation command palette">
      <button
        type="button"
        aria-label="Close navigation search"
        className="absolute inset-0 bg-foreground/28 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div className="panel-soft relative z-10 w-full max-w-2xl border-border/85 bg-background/96 p-3 shadow-[0_24px_80px_-30px_hsl(var(--foreground)/0.5)] backdrop-blur-xl">
        <div className="flex items-center gap-2 border-b border-border/80 pb-3">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              autoFocus
              value={navSearch}
              onChange={onSearchChange}
              placeholder="Go to a page"
              className="h-11 w-full rounded-xl border border-border bg-card/92 pl-9 pr-4 text-sm font-medium text-foreground shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              aria-label="Search navigation pages"
            />
          </div>
          <button
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-card/90 text-muted-foreground transition-colors-fast hover:bg-secondary hover:text-foreground"
            onClick={onClose}
            aria-label="Close command palette"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3">
          {filteredNavItems.length === 0 ? (
            <p className="px-2 py-3 text-sm text-muted-foreground">No navigation pages match "{navSearch}".</p>
          ) : (
            <ul className="space-y-1" role="listbox" aria-label="Navigation search results">
              {filteredNavItems.map((item) => {
                const Icon = item.icon
                return (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      onClick={onNavClick}
                      onMouseEnter={() => preloadRoute(item)}
                      onFocus={() => preloadRoute(item)}
                      className="flex min-h-12 items-start justify-between gap-3 rounded-xl px-3 py-2 text-sm transition-colors-fast hover:bg-secondary"
                    >
                      <span className="inline-flex min-w-0 items-start gap-3">
                        <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/80 bg-card/80 text-muted-foreground">
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-semibold text-foreground">{item.label}</span>
                          <span className="mt-0.5 block truncate text-xs text-muted-foreground">{item.description}</span>
                        </span>
                      </span>
                      <span className="pt-1 text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">{item.to}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
