import http from 'node:http'

import { expect, test } from '@playwright/test'

const PORT = Number(process.env.AUTH_TEST_PORT ?? 3000)

/** Fetch with an explicit Host header so the test does not depend on host DNS. */
function statusFor(path: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        hostname: '127.0.0.1',
        port: PORT,
        path,
        method: 'GET',
        headers: { host: `prima.otoweb.id:${PORT}` },
      },
      (response) => {
        response.resume()
        response.on('end', () => resolve(response.statusCode ?? 0))
      },
    )
    request.on('error', reject)
    request.end()
  })
}


test('unauthenticated admin access redirects to sign-in', async ({ page }) => {
  await page.goto('/admin')

  const url = new URL(page.url())
  expect(url.pathname).toBe('/login')
  expect(url.searchParams.get('next')).toBe('/admin')

  await expect(page.getByRole('heading', { name: 'Masuk ke akun Anda' })).toBeVisible()
  await expect(page.getByLabel('Email')).toBeVisible()
  await expect(page.getByLabel('Kata sandi', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Lupa kata sandi?' })).toBeVisible()
})

test('nested admin request preserves the requested path', async ({ page }) => {
  await page.goto('/admin/vehicles?status=available')

  const url = new URL(page.url())
  expect(url.pathname).toBe('/login')
  expect(url.searchParams.get('next')).toBe('/admin/vehicles?status=available')
})

test('password reset screens render without a live auth service', async ({ page }) => {
  await page.goto('/forgot-password')
  await expect(page.getByRole('heading', { name: 'Pulihkan akses akun' })).toBeVisible()
  await expect(page.getByLabel('Email')).toBeVisible()

  await page.goto('/reset-password')
  await expect(page.getByRole('heading', { name: 'Tautan pemulihan tidak valid' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Minta tautan baru' })).toBeVisible()
})

test('auth screens expose no public registration link', async ({ page }) => {
  for (const route of ['/login', '/forgot-password', '/reset-password']) {
    await page.goto(route)
    await expect(
      page.getByRole('link', { name: /daftar|register|sign up|buat akun/i }),
    ).toHaveCount(0)
  }
})

test('conventional registration routes return 404', async () => {
  for (const route of ['/register', '/signup', '/sign-up']) {
    await expect(statusFor(route), `${route} must not exist`).resolves.toBe(404)
  }
})

test('a second showroom sign-in screen uses its own brand, not Prima', async ({
  page,
  baseURL,
}) => {
  const primaOrigin = new URL(baseURL!).origin
  const tenantBOrigin = primaOrigin.replace('prima.otoweb.id', 'tenant-b.otoweb.id')

  await page.goto(`${tenantBOrigin}/login`)

  await expect(page).toHaveTitle(/Tenant B Test Showroom/)
  await expect(page.getByRole('heading', { name: 'Masuk ke akun Anda' })).toBeVisible()
  await expect(page.getByText('Tenant B Test Showroom').first()).toBeVisible()
  await expect(page.locator('body')).not.toContainText('Prima Auto Gallery')
})
