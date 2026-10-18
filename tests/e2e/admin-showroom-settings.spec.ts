import { expect, test } from '@playwright/test'

import { createPngFixture } from '../helpers/image-fixtures'

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

const original = {
  tagline: 'Pilihan mobil berkualitas, tanpa kompromi.',
  seoTitle: 'Prima Auto Gallery — Mobil Bekas Berkualitas',
  primaryColor: '#b88a44',
  openingHours: 'Senin–Sabtu, 08.00–18.00',
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

test('admin saves showroom settings and the public site reflects them without a deployment', async ({
  page,
}) => {
  const stamp = Date.now()
  const tagline = `Tagline QA ${stamp}`
  const seoTitle = `SEO QA ${stamp}`
  const primaryColor = '#0f766e'
  const png = createPngFixture({ width: 800, height: 600, color: [20, 120, 90] })

  await page.goto('/admin/settings/showroom')
  await expect(page.getByRole('heading', { name: 'Profil showroom', exact: true })).toBeVisible()

  // Values are loaded from the tenant database row, not the legacy mock module.
  await expect(page.getByLabel('Nama showroom', { exact: true })).toHaveValue('Prima Auto Gallery')
  await expect(page.getByLabel('WhatsApp', { exact: true })).toHaveValue('6281299001122')
  await expect(page.getByLabel('Warna utama', { exact: true })).toHaveValue(original.primaryColor)

  await page.getByLabel('Tagline', { exact: true }).fill(tagline)
  await page.locator('input[name="seoTitle"]').fill(seoTitle)
  await page.getByLabel('Jam buka', { exact: true }).fill('Senin–Minggu, 08.00–21.00')
  await page.getByLabel('Warna utama', { exact: true }).fill(primaryColor)

  const fileInputs = page.locator('input[type="file"]')
  await fileInputs.nth(0).setInputFiles({
    name: 'logo.png',
    mimeType: 'image/png',
    buffer: Buffer.from(png),
  })
  await expect(page.getByText('Logo berhasil diunggah.')).toBeVisible()
  await expect(page.locator('input[name="logoUrl"]')).toHaveValue(/^\/uploads\//)

  await fileInputs.nth(1).setInputFiles({
    name: 'hero.png',
    mimeType: 'image/png',
    buffer: Buffer.from(png),
  })
  await expect(page.getByText('Gambar hero berhasil diunggah.')).toBeVisible()
  await expect(page.locator('input[name="heroImageUrl"]')).toHaveValue(/^\/uploads\//)

  await page.getByRole('button', { name: 'Simpan perubahan' }).click()
  await expect(page.getByText('Profil showroom disimpan.')).toBeVisible()

  await page.reload()
  await expect(page.getByLabel('Tagline', { exact: true })).toHaveValue(tagline)
  await expect(page.locator('input[name="seoTitle"]')).toHaveValue(seoTitle)
  await expect(page.getByLabel('Jam buka', { exact: true })).toHaveValue('Senin–Minggu, 08.00–21.00')
  await expect(page.getByLabel('Warna utama', { exact: true })).toHaveValue(primaryColor)

  await page.goto('/')
  await expect(page.getByText(tagline).first()).toBeVisible()
  await expect(page.getByText('Senin–Minggu, 08.00–21.00').first()).toBeVisible()
  await expect(page).toHaveTitle(seoTitle)
  await expect(page.locator('header img[src*="/uploads/"]').first()).toBeVisible()

  const themePrimary = await page.evaluate(() => {
    const main = document.querySelector('main')
    return main ? getComputedStyle(main).getPropertyValue('--showroom-primary').trim() : null
  })
  expect(themePrimary).toBe(primaryColor)
})
