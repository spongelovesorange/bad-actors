import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const project = fileURLToPath(new URL('../', import.meta.url))

// This entry mounts the same public stage without starting a Worker or a session.
export default defineConfig({
  root: fileURLToPath(new URL('./', import.meta.url)),
  publicDir: fileURLToPath(new URL('../public/', import.meta.url)),
  plugins: [react()],
  server: { host: '127.0.0.1', port: 5173, strictPort: true, fs: { allow: [project] } },
})
