import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/upload': {
        target: 'http://localhost:5050',
        changeOrigin: true,
      },
      '/ask': {
        target: 'http://localhost:5050',
        changeOrigin: true,
      },
    },
  },
})
