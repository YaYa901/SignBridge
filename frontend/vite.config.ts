import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // The browser always calls the relative path /api; Vite forwards it to the FastAPI server.
  // 127.0.0.1 (not "localhost") avoids IPv6 mismatches on Node 17+.
  const proxy = { '/api': { target: env.API_PROXY_TARGET || 'http://127.0.0.1:8000', changeOrigin: true } }
  return {
    plugins: [react(), tailwindcss()],
    server: { port: 5173, proxy: {...proxy, '/media': {target: env.API_PROXY_TARGET || 'http://127.0.0.1:8000',changeOrigin:true}} },
    preview: { port: 4173, proxy: {...proxy, '/media': {target: env.API_PROXY_TARGET || 'http://127.0.0.1:8000',changeOrigin:true}} },
  }
})
