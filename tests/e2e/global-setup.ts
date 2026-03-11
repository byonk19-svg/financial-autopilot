import fs from 'node:fs'
import path from 'node:path'
import { chromium, expect, type FullConfig } from '@playwright/test'

function resolveStatePath(target: string): string {
  return path.isAbsolute(target) ? target : path.resolve(process.cwd(), target)
}

async function hasSupabaseToken(page: import('@playwright/test').Page): Promise<boolean> {
  return page.evaluate(() => {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i)
      if (!key || !key.includes('auth-token')) continue
      const raw = localStorage.getItem(key)
      if (!raw) continue
      if (raw.includes('access_token')) return true
    }
    return false
  })
}

export default async function globalSetup(config: FullConfig): Promise<void> {
  const email = process.env.PLAYWRIGHT_EMAIL
  const password = process.env.PLAYWRIGHT_PASSWORD
  if (!email || !password) return

  const authStatePath = process.env.PLAYWRIGHT_AUTH_STATE ?? '.auth/user.json'
  const resolvedStatePath = resolveStatePath(authStatePath)
  fs.mkdirSync(path.dirname(resolvedStatePath), { recursive: true })
  if (fs.existsSync(resolvedStatePath)) {
    fs.rmSync(resolvedStatePath, { force: true })
  }

  const baseURL = config.projects[0]?.use?.baseURL?.toString() ?? 'http://127.0.0.1:5174'
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext()
  const page = await context.newPage()

  try {
    try {
      await page.goto(`${baseURL}/login`, { waitUntil: 'domcontentloaded' })
      await page.getByLabel('Email').fill(email)
      await page.getByLabel('Password').fill(password)
      await page.getByRole('button', { name: 'Sign In' }).click()

      await expect
        .poll(() => new URL(page.url()).pathname, { timeout: 30_000 })
        .not.toBe('/login')

      await expect
        .poll(async () => hasSupabaseToken(page), { timeout: 30_000 })
        .toBe(true)

      await context.storageState({ path: resolvedStatePath })
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      console.warn(`Playwright global setup could not establish auth session: ${detail}`)
      if (fs.existsSync(resolvedStatePath)) {
        fs.rmSync(resolvedStatePath, { force: true })
      }
    }
  } finally {
    await browser.close()
  }
}
