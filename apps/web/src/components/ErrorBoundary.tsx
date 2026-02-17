import { Component, type ErrorInfo, type ReactNode } from 'react'
import { captureException } from '../lib/errorReporting'

type ErrorBoundaryProps = {
  children: ReactNode
}

type ErrorBoundaryState = {
  hasError: boolean
}

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    captureException(error, {
      component: 'ErrorBoundary',
      component_stack: info.componentStack || 'unavailable',
    })
  }

  private handleRetry = (): void => {
    this.setState({ hasError: false })
  }

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children
    }

    return (
      <section className="rounded-xl border border bg-card p-6 text-center shadow-sm">
        <h2 className="text-xl font-semibold text-foreground">Something went wrong. Please refresh.</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          If this keeps happening, try signing out and back in.
        </p>
        <button
          type="button"
          onClick={this.handleRetry}
          className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-colors-fast hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Try Again
        </button>
      </section>
    )
  }
}
