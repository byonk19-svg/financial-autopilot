import { expect, test } from '@playwright/test'
import { ensureSignedIn, hasAuthSetup } from './helpers/auth'

test.describe('authenticated sync -> analysis -> recurring flow', () => {
  test.skip(
    !hasAuthSetup(),
    'Set PLAYWRIGHT_EMAIL + PLAYWRIGHT_PASSWORD, or PLAYWRIGHT_AUTH_STATE to run authenticated flow tests.',
  )

  test('runs sync and analysis, then loads recurring page', async ({ page }) => {
    test.setTimeout(240_000)
    test.slow()

    await ensureSignedIn(page)

    await page.goto('/overview')
    await expect(page.getByRole('heading', { name: 'Accounts' })).toBeVisible()

    const syncButton = page.getByRole('button', { name: 'Sync now' })
    await expect(syncButton).toBeVisible()
    await syncButton.click()

    await expect(page.getByRole('button', { name: 'Syncing...' })).toBeVisible()
    await expect(page.getByText('Sync complete. Accounts:', { exact: false })).toBeVisible({
      timeout: 120_000,
    })

    await page.goto('/rules')
    await expect(page.getByRole('heading', { name: 'Rules', exact: true })).toBeVisible()

    const runAnalysisButton = page.getByRole('button', { name: 'Run analysis now' })
    await expect(runAnalysisButton).toBeVisible()
    await runAnalysisButton.click()

    await expect(page.getByRole('button', { name: 'Running...' })).toBeVisible()
    await expect(page.getByText('Analysis run completed.')).toBeVisible({
      timeout: 120_000,
    })
    await expect(page.getByText('Succeeded', { exact: false })).toBeVisible()

    await page.goto('/subscriptions')
    await expect(page.getByTestId('subscriptions-page')).toBeVisible()
    await expect(page.getByRole('region', { name: 'Recurring Charge Dashboard' })).toBeVisible()

    const hasRecurringSection = await page.getByTestId('recurring-section-subscriptions').isVisible()
    if (!hasRecurringSection) {
      await expect(page.getByText('No subscriptions found yet')).toBeVisible()
    }
  })

  test('transactions hide pending by default and remove filter when toggled on', async ({ page }) => {
    await ensureSignedIn(page)

    await page.goto('/transactions')
    await expect(page.getByTestId('transactions-page')).toBeVisible()

    await page.waitForRequest(
      (request) =>
        request.method() === 'GET' &&
        request.url().includes('/rest/v1/transactions') &&
        request.url().includes('is_pending=eq.false'),
      { timeout: 20_000 },
    )

    const showPendingToggle = page.getByLabel('Show pending')
    await expect(showPendingToggle).not.toBeChecked()
    await showPendingToggle.check()

    await page.waitForRequest(
      (request) =>
        request.method() === 'GET' &&
        request.url().includes('/rest/v1/transactions') &&
        !request.url().includes('is_pending=eq.false'),
      { timeout: 20_000 },
    )
  })

  test('split recurring merchants render as separate rows', async ({ page }) => {
    await ensureSignedIn(page)

    await page.route('**/functions/v1/recurring', async (route) => {
      if (route.request().method() !== 'GET') {
        await route.continue()
        return
      }

      const subscriptionRows = [
        {
          id: 'mock-nfx-chase',
          merchant_normalized: 'NFX CHASE',
          cadence: 'monthly',
          classification: 'subscription',
          is_false_positive: false,
          user_locked: true,
          notify_days_before: 3,
          last_amount: 27.05,
          prev_amount: 27.05,
          next_expected_at: '2026-04-11',
          confidence: 0.98,
          is_active: true,
          primary_payer: 'brianna',
        },
        {
          id: 'mock-nfx-citi',
          merchant_normalized: 'NFX CITI',
          cadence: 'monthly',
          classification: 'subscription',
          is_false_positive: false,
          user_locked: true,
          notify_days_before: 3,
          last_amount: 19.47,
          prev_amount: 19.47,
          next_expected_at: '2026-04-12',
          confidence: 0.97,
          is_active: true,
          primary_payer: 'household',
        },
        {
          id: 'mock-nfx-wayfair',
          merchant_normalized: 'NFX WAYFAIR',
          cadence: 'monthly',
          classification: 'subscription',
          is_false_positive: false,
          user_locked: true,
          notify_days_before: 3,
          last_amount: 19.47,
          prev_amount: 19.47,
          next_expected_at: '2026-04-13',
          confidence: 0.96,
          is_active: true,
          primary_payer: 'elaine',
        },
      ]

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          grouped: {
            subscription: subscriptionRows,
            bill_loan: [],
            needs_review: [],
            transfer: [],
            ignore: [],
          },
        }),
      })
    })

    await page.goto('/subscriptions')
    await expect(page.getByTestId('subscriptions-page')).toBeVisible()
    await expect(page.getByTestId('recurring-section-subscriptions')).toBeVisible()

    await expect(page.getByRole('heading', { name: 'Netflix - Chase' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Netflix - Citi' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Netflix - Wayfair' })).toBeVisible()
    await expect(page.locator('h3', { hasText: 'Netflix - ' })).toHaveCount(3)
  })
})
