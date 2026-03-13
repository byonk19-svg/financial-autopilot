import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: [
      'apps/web/src/**/*.test.ts',
      'apps/web/src/**/*.test.tsx',
      'apps/web/src/**/*.spec.ts',
      'apps/web/src/**/*.spec.tsx',
      'supabase/functions/**/*.test.ts',
      'supabase/functions/**/*.spec.ts',
    ],
    exclude: ['**/node_modules/**', '**/dist/**', 'tests/e2e/**'],
  },
})
