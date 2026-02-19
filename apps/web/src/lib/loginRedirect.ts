export function getLoginRedirectPath(nextPath?: string): string {
  const fallback = '/login'
  const currentPath =
    typeof window !== 'undefined' ? `${window.location.pathname}${window.location.search}` : '/'
  const candidate = (nextPath ?? currentPath).trim()

  if (!candidate.startsWith('/') || candidate.startsWith('//')) {
    return fallback
  }

  return `/login?next=${encodeURIComponent(candidate)}`
}

