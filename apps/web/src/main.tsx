import React from 'react'
import ReactDOM from 'react-dom/client'
import * as Sentry from '@sentry/react'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { captureException } from './lib/errorReporting'
import './index.css'

const sentryDsn = import.meta.env.VITE_SENTRY_DSN

if (!import.meta.env.DEV && sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: import.meta.env.MODE,
  })
}

window.addEventListener('unhandledrejection', (event) => {
  captureException(event.reason, { source: 'unhandledrejection' })
})

window.addEventListener('error', (event) => {
  captureException(event.error ?? event.message, { source: 'window.onerror' })
})

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Root element #root not found. Check index.html.')
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
