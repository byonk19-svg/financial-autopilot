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

    const initialTransactionsRequest = page.waitForRequest(
      (request) =>
        request.method() === 'GET' &&
        request.url().includes('/rest/v1/transactions') &&
        request.url().includes('is_pending=eq.false'),
      { timeout: 20_000 },
    )

    await page.goto('/transactions')
    await expect(page.getByTestId('transactions-page')).toBeVisible()
    await initialTransactionsRequest

    const showPendingToggle = page.getByLabel('Show pending')
    await expect(showPendingToggle).not.toBeChecked()

    await Promise.all([
      page.waitForRequest(
        (request) =>
          request.method() === 'GET' &&
          request.url().includes('/rest/v1/transactions') &&
          !request.url().includes('is_pending=eq.false'),
        { timeout: 20_000 },
      ),
      showPendingToggle.check(),
    ])
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

  test('friendly search matches split recurring merchant labels', async ({ page }) => {
    await ensureSignedIn(page)

    await page.route('**/functions/v1/recurring', async (route) => {
      if (route.request().method() !== 'GET') {
        await route.continue()
        return
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          grouped: {
            subscription: [
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
            ],
            bill_loan: [],
            needs_review: [],
            transfer: [],
            ignore: [],
          },
        }),
      })
    })

    await page.goto('/subscriptions')
    await expect(page.getByRole('heading', { name: 'Netflix - Chase' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Netflix - Citi' })).toBeVisible()

    await page.getByLabel('Search recurring merchants').fill('Netflix - Citi')

    await expect(page.getByRole('heading', { name: 'Netflix - Citi' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Netflix - Chase' })).toHaveCount(0)
  })

  test('no-match state explains filters and recovers with clear filters', async ({ page }) => {
    await ensureSignedIn(page)

    await page.route('**/functions/v1/recurring', async (route) => {
      if (route.request().method() !== 'GET') {
        await route.continue()
        return
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          grouped: {
            subscription: [
              {
                id: 'mock-hulu',
                merchant_normalized: 'HULU',
                cadence: 'monthly',
                classification: 'subscription',
                is_false_positive: false,
                user_locked: true,
                notify_days_before: 3,
                last_amount: 14.99,
                prev_amount: 14.99,
                next_expected_at: '2026-04-09',
                confidence: 0.99,
                is_active: true,
                primary_payer: 'household',
              },
            ],
            bill_loan: [],
            needs_review: [],
            transfer: [],
            ignore: [],
          },
        }),
      })
    })

    await page.goto('/subscriptions')
    await expect(page.getByRole('heading', { name: 'Hulu' })).toBeVisible()

    await page.getByRole('button', { name: 'Price increase only' }).click()

    await expect(page.getByText('No matches')).toBeVisible()
    await expect(
      page.getByText('No recurring charges match your current search and filters.'),
    ).toBeVisible()

    await page.getByRole('button', { name: 'Clear filters' }).click()
    await expect(page.getByRole('heading', { name: 'Hulu' })).toBeVisible()
  })

  test('rules run button reflects in-flight analysis state', async ({ page }) => {
    await ensureSignedIn(page)

    await page.route('**/functions/v1/analysis-daily', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.continue()
        return
      }

      await page.waitForTimeout(450)
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          request_id: 'mock-analysis-request-id',
          users_processed: 1,
          subscriptions_upserted: 5,
          alerts_inserted: 0,
        }),
      })
    })

    await page.goto('/rules')
    const runButton = page.getByRole('button', { name: 'Run analysis now' })
    await runButton.click()

    await expect(page.getByRole('button', { name: 'Running...' })).toBeDisabled()
    await expect(page.getByText('Analysis run completed.')).toBeVisible()
    await expect(page.getByText('Request ID: mock-analysis-request-id')).toBeVisible()
  })
})
