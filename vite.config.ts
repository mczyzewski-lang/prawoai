import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

// Informacje o buildzie widoczne w aplikacji (prawy dolny róg) – pozwalają sprawdzić, czy wdrożenie jest aktualne.
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }
function gitSha(): string {
  const fromEnv = process.env.RAILWAY_GIT_COMMIT_SHA || process.env.SOURCE_COMMIT || process.env.GIT_COMMIT
  if (fromEnv) return fromEnv.slice(0, 7)
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    return 'lokalny'
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_SHA__: JSON.stringify(gitSha()),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  // /api/* obsługuje serwer z katalogu server/ (klucz OpenAI pozostaje po stronie serwera)
  server: { port: 5173, host: true, proxy: { '/api': `http://localhost:${process.env.API_PORT ?? 8787}` } },
  preview: { proxy: { '/api': `http://localhost:${process.env.API_PORT ?? 8787}` } },
  build: {
    chunkSizeWarningLimit: 1200,
  },
})
