import { expect, test } from '@playwright/test'

test.beforeEach(async ({ context }) => {
  await context.request.get('/api/dev-login?as=owner', { maxRedirects: 0 })
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
