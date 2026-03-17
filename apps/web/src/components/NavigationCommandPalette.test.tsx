import type { ReactNode } from 'react'
import { isValidElement } from 'react'
import { describe, expect, it } from 'vitest'
import {
  NavigationCommandPalette,
  filterNavigationItems,
  type NavigationCommandPaletteItem,
} from './NavigationCommandPalette'

function collectElements(node: ReactNode, results: Array<{ type: unknown; props: Record<string, unknown> }> = []) {
  if (Array.isArray(node)) {
    node.forEach((child) => collectElements(child, results))
    return results
  }

  if (!isValidElement(node)) return results

  results.push({
    type: node.type,
    props: (node.props as Record<string, unknown>) ?? {},
  })

  collectElements((node.props as { children?: ReactNode }).children, results)
  return results
}

const navItems: NavigationCommandPaletteItem[] = [
  {
    description: 'Quick health and priority actions for this month.',
    icon: 'span' as never,
    label: 'Dashboard',
    to: '/',
  },
  {
    description: 'Categorize and review imported spending activity.',
    icon: 'span' as never,
    label: 'Transactions',
    to: '/transactions',
  },
]

describe('filterNavigationItems', () => {
  it('returns all nav items when the query is empty', () => {
    expect(filterNavigationItems(navItems, '')).toEqual(navItems)
  })

  it('filters nav items by label when a query is present', () => {
    expect(filterNavigationItems(navItems, 'trans')).toEqual([navItems[1]])
  })
})

describe('NavigationCommandPalette', () => {
  it('renders nothing while closed', () => {
    const tree = NavigationCommandPalette({
      navItems,
      navSearch: '',
      onClose: () => {},
      onNavClick: () => {},
      onSearchChange: () => {},
      open: false,
      preloadRoute: () => {},
    })

    expect(tree).toBeNull()
  })

  it('renders a command palette dialog when open', () => {
    const tree = NavigationCommandPalette({
      navItems,
      navSearch: '',
      onClose: () => {},
      onNavClick: () => {},
      onSearchChange: () => {},
      open: true,
      preloadRoute: () => {},
    })

    const elements = collectElements(tree)
    const dialog = elements.find((element) => element.props.role === 'dialog')
    const input = elements.find(
      (element) => element.type === 'input' && element.props.placeholder === 'Go to a page',
    )

    expect(dialog).toBeDefined()
    expect(dialog?.props['aria-modal']).toBe(true)
    expect(input).toBeDefined()
  })
})
