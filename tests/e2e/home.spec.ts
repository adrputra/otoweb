import { expect, test } from '@playwright/test'

test('public homepage renders showroom content and collection navigation', async ({ page }) => {
  await page.goto('/')

  await expect(page).toHaveTitle(/Prima Auto Gallery/)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Koleksi mobil' }).first()).toBeVisible()
  await expect(page.getByRole('link', { name: 'Lihat semua', exact: true })).toBeVisible()
})
