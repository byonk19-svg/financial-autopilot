import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '')
  const supabaseUrl = env.VITE_SUPABASE_URL

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: supabaseUrl
      ? {
          proxy: {
            '/functions/v1': {
              target: supabaseUrl,
              changeOrigin: true,
            },
          },
        }
      : undefined,
  }
})
