import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],

  // 1. ADD THIS NEW SERVER BLOCK HERE:
  server: {
    allowedHosts: [
      'dentor.tech',
      'www.dentor.tech'
    ]
  },

  // 2. LEAVE YOUR EXISTING TEST BLOCK ALONE:
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})