import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // /api/* obsługuje serwer z katalogu server/ (klucz OpenAI pozostaje po stronie serwera)
  server: { port: 5173, host: true, proxy: { '/api': `http://localhost:${process.env.API_PORT ?? 8787}` } },
  preview: { proxy: { '/api': `http://localhost:${process.env.API_PORT ?? 8787}` } },
  build: {
    chunkSizeWarningLimit: 1200,
  },
})
