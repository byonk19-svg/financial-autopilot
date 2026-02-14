const functionsBaseUrl = import.meta.env.VITE_FUNCTIONS_URL

if (!functionsBaseUrl) {
  throw new Error('Missing VITE_FUNCTIONS_URL')
}

export function functionUrl(name: string): string {
  return `${functionsBaseUrl.replace(/\/+$/, '')}/${name}`
}
