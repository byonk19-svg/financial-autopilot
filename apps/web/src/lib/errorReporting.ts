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

  // TODO: send `payload` to Sentry or another production error tracking service.
  console.error('[error-reporting]', payload)
}

export function captureMessage(message: string, level: 'info' | 'warning' | 'error'): void {
  const payload = {
    kind: 'message',
    level,
    message,
    timestamp: new Date().toISOString(),
  }

  if (level === 'error') {
    console.error('[error-reporting]', payload)
    return
  }

  if (level === 'warning') {
    console.warn('[error-reporting]', payload)
    return
  }

  console.info('[error-reporting]', payload)
}
