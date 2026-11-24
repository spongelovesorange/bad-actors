import { defineConfig } from '@playwright/test'
import { chromiumLaunchOptions } from 'deepspace/testing'

/**
 * The stage specs play the rehearsal on the loopback practice server, where the AI booth answers at
 * /api/local-ai/* and every spec scripts those replies. The main config serves the hosted app, whose
 * public page sends a player to /room to sign in, so a game never starts there without an account.
 *
 *   npm run test:stage
 */
const PORT = Number(process.env.STAGE_TEST_PORT ?? 5183)
const BASE_URL = `http://127.0.0.1:${PORT}`

export default defineConfig({
  testDir: '.',
  testMatch: /(ai-audience|puppet.*|fly-cue|theater-sightlines)\.spec\.ts$/,
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: BASE_URL,
    storageState: { cookies: [], origins: [{ origin: BASE_URL, localStorage: [{ name: 'bad-actors:handbook:skip', value: '1' }] }] },
    headless: true,
    launchOptions: chromiumLaunchOptions(),
  },
  webServer: {
    // No private AI profile: the specs script every model reply, so nothing here can bill a call.
    command: `env -u BAD_ACTORS_AI_PROFILE npx vite --config practice/vite.config.ts --port ${PORT} --strictPort --host 127.0.0.1`,
    cwd: '..',
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 60_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
})
