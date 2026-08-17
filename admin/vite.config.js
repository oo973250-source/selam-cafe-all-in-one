import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The admin UI is served at /admin in production (same origin as everything else).
// In dev, it runs on port 5174 and proxies API calls to :3000 (the all-in-one server).
export default defineConfig({
  plugins: [react()],
  base: '/admin/',
  server: {
    port: 5174,
    proxy: {
      '/api': 'http://localhost:3000',
      '/socket.io': { target: 'http://localhost:3000', ws: true },
    },
  },
  build: {
    outDir: 'dist',
  },
})
