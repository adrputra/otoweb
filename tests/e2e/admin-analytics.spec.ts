import { expect, test } from '@playwright/test'

// Mirrors `sb-${new URL(authUrl).hostname.split('.')[0]}-auth-token`.
const AUTH_COOKIE_PREFIX = '127'

const user = {
  id: '50000000-0000-4000-8000-000000000001',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'owner@primaauto.test',
  email_confirmed_at: '2026-10-18T00:00:00.000Z',
  phone: '',
  confirmed_at: '2026-10-18T00:00:00.000Z',
  last_sign_in_at: '2026-10-18T00:00:00.000Z',
  app_metadata: { provider: 'email', providers: ['email'] },
  user_metadata: { full_name: 'Aditya Pranata' },
  identities: [],
  created_at: '2026-10-18T00:00:00.000Z',
  updated_at: '2026-10-18T00:00:00.000Z',
}

function sessionCookie(host: string) {
  const session = {
    access_token: 'fake-access-token',
    refresh_token: 'fake-refresh-token',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user,
  }

  return {
    name: `sb-${AUTH_COOKIE_PREFIX}-auth-token`,
    value: `base64-${Buffer.from(JSON.stringify(session)).toString('base64url')}`,
    domain: host,
    path: '/',
    httpOnly: true,
    sameSite: 'Lax' as const,
  }
}

test.beforeEach(async ({ context, baseURL }) => {
  const host = new URL(baseURL!).hostname
  await context.addCookies([sessionCookie(host)])
})

test('the admin dashboard shows tenant analytics after a vehicle view', async ({ page }) => {
  await page.goto('/cars/toyota-fortuner-2021-1', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: 'Fortuner', exact: true })).toBeVisible()

  // The page tracker sends a beacon after hydration. Send one same-origin event
  // explicitly as well so the assertion does not depend on beacon timing.
  await page.evaluate(async () => {
    await fetch('/api/public/analytics', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        event: 'vehicle_view',
        vehicleSlug: 'toyota-fortuner-2021-1',
        path: '/cars/toyota-fortuner-2021-1',
      }),
    })
  })

  await page.goto('/admin')
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Analitik', exact: true })).toBeVisible()

  const views = page.getByTestId('analytics-vehicle-views')
  await expect(views).toBeVisible()
  await expect
    .poll(async () => Number(await views.innerText()), { timeout: 10_000 })
    .toBeGreaterThan(0)

  await expect(page.getByTestId('analytics-whatsapp-clicks')).toContainText(/\d+/)
  await expect(page.getByTestId('analytics-new-leads')).toContainText(/\d+/)
  await expect(page.getByTestId('analytics-conversion')).toContainText('%')
  await expect(page.getByTestId('analytics-most-viewed')).toContainText('Fortuner')
})
