// Disaster-Resource-Optimizer-AI/frontend/vite.config.js

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],

  // THIS IS THE CRITICAL BLOCK YOU ARE ADDING
  server: {
    proxy: {
      // This tells Vite: "If you see any request to '/api',
      // send it to the backend server at port 8000."
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      }
    }
  }
})