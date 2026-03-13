import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

type DashboardDeferredSectionProps = {
  children: ReactNode
  className?: string
  fallback: ReactNode
  onVisible?: () => void
  rootMargin?: string
}

export function DashboardDeferredSection({
  children,
  className,
  fallback,
  onVisible,
  rootMargin = '320px 0px',
}: DashboardDeferredSectionProps) {
  const [isVisible, setIsVisible] = useState(false)
  const containerRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (isVisible) return
    if (typeof IntersectionObserver === 'undefined') {
      setIsVisible(true)
      onVisible?.()
      return
    }

    const node = containerRef.current
    if (!node) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        setIsVisible(true)
        onVisible?.()
        observer.disconnect()
      },
      { rootMargin },
    )

    observer.observe(node)

    return () => {
      observer.disconnect()
    }
  }, [isVisible, onVisible, rootMargin])

  return (
    <section ref={containerRef} className={className}>
      {isVisible ? children : fallback}
    </section>
  )
}
