import { expect, test } from '@playwright/test'

test.beforeEach(async ({ context }) => {
  await context.request.get('/api/dev-login?as=owner', { maxRedirects: 0 })
})

test('admin creates a vehicle, publishes it, and it appears publicly', async ({ page }) => {
  const variant = `E2E ${Date.now()}`

  await page.goto('/admin/vehicles')
  await expect(page.getByRole('heading', { name: 'Kendaraan', exact: true })).toBeVisible()

  await page.getByRole('link', { name: 'Tambah kendaraan' }).click()
  await expect(page.getByRole('heading', { name: 'Tambah kendaraan', exact: true })).toBeVisible()

  await page.getByLabel('Brand').selectOption('Toyota')
  await page.getByLabel('Model').selectOption('Fortuner')
  await page.getByLabel('Varian').fill(variant)
  await page.getByLabel('Tahun').fill('2024')
  await page.getByLabel('Warna').fill('Putih')
  await page.getByLabel('Tipe bodi').fill('SUV')
  await page.getByLabel('Harga jual (Rupiah)').fill('321000000')
  await page.getByLabel('Deskripsi').fill('Unit uji end-to-end dari panel admin untuk F007.')
  await page.getByLabel('Jarak tempuh (km)').fill('12345')
  await page.getByLabel('Pajak berlaku sampai').fill('2027-12-31')
  await page.getByLabel('Kapasitas mesin (cc)').fill('2393')
  await page.getByLabel('Plat nomor').fill('B 1234 E2E')
  await page.getByLabel('Lokasi unit').fill('Jakarta Selatan')

  await page.getByRole('button', { name: 'Simpan draft' }).click()

  await expect(page).toHaveURL(/\/admin\/vehicles$/)
  const row = page.locator('tr', { hasText: variant })
  await expect(row).toBeVisible()
  await expect(row.getByText('draft', { exact: true })).toBeVisible()

  await row.getByRole('link', { name: /Ubah/ }).click()
  await expect(page.getByRole('heading', { name: 'Edit kendaraan', exact: true })).toBeVisible()

  await page.getByLabel('Status publikasi').selectOption('published')
  await page.getByRole('button', { name: 'Publikasikan' }).click()

  await expect(page.getByText('Kendaraan dipublikasikan')).toBeVisible()

  await page.goto('/cars')
  const publicCard = page.locator('a[href^="/cars/"]', { hasText: variant }).first()
  await expect(publicCard).toBeVisible()
  await publicCard.click()

  await expect(page.getByRole('heading', { level: 1, name: 'Fortuner' })).toBeVisible()
  await expect(page.getByText(variant)).toBeVisible()
})
