import { expect, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const EMAIL = process.env.PLAYWRIGHT_EMAIL
const PASSWORD = process.env.PLAYWRIGHT_PASSWORD
const AUTH_STATE_PATH = process.env.PLAYWRIGHT_AUTH_STATE ?? '.auth/user.json'

export function hasPasswordAuthEnv(): boolean {
  return Boolean(EMAIL && PASSWORD)
}

export function hasAuthStateFile(): boolean {
  const resolved = path.isAbsolute(AUTH_STATE_PATH)
    ? AUTH_STATE_PATH
    : path.resolve(process.cwd(), AUTH_STATE_PATH)
  return fs.existsSync(resolved)
}

export function hasAuthSetup(): boolean {
  return hasAuthStateFile() || hasPasswordAuthEnv()
}

export async function ensureSignedIn(page: Page): Promise<void> {
  await page.goto('/overview')

  const isLogin = new URL(page.url()).pathname === '/login'
  if (!isLogin) return

  if (!EMAIL || !PASSWORD) {
    throw new Error(
      'Not authenticated. Set PLAYWRIGHT_EMAIL and PLAYWRIGHT_PASSWORD (or provide PLAYWRIGHT_AUTH_STATE).',
    )
  }

  await page.getByLabel('Email').fill(EMAIL)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign In' }).click()

  await expect
    .poll(() => new URL(page.url()).pathname, { timeout: 30_000 })
    .not.toBe('/login')
}
