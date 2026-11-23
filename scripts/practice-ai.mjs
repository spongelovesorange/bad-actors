import { fileURLToPath } from 'node:url'

// Opt in to a server-only profile. Keep Vite's normal CLI, signals and flags.
process.env.BAD_ACTORS_AI_PROFILE ||= fileURLToPath(new URL('../../planb-meet-qs26/.deepspace/.env.mg1-local', import.meta.url))
const cli = new URL('../node_modules/vite/bin/vite.js', import.meta.url)
const config = fileURLToPath(new URL('../practice/vite.config.ts', import.meta.url))
process.argv.splice(1, 1, fileURLToPath(cli), '--config', config)
await import(cli.href)
