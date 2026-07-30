import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/bluebell-app/',
  server: {
    // Fix: allow page refresh on any route (SPA fallback)
    historyApiFallback: true,
  },
  appType: 'spa',
})
