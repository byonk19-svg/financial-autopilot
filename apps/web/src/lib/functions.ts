const configuredFunctionsBaseUrl = import.meta.env.VITE_FUNCTIONS_URL
const functionsBaseUrl = import.meta.env.DEV ? '/functions/v1' : configuredFunctionsBaseUrl

if (!functionsBaseUrl) {
  throw new Error('Missing VITE_FUNCTIONS_URL')
}

export function functionUrl(name: string): string {
  return `${functionsBaseUrl.replace(/\/+$/, '')}/${name}`
}
