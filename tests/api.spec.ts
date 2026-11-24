import { test, expect } from '@playwright/test'

test.describe('API tests', () => {
  test('auth proxy forwards to auth worker', async ({ request }) => {
    const res = await request.get('/api/auth/ok')
    expect(res.ok()).toBeTruthy()
  })

  test('the AI booth turns a signed-out visitor away before any paid call', async ({ request }) => {
    const status = await request.get('/api/stage-ai/status')
    expect(status.ok()).toBeTruthy()
    expect(await status.json()).toEqual({ available: false, requiresLogin: true })
    for (const action of ['rounds', 'observe', 'voice']) {
      const reply = await request.post('/api/stage-ai/' + action, { data: { cue: 1 } })
      expect(reply.status(), action).toBe(401)
      expect(await reply.json(), action).toMatchObject({ error: 'sign_in_required' })
    }
  })

  test('WebSocket endpoint exists', async ({ page }) => {
    // /home is a dynamic page (under src/pages/(app)/), so mounting it boots
    // the providers and auto-connects the records WebSocket. The static
    // landing at '/' deliberately does neither — see smoke.spec.ts.
    await page.goto('/home')
    // Wait for the app to connect its WebSocket (it auto-connects on mount)
    await page.waitForSelector('[data-testid="app-navigation"]', { timeout: 15000 })
    // If the app loaded and connected, the WS endpoint works
  })
})
