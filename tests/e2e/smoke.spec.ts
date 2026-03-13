import { expect, test } from '@playwright/test'

test.use({
  storageState: { cookies: [], origins: [] },
})

test('login screen renders core controls', async ({ page }) => {
  await page.goto('/login')

  await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible()
  await expect(page.getByLabel('Email')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Magic Link' })).toBeVisible()
})

test('transactions route redirects unauthenticated users to login', async ({ page }) => {
  await page.goto('/transactions')

  await expect.poll(() => new URL(page.url()).pathname).toBe('/login')
  await expect
    .poll(() => new URL(page.url()).searchParams.get('next'))
    .toBe('/transactions')
  await expect(page.getByText('Choose your sign-in method to continue.')).toBeVisible()
})

test('recurring route redirects unauthenticated users to login', async ({ page }) => {
  await page.goto('/subscriptions')

  await expect.poll(() => new URL(page.url()).pathname).toBe('/login')
  await expect
    .poll(() => new URL(page.url()).searchParams.get('next'))
    .toBe('/subscriptions')
  await expect(page.getByText('Choose your sign-in method to continue.')).toBeVisible()
})
