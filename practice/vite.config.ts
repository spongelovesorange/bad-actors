import { fileURLToPath } from 'node:url'
import { localAudiencePlugin } from '../scripts/local-ai-api'
import { privateProfilePaths } from '../scripts/local-ai-provider'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const project = fileURLToPath(new URL('../', import.meta.url))

const publicDir = fileURLToPath(new URL('../public/', import.meta.url))
const profiles = privateProfilePaths(process.env.BAD_ACTORS_AI_PROFILE, publicDir)

// Paid calls are opt-in and run only in the loopback development server.
export default defineConfig({
  root: fileURLToPath(new URL('./', import.meta.url)),
  publicDir,
  plugins: [react(), localAudiencePlugin(project, profiles[0])],
  server: {
    host: '127.0.0.1', port: 5173, strictPort: true, cors: false,
    fs: {
      allow: [project],
      deny: ['**/.env*', '**/*.pem', '**/*.crt', '**/.git/**', '**/.deepspace/**', '**/.local/**', '**/.dev.vars*', ...profiles],
    },
  },
})
