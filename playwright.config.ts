import { defineConfig } from '@playwright/test'
import fs from 'node:fs'

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5174'
const authStatePath = process.env.PLAYWRIGHT_AUTH_STATE ?? '.auth/user.json'
const hasPasswordAuth = Boolean(process.env.PLAYWRIGHT_EMAIL && process.env.PLAYWRIGHT_PASSWORD)
const storageState = fs.existsSync(authStatePath) || hasPasswordAuth ? authStatePath : undefined

export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  timeout: 30_000,
  expect: {
    timeout: 7_500,
  },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
    storageState,
  },
  webServer: process.env.PLAYWRIGHT_SKIP_WEBSERVER
    ? undefined
    : {
        command: 'npm --workspace apps/web run dev -- --host 127.0.0.1 --port 5174',
        url: baseURL,
        reuseExistingServer: true,
        timeout: 120_000,
        env: {
          ...process.env,
          VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL ?? 'https://example.supabase.co',
          VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY ?? 'test-anon-key',
          VITE_FUNCTIONS_URL:
            process.env.VITE_FUNCTIONS_URL ?? 'https://example.supabase.co/functions/v1',
          VITE_ENABLE_RERUN_DETECTION: process.env.VITE_ENABLE_RERUN_DETECTION ?? 'true',
        },
      },
})
