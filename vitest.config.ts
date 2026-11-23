import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Dedicated Vitest config, intentionally standalone (Vitest prefers this file
// over vite.config.ts, so the app build config is never loaded for unit tests).
//
// Two reasons it exists:
//   1. vite.config.ts is built for the Cloudflare Worker / rolldown-vite
//      toolchain (@cloudflare/vite-plugin, generouted, vite-plugin-checker).
//      Vitest cannot load those plugins, and they are irrelevant to unit tests.
//   2. Vitest's default `include` would sweep up the Playwright specs in
//      tests/*.spec.ts and fail. Explicit unit-test paths keep the runners
//      separate; Playwright runs via `npm test` / tests/playwright.config.ts.
//
// Unit tests live next to their source. The Node-only prerender test stays at
// the root so it does not enter the browser/Worker TypeScript project in src/.
export default defineConfig({
  // Unit tests run offline, including on a fresh checkout before registration.
  // No real identity is needed to render a rehearsal or test local geometry.
  // The actual Worker build still obtains its required ID from the SDK plugin.
  define: { __DEEPSPACE_APP_ID__: JSON.stringify('') },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    // Unit tests only; tests/*.spec.ts are Playwright suites run separately.
    include: ['prerender.test.ts', 'src/**/*.{test,spec}.{ts,tsx}'],
    environment: 'node',
  },
})
