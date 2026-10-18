import { expect, test, type Page } from '@playwright/test'

const PORT = Number(process.env.ACCESSIBILITY_TEST_PORT ?? 3000)
const showrooms = [
  {
    name: 'Prima Auto Gallery',
    origin: `http://prima.otoweb.id:${PORT}`,
    detailSlug: 'toyota-fortuner-2021-1',
  },
  {
    name: 'Tenant B Test Showroom',
    origin: `http://tenant-b.otoweb.id:${PORT}`,
    detailSlug: 'toyota-rush-2022-1',
  },
] as const

async function assertSemanticBaseline(page: Page) {
  await expect(page.locator('html')).toHaveAttribute('lang', 'id')
  await expect(page.locator('h1')).toHaveCount(1)
  await expect(page.locator('main')).toHaveCount(1)

  const missingAlt = await page.evaluate(() =>
    [...document.images]
      .filter((image) => !image.hasAttribute('alt'))
      .map((image) => image.getAttribute('src') ?? '(missing src)'),
  )
  expect(missingAlt).toEqual([])

  const unlabeledControls = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('input, select, textarea')]
      .filter((control) => {
        if (control instanceof HTMLInputElement && control.type === 'hidden') return false
        const labels = control instanceof HTMLInputElement || control instanceof HTMLSelectElement || control instanceof HTMLTextAreaElement
          ? control.labels?.length ?? 0
          : 0
        return (
          labels === 0 &&
          !control.getAttribute('aria-label') &&
          !control.getAttribute('aria-labelledby') &&
          !control.getAttribute('title')
        )
      })
      .map((control) => `${control.tagName.toLowerCase()}[name="${control.getAttribute('name') ?? ''}"]`),
  )
  expect(unlabeledControls).toEqual([])

  const unlabeledButtons = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLButtonElement>('button')]
      .filter(
        (button) =>
          !button.textContent?.trim() &&
          !button.getAttribute('aria-label') &&
          !button.getAttribute('aria-labelledby'),
      )
      .map((button) => button.outerHTML.slice(0, 120)),
  )
  expect(unlabeledButtons).toEqual([])
}

test.describe('two-showroom accessibility baseline', () => {
  test.slow()

  test('home, inventory, detail, and sign-in expose the audited semantics', async ({ page }) => {
    for (const showroom of showrooms) {
      for (const path of ['/', '/cars', `/cars/${showroom.detailSlug}`, '/login']) {
        await page.goto(`${showroom.origin}${path}`, {
          waitUntil: 'domcontentloaded',
          timeout: 180_000,
        })
        await assertSemanticBaseline(page)
      }
    }
  })

  test('public search and filter controls have accessible names', async ({ page }) => {
    await page.goto(`${showrooms[0].origin}/`, { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('combobox', { name: 'Merek mobil' })).toBeVisible()
    await expect(page.getByRole('combobox', { name: 'Harga maksimum' })).toBeVisible()

    await page.goto(`${showrooms[0].origin}/cars`, { waitUntil: 'domcontentloaded' })
    for (const name of ['Merek', 'Transmisi', 'Bahan bakar', 'Urutkan']) {
      await expect(page.getByRole('combobox', { name, exact: true })).toBeVisible()
    }
  })

  test('the mobile menu exposes its expanded state', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`${showrooms[0].origin}/`, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle')

    const menu = page.getByRole('button', { name: 'Buka menu' })
    await expect(menu).toHaveAttribute('aria-expanded', 'false')

    await menu.click()

    const close = page.getByRole('button', { name: 'Tutup menu' })
    await expect(close).toHaveAttribute('aria-expanded', 'true')
    await expect(page.locator('#mobile-navigation')).toBeVisible()
  })

  test('contact-form errors are programmatically associated with their fields', async ({ page }) => {
    await page.goto(`${showrooms[0].origin}/`, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Kirim pesan' }).click()

    const name = page.locator('#contact-name')
    await expect(name).toHaveAttribute('aria-invalid', 'true')
    await expect(name).toHaveAttribute('aria-describedby', 'contact-name-error')
    await expect(page.locator('#contact-name-error')).toHaveAttribute('role', 'alert')
    await expect(page.locator('#contact-phone-error')).toHaveAttribute('role', 'alert')
    await expect(page.locator('#contact-message-error')).toHaveAttribute('role', 'alert')
  })
})
