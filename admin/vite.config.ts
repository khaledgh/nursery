import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  // Resolve backend target from env: BACKEND_URL, APP_URL, VITE_API_URL, or BACKEND_PORT
  let backendTarget = env.BACKEND_URL || env.APP_URL
  if (!backendTarget) {
    if (env.VITE_API_URL && env.VITE_API_URL.startsWith('http')) {
      try {
        const u = new URL(env.VITE_API_URL)
        backendTarget = u.origin
      } catch {
        // fallback
      }
    }
  }
  if (!backendTarget) {
    const port = env.BACKEND_PORT || env.APP_PORT || env.API_PORT || '8080'
    backendTarget = `http://localhost:${port}`
  }

  // Resolve Vite dev server port if configured in .env (PORT or VITE_PORT)
  const devPort = parseInt(env.PORT || env.VITE_PORT || '5173', 10)

  return {
    build: {
      outDir: '../backend/cmd/api/dist',
      emptyOutDir: true,
    },
    plugins: [react()],
    server: {
      port: isNaN(devPort) ? 5173 : devPort,
      proxy: {
        '/api': {
          target: backendTarget,
          changeOrigin: true,
        },
      },
    },
  }
})
