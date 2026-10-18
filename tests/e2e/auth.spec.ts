import { expect, test } from '@playwright/test'

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

test('conventional registration routes return 404', async ({ request }) => {
  for (const route of ['/register', '/signup', '/sign-up']) {
    const response = await request.get(route, { maxRedirects: 0 })
    expect(response.status(), `${route} must not exist`).toBe(404)
  }
})
