import type { ReactNode } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { FollowUpBannerShell } from './FollowUpBannerShell'

type ReactPortalShape = {
  containerInfo?: unknown
  children?: {
    props?: {
      className?: string
      children?: ReactNode
    }
  }
}

const originalDocument = globalThis.document

afterEach(() => {
  if (originalDocument === undefined) {
    Reflect.deleteProperty(globalThis, 'document')
    return
  }

  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: originalDocument,
  })
})

describe('FollowUpBannerShell', () => {
  it('renders into document.body so viewport pinning is not scoped by page transforms', () => {
    const body = { nodeType: 1, nodeName: 'BODY' } as unknown as HTMLElement

    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: { body },
    })

    const portal = FollowUpBannerShell({
      children: <div>Prompt content</div>,
    }) as ReactPortalShape

    expect(portal.containerInfo).toBe(body)
    expect(portal.children?.props?.className).toContain('fixed')
    expect(portal.children?.props?.className).toContain('inset-x-0')
  })
})
