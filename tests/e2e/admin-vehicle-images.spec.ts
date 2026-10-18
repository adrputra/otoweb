import { expect, test } from '@playwright/test'

import { createHighResolutionImages } from '../helpers/image-fixtures'

// Mirrors the fake GoTrue session cookie contract used by the admin e2e suite.
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
    name: 'sb-127-auth-token',
    value: `base64-${Buffer.from(JSON.stringify(session)).toString('base64url')}`,
    domain: host,
    path: '/',
    httpOnly: true,
    sameSite: 'Lax' as const,
  }
}

test.beforeEach(async ({ context, baseURL }) => {
  await context.addCookies([sessionCookie(new URL(baseURL as string).hostname)])
})

test('admin uploads 15 photos, persists order and cover, and deletes media', async ({
  page,
}) => {
  test.setTimeout(300_000)

  const variant = `Foto ${Date.now()}`

  await page.goto('/admin/vehicles/new')
  await page.waitForLoadState('networkidle', { timeout: 120_000 })
  await expect(page.getByRole('heading', { name: 'Tambah kendaraan', exact: true })).toBeVisible()

  await page.getByLabel('Brand').selectOption('Toyota')
  await expect(page.getByLabel('Model')).toBeEnabled({ timeout: 30_000 })
  await page.getByLabel('Model').selectOption('Fortuner')
  await page.getByLabel('Varian').fill(variant)
  await page.getByLabel('Tahun').fill('2024')
  await page.getByLabel('Warna').fill('Putih')
  await page.getByLabel('Tipe bodi').fill('SUV')
  await page.getByLabel('Harga jual (Rupiah)').fill('321000000')
  await page
    .getByLabel('Deskripsi')
    .fill('Unit uji end-to-end pengelolaan foto dari panel admin untuk F008.')
  await page.getByLabel('Jarak tempuh (km)').fill('12345')
  await page.getByLabel('Pajak berlaku sampai').fill('2027-12-31')
  await page.getByLabel('Kapasitas mesin (cc)').fill('2393')
  await page.getByLabel('Plat nomor').fill('B 1234 FTS')
  await page.getByLabel('Lokasi unit').fill('Jakarta Selatan')

  await page.getByRole('button', { name: 'Simpan draft' }).click()
  await expect(page).toHaveURL(/\/admin\/vehicles$/)

  const row = page.locator('tr', { hasText: variant })
  await expect(row).toBeVisible()
  await row.getByRole('link', { name: /Ubah/ }).click()
  await expect(page.getByRole('heading', { name: 'Edit kendaraan', exact: true })).toBeVisible()

  const files = createHighResolutionImages(15, { width: 2400, height: 1600 }).map(
    (bytes, index) => ({
      name: `foto-${index + 1}.png`,
      mimeType: 'image/png',
      buffer: Buffer.from(bytes),
    }),
  )

  await page.locator('input[type="file"]').first().setInputFiles(files)

  await expect(page.getByTestId('photo-count')).toContainText('15/20 foto', {
    timeout: 60_000,
  })
  await expect(page.locator('[data-testid="vehicle-photo"] img[src^="/uploads/"]')).toHaveCount(
    15,
    { timeout: 180_000 },
  )
  await expect(page.locator('[role="progressbar"]')).toHaveCount(0, { timeout: 120_000 })

  const photos = page.getByTestId('vehicle-photo')
  await expect(photos.first()).toHaveAttribute('data-cover', 'true')
  await expect(photos.first()).toHaveAttribute('data-alt', 'foto 1')

  // Move the first photo down one position; the order must persist on reload.
  await page.getByRole('button', { name: 'Turunkan foto 1', exact: true }).click()
  await expect(photos.first()).toHaveAttribute('data-alt', 'foto 2')

  // Choose the third photo as the cover.
  await photos.nth(2).getByRole('button', { name: 'Jadikan cover' }).click()
  await expect(photos.nth(2)).toHaveAttribute('data-cover', 'true')
  await expect(page.locator('[data-testid="vehicle-photo"][data-cover="true"]')).toHaveCount(1)

  await page.reload()
  await expect(page.locator('[data-testid="vehicle-photo"] img[src^="/uploads/"]')).toHaveCount(
    15,
    { timeout: 60_000 },
  )
  const reloaded = page.getByTestId('vehicle-photo')
  await expect(reloaded.first()).toHaveAttribute('data-alt', 'foto 2')
  await expect(reloaded.nth(2)).toHaveAttribute('data-cover', 'true')

  // Delete the fourth photo; positions compact and the cover stays put.
  await page.getByRole('button', { name: 'Hapus foto 4', exact: true }).click()
  await expect(page.getByTestId('photo-count')).toContainText('14/20 foto', {
    timeout: 30_000,
  })
  await expect(page.locator('[data-testid="vehicle-photo"][data-cover="true"]')).toHaveCount(1)

  // The vehicle delete path must remove the vehicle and its media rows.
  await page.goto('/admin/vehicles')
  const listRow = page.locator('tr', { hasText: variant })
  await expect(listRow).toBeVisible()
  page.once('dialog', (dialog) => dialog.accept())
  await listRow.getByRole('button', { name: /Hapus/ }).click()
  await expect(listRow).toHaveCount(0)
})
