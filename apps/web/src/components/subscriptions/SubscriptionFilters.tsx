import { useCallback, type ChangeEvent } from 'react'
import { Check, SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { CadenceFilter } from '@/hooks/useSubscriptions'
import { DENSITY_LABELS } from '@/hooks/useSubscriptions'
import type { DensityMode } from '@/lib/subscriptionFormatters'
import { Card, CardContent } from '@/components/ui/card'

type SubscriptionFiltersProps = {
  searchQuery: string
  onSearchChange: (value: string) => void
  cadenceFilter: CadenceFilter
  onCadenceChange: (value: CadenceFilter) => void
  priceIncreaseOnly: boolean
  onPriceIncreaseOnlyChange: (value: boolean) => void
  showIgnored: boolean
  onShowIgnoredChange: (value: boolean) => void
  density: DensityMode
  onDensityChange: (value: DensityMode) => void
  hasFiltersApplied: boolean
  onClearFilters: () => void
}

export function SubscriptionFilters({
  searchQuery,
  onSearchChange,
  cadenceFilter,
  onCadenceChange,
  priceIncreaseOnly,
  onPriceIncreaseOnlyChange,
  showIgnored,
  onShowIgnoredChange,
  density,
  onDensityChange,
  hasFiltersApplied,
  onClearFilters,
}: SubscriptionFiltersProps) {
  const compact = density === 'compact'
  const searchInputId = 'subscriptions-search'
  const handleSearchInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      onSearchChange(event.target.value)
    },
    [onSearchChange],
  )
  const handlePriceIncreaseToggle = useCallback(() => {
    onPriceIncreaseOnlyChange(!priceIncreaseOnly)
  }, [onPriceIncreaseOnlyChange, priceIncreaseOnly])
  const handleShowIgnoredToggle = useCallback(() => {
    onShowIgnoredChange(!showIgnored)
  }, [onShowIgnoredChange, showIgnored])
  const handleDensityChange = useCallback(
    (value: string) => {
      onDensityChange(value as DensityMode)
    },
    [onDensityChange],
  )
  const handleCadenceChange = useCallback(
    (value: string) => {
      onCadenceChange(value as CadenceFilter)
    },
    [onCadenceChange],
  )

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardContent className={`space-y-3 ${compact ? 'p-3' : 'p-3.5'}`}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label htmlFor={searchInputId} className="sr-only">
            Search recurring merchants
          </label>
          <Input
            id={searchInputId}
            value={searchQuery}
            onChange={handleSearchInputChange}
            placeholder="Search merchant"
            className={compact ? 'h-8 text-xs' : 'h-9 text-sm'}
          />

          <div className="flex shrink-0 items-center gap-2">
            <Button
              type="button"
              variant={priceIncreaseOnly ? 'secondary' : 'outline'}
              size="sm"
              onClick={handlePriceIncreaseToggle}
            >
              {priceIncreaseOnly && <Check className="h-3.5 w-3.5" />}
              Price increase only
            </Button>
            <Button
              type="button"
              variant={showIgnored ? 'secondary' : 'outline'}
              size="sm"
              onClick={handleShowIgnoredToggle}
            >
              {showIgnored && <Check className="h-3.5 w-3.5" />}
              Show ignored
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" size="sm" className="gap-1.5" aria-label="Open filter options">
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  Options
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Density</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={density} onValueChange={handleDensityChange}>
                  <DropdownMenuRadioItem value="comfortable">Comfortable</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="compact">Compact</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>

                {hasFiltersApplied && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={onClearFilters}>Clear filters</DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <nav aria-label="Cadence filters">
          <Tabs value={cadenceFilter} onValueChange={handleCadenceChange}>
            <TabsList className="h-8 w-full justify-start overflow-x-auto">
              <TabsTrigger value="all" className="text-xs">
                All cadence
              </TabsTrigger>
              <TabsTrigger value="weekly" className="text-xs">
                Weekly
              </TabsTrigger>
              <TabsTrigger value="monthly" className="text-xs">
                Monthly
              </TabsTrigger>
              <TabsTrigger value="annual" className="text-xs">
                Annual
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </nav>

        <p className="text-xs text-muted-foreground">
          Needs Review is sorted by confidence (lowest first), then next expected date. Other sections sort by next
          expected date. Density is set to <span className="font-medium text-foreground">{DENSITY_LABELS[density]}</span>.
        </p>
      </CardContent>
    </Card>
  )
}
