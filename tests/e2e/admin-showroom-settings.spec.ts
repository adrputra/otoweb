import { expect, test } from '@playwright/test'

import { createPngFixture } from '../helpers/image-fixtures'

const original = {
  tagline: 'Pilihan mobil berkualitas, tanpa kompromi.',
  seoTitle: 'Prima Auto Gallery — Mobil Bekas Berkualitas',
  primaryColor: '#b88a44',
  openingHours: 'Senin–Sabtu, 08.00–18.00',
}

test.beforeEach(async ({ context }) => {
  await context.request.get('/api/dev-login?as=owner', { maxRedirects: 0 })
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
