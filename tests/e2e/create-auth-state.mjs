import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { chromium } from '@playwright/test'

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5174'
const outputPath = process.env.PLAYWRIGHT_AUTH_STATE ?? '.auth/user.json'
const email = process.env.PLAYWRIGHT_EMAIL
const password = process.env.PLAYWRIGHT_PASSWORD

function absoluteOutput(targetPath) {
  return path.isAbsolute(targetPath) ? targetPath : path.resolve(process.cwd(), targetPath)
}

async function waitForManualLogin(page) {
  console.log('')
  console.log('Manual login mode:')
  console.log('1) Complete login in the opened browser window.')
  console.log('2) Keep this command running; it will auto-detect when login finishes.')
  await page.waitForURL((url) => url.pathname !== '/login', { timeout: 300_000 })
}

async function waitForSupabaseSession(page, timeoutMs = 60_000) {
  const started = Date.now()

  while (Date.now() - started < timeoutMs) {
    const hasToken = await page.evaluate(() => {
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i)
        if (!key) continue
        if (!key.includes('auth-token')) continue
        const raw = localStorage.getItem(key)
        if (!raw) continue
        if (raw.includes('access_token')) return true
      }
      return false
    })

    if (hasToken) return
    await page.waitForTimeout(500)
  }

  throw new Error('Supabase auth token not found in localStorage. Login may not have completed.')
}

async function main() {
  const resolvedOutput = absoluteOutput(outputPath)
  fs.mkdirSync(path.dirname(resolvedOutput), { recursive: true })

  const browser = await chromium.launch({ headless: false })
  const context = await browser.newContext()
  const page = await context.newPage()

  try {
    await page.goto(`${baseURL}/login`, { waitUntil: 'domcontentloaded' })

    if (email && password) {
      await page.getByLabel('Email').fill(email)
      await page.getByLabel('Password').fill(password)
      await page.getByRole('button', { name: 'Sign In' }).click()
      await page.waitForURL((url) => url.pathname !== '/login', { timeout: 30_000 })
      await waitForSupabaseSession(page, 30_000)
    } else {
      await waitForManualLogin(page)
      await waitForSupabaseSession(page, 300_000)
    }

    await context.storageState({ path: resolvedOutput })
    console.log(`Saved Playwright auth state to: ${resolvedOutput}`)
  } finally {
    await browser.close()
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`Failed to create auth state: ${message}`)
  process.exit(1)
})
