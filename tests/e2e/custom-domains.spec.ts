import http from 'node:http'

import { expect, test, type BrowserContext } from '@playwright/test'

const APP_PORT = Number(process.env.PLATFORM_APP_PORT ?? 3003)
const PRIMA_TENANT_ID = '11111111-1111-4111-8111-111111111111'

async function signIn(context: BrowserContext) {
  await context.request.get('/api/dev-login?as=operator', { maxRedirects: 0 })
}

interface RawResponse {
  status: number
  body: string
}

/** Fetch through the real Next server with an explicit Host header. */
function fetchRaw(host: string, path = '/'): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        hostname: '127.0.0.1',
        port: APP_PORT,
        path,
        method: 'GET',
        headers: { host: `${host}:${APP_PORT}` },
      },
      (response) => {
        let body = ''
        response.setEncoding('utf8')
        response.on('data', (chunk: string) => {
          body += chunk
        })
        response.on('end', () => {
          resolve({ status: response.statusCode ?? 0, body })
        })
      },
    )

    request.on('error', reject)
    request.end()
  })
}

test('operator registers, verifies, and routes a custom domain with platform fallback', async ({
  context,
  page,
}) => {
  await signIn(context)
  await page.goto(`/platform/tenants/${PRIMA_TENANT_ID}`)
  await page.waitForLoadState('networkidle')

  await expect(page.getByRole('heading', { name: 'Domain kustom', exact: true })).toBeVisible()

  await page.getByLabel('Domain kustom').fill('showroom.prima.test')
  await page.getByRole('button', { name: 'Daftarkan domain' }).click()

  await expect(page.getByText('showroom.prima.test').first()).toBeVisible()
  await expect(page.getByText('Menunggu verifikasi').first()).toBeVisible()
  await expect(page.getByText('_otoweb-verify.showroom.prima.test')).toBeVisible()
  await expect(page.getByText('otoweb-verify=', { exact: false })).toBeVisible()

  await page.getByRole('button', { name: 'Verifikasi DNS showroom.prima.test' }).click()
  await expect(page.getByText('Terverifikasi').first()).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText('SSL aktif').first()).toBeVisible()

  const custom = await fetchRaw('showroom.prima.test')
  expect(custom.status).toBe(200)
  expect(custom.body).toContain('Prima Auto Gallery')
  expect(custom.body).not.toContain('Tenant B Test Showroom')

  const platform = await fetchRaw('prima.otoweb.id')
  expect(platform.status).toBe(200)
  expect(platform.body).toContain('Prima Auto Gallery')
  expect(platform.body).not.toContain('Tenant B Test Showroom')

  const wildcard = await fetchRaw('prima-auto-gallery.otoweb.id')
  expect(wildcard.status).toBe(200)
  expect(wildcard.body).toContain('Prima Auto Gallery')
})

test('a pending custom domain fails closed while the platform subdomain still serves', async ({
  context,
  page,
}) => {
  await signIn(context)
  await page.goto(`/platform/tenants/${PRIMA_TENANT_ID}`)
  await page.waitForLoadState('networkidle')

  await page.getByLabel('Domain kustom').fill('pending.prima.test')
  await page.getByRole('button', { name: 'Daftarkan domain' }).click()
  await expect(page.getByText('pending.prima.test').first()).toBeVisible()
  await expect(page.getByText('Menunggu verifikasi').first()).toBeVisible()

  const pending = await fetchRaw('pending.prima.test')
  expect(pending.status).toBe(404)
  expect(pending.body).not.toContain('Prima Auto Gallery')

  const platform = await fetchRaw('prima.otoweb.id')
  expect(platform.status).toBe(200)
  expect(platform.body).toContain('Prima Auto Gallery')
})
