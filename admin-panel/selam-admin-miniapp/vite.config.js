import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Mounted at a subpath of the existing site → relative asset paths (per RULES #6)
export default defineConfig({
  plugins: [react()],
  base: './',
  // Inline empty PostCSS config — stops Vite resolving the parent project's postcss.config.mjs
  css: { postcss: { plugins: [] } },
})
