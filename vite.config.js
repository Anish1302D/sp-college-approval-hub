import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: false,
    // In development the API runs separately on port 4000. Proxying it here
    // means the browser sees one origin, exactly as it will behind IIS or
    // nginx in production, so no CORS configuration is involved.
    proxy: {
      '/api': 'http://localhost:4000',
      '/health': 'http://localhost:4000',
    },
  },
})
