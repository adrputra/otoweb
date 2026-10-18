import { expect, test } from '@playwright/test'

test('public homepage renders database-backed Prima content', async ({ page }) => {
  await page.goto('/')

  await expect(page).toHaveTitle(/Prima Auto Gallery/)
  await expect(page.getByRole('heading', { level: 1, name: 'Prima Auto Gallery' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Koleksi mobil' }).first()).toBeVisible()
  await expect(page.getByRole('link', { name: 'Lihat semua', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Unit unggulan kami' })).toBeVisible()
  await expect(page.getByText('Fortuner', { exact: false }).first()).toBeVisible()
  await expect(page.getByText('Tenant B Test Showroom', { exact: false })).toHaveCount(0)
})

test('inventory filters and sorts database-backed vehicles', async ({ page }) => {
  await page.goto('/cars?brand=Honda&transmission=AT&maxPrice=350000000&sort=harga-terendah')

  await expect(page.getByRole('heading', { name: 'Koleksi mobil' })).toBeVisible()
  await expect(page.getByText('Brio', { exact: false })).toBeVisible()
  await expect(page.getByText('Fortuner', { exact: false })).toHaveCount(0)
  await expect(page.getByText('1 unit', { exact: true })).toBeVisible()
  await expect(page.locator('select[name="brand"]')).toHaveValue('Honda')
  await expect(page.locator('select[name="sort"]')).toHaveValue('harga-terendah')
})

test('inventory shows the empty state when no unit matches', async ({ page }) => {
  await page.goto('/cars?brand=Honda&maxPrice=1')

  await expect(page.getByRole('heading', { name: 'Belum ada unit yang sesuai' })).toBeVisible()
  await expect(page.getByText('0 unit', { exact: true })).toBeVisible()
})

test('inventory sorts by lowest price', async ({ page }) => {
  await page.goto('/cars?sort=harga-terendah')

  const firstVehicle = page.locator('a[href^="/cars/"]').first()
  await expect(firstVehicle).toHaveAttribute('href', '/cars/honda-brio-2023-8')
})
