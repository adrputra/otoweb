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
