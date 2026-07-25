import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

// Check if HTTPS certificates exist
const certPath = path.resolve(__dirname, 'certs/localhost.pem')
const keyPath = path.resolve(__dirname, 'certs/localhost-key.pem')
const httpsEnabled = fs.existsSync(certPath) && fs.existsSync(keyPath)

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // Allow access from local network
    port: 3000,
    // Enable HTTPS if certificates exist
    ...(httpsEnabled && {
      https: {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath),
      }
    })
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: undefined
      }
    }
  }
})
