import { expect, test, type BrowserContext } from '@playwright/test'

const PLATFORM_PROFILE_ID = '50000000-0000-4000-8000-000000000003'
const AUTH_COOKIE_PREFIX = '127'
const PRIMA_TENANT_ID = '11111111-1111-4111-8111-111111111111'

const platformUser = {
  id: PLATFORM_PROFILE_ID,
  aud: 'authenticated',
  role: 'authenticated',
  email: 'operator@otoweb.test',
  email_confirmed_at: '2026-10-18T00:00:00.000Z',
  phone: '',
  confirmed_at: '2026-10-18T00:00:00.000Z',
  last_sign_in_at: '2026-10-18T00:00:00.000Z',
  app_metadata: { provider: 'email', providers: ['email'] },
  user_metadata: { full_name: 'Platform Operator' },
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
    user: platformUser,
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

async function signIn(context: BrowserContext, baseURL: string | undefined) {
  const host = new URL(baseURL!).hostname
  await context.addCookies([sessionCookie(host)])
}

test('unauthenticated platform access redirects to sign-in', async ({ page }) => {
  await page.goto('/platform')

  const url = new URL(page.url())
  expect(url.pathname).toBe('/login')
  expect(url.searchParams.get('next')).toBe('/platform')
})

test('a platform operator can inspect every tenant', async ({ context, page, baseURL }) => {
  await signIn(context, baseURL)

  await page.goto('/platform')
  await expect(page.getByRole('heading', { name: 'Tenant', exact: true })).toBeVisible()
  await expect(page.getByText('Prima Auto Gallery').first()).toBeVisible()
  await expect(page.getByText('Tenant B Test Showroom').first()).toBeVisible()
  await expect(page.getByText('prima.otoweb.id').first()).toBeVisible()
  await expect(page.getByText('tenant-b.otoweb.id').first()).toBeVisible()

  await page.goto(`/platform/tenants/${PRIMA_TENANT_ID}`)
  await expect(
    page.getByRole('heading', { name: 'Prima Auto Gallery', exact: true }),
  ).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Domain', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Anggota', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Plan', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Status', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Subdomain', exact: true })).toBeVisible()
  await expect(page.getByLabel('Plan tenant')).toHaveValue('starter')
})

test('a platform operator creates, configures, and disables a tenant', async ({
  context,
  page,
  baseURL,
}) => {
  await signIn(context, baseURL)
  const stamp = Date.now()
  const name = `QA Platform ${stamp}`
  const slug = `qa-platform-${stamp}`
  const subdomain = `qa-platform-${stamp}.otoweb.test`
  const changedHostname = `qa-${stamp}.otoweb.test`
  const ownerUserId = '50000000-0000-4000-8000-000000000095'
  const secondOwnerUserId = '50000000-0000-4000-8000-000000000094'

  await page.goto('/platform/tenants/new')
  await page.waitForLoadState('networkidle')
  await page.getByLabel('Nama tenant').fill(name)
  await page.getByLabel('Slug').fill(slug)
  await expect(page.getByLabel('Slug')).toHaveValue(slug)
  await page.getByLabel('Plan', { exact: true }).fill('growth')
  await page.getByLabel('Status', { exact: true }).selectOption('trial')
  await page.getByLabel('Subdomain (opsional)').fill(subdomain)
  await page.getByLabel('User ID pemilik (opsional)').fill(ownerUserId)
  await page.getByRole('button', { name: 'Buat tenant' }).click()

  await expect(page).toHaveURL(/\/platform\/tenants\/[0-9a-f-]+$/)
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible()
  await expect(page.getByText(subdomain).first()).toBeVisible()
  await expect(page.getByText(ownerUserId).first()).toBeVisible()

  await page.getByLabel('Plan tenant').fill('scale')
  await page.getByRole('button', { name: 'Simpan plan' }).click()
  await expect(page.getByText('Plan tersimpan.')).toBeVisible()

  await page.getByLabel('Status lifecycle').selectOption('active')
  await page.getByRole('button', { name: 'Simpan status' }).click()
  await expect(page.getByText('Status tersimpan.')).toBeVisible()

  await page.getByLabel('User ID pemilik').fill(secondOwnerUserId)
  await page.getByRole('button', { name: 'Tetapkan pemilik' }).click()
  await expect(page.getByText('Pemilik ditetapkan.')).toBeVisible()
  await expect(page.getByText(secondOwnerUserId).first()).toBeVisible()

  await page.getByLabel('Hostname').fill(changedHostname)
  await page.getByRole('button', { name: 'Simpan subdomain' }).click()
  await expect(page.getByText('Subdomain tersimpan.')).toBeVisible()
  await expect(page.getByText(changedHostname).first()).toBeVisible()

  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Nonaktifkan tenant' }).click()
  await expect(page.getByRole('button', { name: 'Tenant nonaktif' })).toBeVisible()

  await page.reload()
  await expect(page.getByLabel('Plan tenant')).toHaveValue('scale')
  await expect(page.getByLabel('Status lifecycle')).toHaveValue('disabled')
  await expect(page.getByText(changedHostname).first()).toBeVisible()

  await page.goto('/platform')
  const row = page.locator('a[href^="/platform/tenants/"]', { hasText: name })
  await expect(row).toBeVisible()
  await expect(row).toContainText('Nonaktif')
})

test('showroom admin navigation never links to the platform surface', async ({
  context,
  page,
  baseURL,
}) => {
  await signIn(context, baseURL)

  await page.goto('/admin')
  await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible()
  await expect(page.locator('a[href="/platform"]')).toHaveCount(0)
  await expect(page.locator('a[href^="/platform/"]')).toHaveCount(0)
})
