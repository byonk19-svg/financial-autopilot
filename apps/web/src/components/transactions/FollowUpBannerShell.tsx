import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'

type FollowUpBannerShellProps = {
  children: ReactNode
}

export function FollowUpBannerShell({ children }: FollowUpBannerShellProps) {
  if (typeof document === 'undefined' || !document.body) {
    return null
  }

  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-4 pt-2 sm:px-6 sm:pb-6">
      <div className="pointer-events-auto w-full max-w-xl">{children}</div>
    </div>,
    document.body,
  )
}
