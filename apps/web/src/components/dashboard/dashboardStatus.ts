export type DashboardTone = 'neutral' | 'positive' | 'warning' | 'danger'

type DashboardStatusUi = {
  tone: DashboardTone
  badgeClassName: string
  dotClassName: string
  textClassName: string
  surfaceClassName: string
}

const DASHBOARD_TONE_UI: Record<DashboardTone, Omit<DashboardStatusUi, 'tone'>> = {
  neutral: {
    badgeClassName: 'border-border/80 bg-muted/40 text-foreground/80',
    dotClassName: 'bg-muted-foreground/45',
    textClassName: 'text-muted-foreground',
    surfaceClassName: 'border-border/70 bg-background/30',
  },
  positive: {
    badgeClassName: 'border-emerald-300/80 bg-emerald-50 text-emerald-900',
    dotClassName: 'bg-emerald-500',
    textClassName: 'text-emerald-800',
    surfaceClassName: 'border-emerald-200/80 bg-emerald-50/70',
  },
  warning: {
    badgeClassName: 'border-amber-300/80 bg-amber-50 text-amber-950',
    dotClassName: 'bg-amber-500',
    textClassName: 'text-amber-900',
    surfaceClassName: 'border-amber-200/80 bg-amber-50/70',
  },
  danger: {
    badgeClassName: 'border-rose-300/80 bg-rose-50 text-rose-900',
    dotClassName: 'bg-rose-500',
    textClassName: 'text-rose-900',
    surfaceClassName: 'border-rose-200/80 bg-rose-50/70',
  },
}

export function getDashboardToneUi(tone: DashboardTone): DashboardStatusUi {
  return {
    tone,
    ...DASHBOARD_TONE_UI[tone],
  }
}

export function getDashboardStatusUi(status: string | null): DashboardStatusUi {
  return getDashboardToneUi(getDashboardToneFromStatus(status))
}

export function getDashboardToneFromStatus(status: string | null): DashboardTone {
  const normalized = (status ?? '').toLowerCase()
  if (normalized.includes('succeeded') || normalized.includes('current') || normalized.includes('healthy')) {
    return 'positive'
  }
  if (normalized.includes('running') || normalized.includes('stale') || normalized.includes('lagging')) {
    return 'warning'
  }
  if (
    normalized.includes('failed') ||
    normalized.includes('error') ||
    normalized.includes('missing') ||
    normalized.includes('unavailable')
  ) {
    return 'danger'
  }
  return 'neutral'
}

export function humanizeDashboardStatus(status: string | null, fallback = 'Unknown'): string {
  if (!status) return fallback
  const trimmed = status.replace(/[_-]+/g, ' ').trim()
  if (!trimmed) return fallback
  return trimmed.replace(/\b\w/g, (char) => char.toUpperCase())
}
