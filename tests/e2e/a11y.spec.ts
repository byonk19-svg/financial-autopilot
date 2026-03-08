import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { ensureSignedIn, hasAuthSetup } from './helpers/auth'

async function expectNoSeriousA11yViolations(page: Page, pageName: string): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
  const seriousViolations = results.violations.filter((violation) =>
    ['serious', 'critical'].includes(violation.impact ?? ''),
  )

  const details = seriousViolations
    .map((violation) => {
      const targets = violation.nodes.flatMap((node) => node.target).join(', ')
      return `- [${violation.impact}] ${violation.id}: ${targets || 'no selector provided'}`
    })
    .join('\n')

  expect(
    seriousViolations,
    `Accessibility violations found on ${pageName}:\n${details || 'no details'}`,
  ).toEqual([])
}

test.describe('accessibility checks (unauthenticated)', () => {
  test.use({
    storageState: { cookies: [], origins: [] },
  })

  test('login page has no serious WCAG A/AA violations', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible()
    await expectNoSeriousA11yViolations(page, '/login')
  })

  test('transactions redirect login page has no serious WCAG A/AA violations', async ({ page }) => {
    await page.goto('/transactions')
    await expect.poll(() => new URL(page.url()).pathname).toBe('/login')
    await expect(page.getByText('Choose a login method.')).toBeVisible()
    await expectNoSeriousA11yViolations(page, '/login?next=/transactions')
  })
})

test.describe('accessibility checks (authenticated)', () => {
  test.skip(
    !hasAuthSetup(),
    'Set PLAYWRIGHT_EMAIL + PLAYWRIGHT_PASSWORD, or PLAYWRIGHT_AUTH_STATE to run authenticated accessibility checks.',
  )

  test('subscriptions page has no serious WCAG A/AA violations', async ({ page }) => {
    await ensureSignedIn(page)
    await page.goto('/subscriptions')
    await expect(page.getByTestId('subscriptions-page')).toBeVisible()
    await expectNoSeriousA11yViolations(page, '/subscriptions')
  })
})
