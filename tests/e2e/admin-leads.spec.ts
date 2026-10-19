import { expect, test } from '@playwright/test'

test.beforeEach(async ({ context }) => {
  await context.request.get('/api/dev-login?as=owner', { maxRedirects: 0 })
})

test('a public contact inquiry becomes a tenant lead with an updatable status', async ({
  page,
}) => {
  const stamp = Date.now()
  const name = `QA Lead ${stamp}`
  const phone = '0812 9900 7788'
  const message = `Saya tertarik dengan unit QA ${stamp}.`

  await page.goto('/')
  await page.getByLabel('Nama', { exact: true }).fill(name)
  await page.getByLabel('Nomor telepon', { exact: true }).fill(phone)
  await page.getByLabel('Email (opsional)', { exact: true }).fill('qa@example.com')
  await page.getByLabel('Pesan', { exact: true }).fill(message)
  await page.getByRole('button', { name: 'Kirim pesan' }).click()

  await expect(page.getByRole('status')).toContainText('Pesan Anda terkirim.')

  await page.goto('/admin/leads')
  await expect(page.getByRole('heading', { name: 'Leads', exact: true })).toBeVisible()

  const row = page.locator('tr', { hasText: name })
  await expect(row).toBeVisible()
  await expect(row).toContainText(message)
  await expect(row).toContainText(phone)
  await expect(row).toContainText('Formulir kontak')

  const status = row.getByLabel(`Status ${name}`)
  await expect(status).toHaveValue('new')
  await status.selectOption('contacted')
  await expect(page.getByText(`Status ${name} diperbarui.`)).toBeVisible()

  await page.reload()
  await expect(
    page.locator('tr', { hasText: name }).getByLabel(`Status ${name}`),
  ).toHaveValue('contacted')

  await page.goto('/admin')
  await expect(page.getByText(name).first()).toBeVisible()
})

test('a WhatsApp activation records a lead before redirecting to the showroom number', async ({
  page,
  request,
  baseURL,
}) => {
  await page.goto('/admin/leads')
  const totalBefore = Number(await page.getByTestId('lead-stat-total').innerText())

  // The API request context does not inherit Chromium host-resolver rules.
  // Development resolves the configured showroom slug for a local hostname.
  const localUrl = new URL('/api/public/whatsapp?vehicle=toyota-fortuner-2021-1', baseURL!)
  localUrl.hostname = '127.0.0.1'
  const response = await request.get(localUrl.toString(), { maxRedirects: 0 })

  expect(response.status()).toBe(307)
  expect(response.headers()['location']).toContain('https://wa.me/6281299001122')

  await page.reload()
  await expect(page.getByTestId('lead-stat-total')).toHaveText(String(totalBefore + 1))
  await expect(
    page
      .locator('tbody tr', { hasText: 'Tanpa nama' })
      .filter({ hasText: 'Toyota Fortuner' })
      .first(),
  ).toBeVisible()
})
