import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/Words_PWA/',
  plugins: [react()],
  server: {
    port: 3000
  }
})
