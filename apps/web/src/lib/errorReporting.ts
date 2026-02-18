import * as Sentry from '@sentry/react'

type ErrorContext = Record<string, string>

type NormalizedError = {
  name: string
  message: string
  stack?: string
}

function normalizeError(error: unknown): NormalizedError {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    }
  }

  return {
    name: 'UnknownError',
    message: typeof error === 'string' ? error : 'Unknown error',
  }
}

export function captureException(error: unknown, context: ErrorContext = {}): void {
  const normalized = normalizeError(error)
  const payload = {
    kind: 'exception',
    ...normalized,
    context,
    timestamp: new Date().toISOString(),
  }

  if (import.meta.env.DEV) {
    console.error('[error-reporting]', payload)
    return
  }

  const sentryError =
    error instanceof Error ? error : new Error(typeof error === 'string' ? error : normalized.message)

  Sentry.captureException(sentryError, {
    tags: {
      source: 'error-reporting',
    },
    extra: payload,
  })
}

export function captureMessage(message: string, level: 'info' | 'warning' | 'error'): void {
  const payload = {
    kind: 'message',
    level,
    message,
    timestamp: new Date().toISOString(),
  }

  if (import.meta.env.DEV) {
    if (level === 'error') {
      console.error('[error-reporting]', payload)
      return
    }

    if (level === 'warning') {
      console.warn('[error-reporting]', payload)
      return
    }

    console.info('[error-reporting]', payload)
    return
  }

  Sentry.captureMessage(message, {
    level: level === 'warning' ? 'warning' : level === 'error' ? 'error' : 'info',
    tags: {
      source: 'error-reporting',
    },
    extra: payload,
  })
}
