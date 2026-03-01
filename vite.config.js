import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  build: {
    chunkSizeWarningLimit: 650,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/@supabase')) return 'supabase-vendor'
          if (id.includes('node_modules/lucide-react')) return 'icons-vendor'
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) return 'react-vendor'
          return undefined
        },
      },
    },
  },
})
