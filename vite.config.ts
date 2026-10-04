import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { portfolioSEO } from './scripts/seo.ts'

export default defineConfig(({ mode }) => ({
  plugins: [react(), portfolioSEO(loadEnv(mode, '.', 'VITE_'))],
  server: {
    proxy: { '/api': 'http://127.0.0.1:8080' },
  },
}))
