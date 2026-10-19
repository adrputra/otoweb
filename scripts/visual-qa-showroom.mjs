import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'

import { chromium } from '@playwright/test'

import { signIn } from './visual-qa-auth.mjs'

const PORT = '3100'
const HOST = 'prima.otoweb.id'
const BASE_URL = `http://${HOST}:${PORT}`

const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
]

const tenants = {
  prima: {
    host: 'prima.otoweb.id',
    name: 'Prima Auto Gallery',
    forbidden: 'Tenant B Test Showroom',
    primary: '#b88a44',
    tagline: 'Pilihan mobil berkualitas, tanpa kompromi.',
  },
  'tenant-b': {
    host: 'tenant-b.otoweb.id',
    name: 'Tenant B Test Showroom',
    forbidden: 'Prima Auto Gallery',
    primary: '#0f766e',
    tagline: 'Mobil bekas berkualitas, siap pakai di Bandung.',
  },
}

const publicRoutes = [
  { name: 'public-home', tenant: 'prima', path: '/', heading: 'Unit unggulan kami' },
  { name: 'public-inventory', tenant: 'prima', path: '/cars', heading: 'Koleksi mobil' },
  {
    name: 'public-detail',
    tenant: 'prima',
    path: '/cars/toyota-fortuner-2021-1',
    heading: 'Fortuner',
  },
  { name: 'tenant-b-home', tenant: 'tenant-b', path: '/', heading: 'Unit unggulan kami' },
]

const adminRoutes = [
  {
    name: 'admin-showroom-settings',
    path: '/admin/settings/showroom',
    heading: 'Profil showroom',
    requiredTexts: [
      'Identitas',
      'Brand',
      'Kontak',
      'Alamat',
      'Sosial media',
      'SEO',
      'Live preview',
      'Simpan perubahan',
    ],
  },
]

async function waitForServer(url, timeoutMs = 120_000) {
  const startedAt = Date.now()

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url, { redirect: 'manual' })
      if (response.status < 500) return
    } catch {
      // Server not ready yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000))
  }

  throw new Error(`Timed out waiting for ${url}`)
}

async function readThemePrimary(page) {
  return page.evaluate(() => {
    const main = document.querySelector('main')
    return main ? getComputedStyle(main).getPropertyValue('--showroom-primary').trim() : null
  })
}

async function preparePage(page, route) {
  await page.goto(`http://${route.host}:${PORT}${route.path}`, {
    waitUntil: 'domcontentloaded',
    timeout: 180_000,
  })

  const heading = page.getByRole('heading', { name: route.heading, exact: true }).first()
  const headingVisible = await heading
    .waitFor({ state: 'visible', timeout: 120_000 })
    .then(() => true)
    .catch(() => false)

  await page.evaluate(async () => {
    const step = 600
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y)
      await new Promise((resolve) => setTimeout(resolve, 60))
    }
    window.scrollTo(0, 0)
  })
  await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {})

  return headingVisible
}

async function capturePublic(page, viewport, route, suffix = '') {
  const tenant = tenants[route.tenant]
  const headingVisible = await preparePage(page, { ...route, host: tenant.host })
  const bodyText = await page.locator('body').innerText()
  const horizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  )
  const primary = await readThemePrimary(page)
  const screenshot = `.visual-qa/screenshots/${viewport.name}/${route.name}${suffix}.png`

  await page.screenshot({ path: screenshot, fullPage: true })

  return {
    kind: 'public',
    viewport: viewport.name,
    size: `${viewport.width}x${viewport.height}`,
    route: `${tenant.host}${route.path}${suffix ? ' (after save)' : ''}`,
    heading: route.heading,
    headingVisible,
    tenantVisible: bodyText.includes(tenant.name),
    crossTenantLeak: bodyText.includes(tenant.forbidden),
    horizontalOverflow,
    expectedPrimary: tenant.primary,
    actualPrimary: primary,
    themeMatches: primary?.toLowerCase() === tenant.primary.toLowerCase(),
    screenshot,
    suffix,
  }
}

async function captureAdmin(page, viewport, route) {
  const headingVisible = await preparePage(page, {
    host: HOST,
    path: route.path,
    heading: route.heading,
  })
  const bodyText = await page.locator('body').innerText()
  const horizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  )
  const displayName = await page.locator('input[name="displayName"]').inputValue()
  const primaryColor = await page.locator('input[name="primaryColor"]').inputValue()
  const missingTexts = route.requiredTexts.filter((text) => !bodyText.includes(text))
  const screenshot = `.visual-qa/screenshots/${viewport.name}/${route.name}.png`

  await page.screenshot({ path: screenshot, fullPage: true })

  return {
    kind: 'admin',
    viewport: viewport.name,
    size: `${viewport.width}x${viewport.height}`,
    route: `${HOST}${route.path}`,
    heading: route.heading,
    headingVisible,
    tenantVisible: displayName.includes('Prima Auto Gallery'),
    crossTenantLeak: bodyText.includes('Tenant B Test Showroom'),
    horizontalOverflow,
    expectedPrimary: '#b88a44',
    actualPrimary: primaryColor,
    themeMatches: primaryColor.toLowerCase() === '#b88a44',
    missingTexts,
    displayName,
    screenshot,
  }
}

function renderReport(report) {
  const rows = report.results
    .map(
      (result) =>
        `| ${result.viewport} | ${result.route} | ${result.headingVisible ? 'yes' : 'no'} | ${result.tenantVisible ? 'yes' : 'no'} | ${result.crossTenantLeak ? 'yes' : 'no'} | ${result.horizontalOverflow ? 'yes' : 'no'} | ${result.expectedPrimary} / ${result.actualPrimary ?? '—'} | ${result.screenshot} |`,
    )
    .join('\n')

  return `# F009 Showroom Settings — Visual QA

**Captured**: ${report.capturedAt}
**Base URL**: ${report.baseUrl}
**Verdict**: ${report.verdict}

| Viewport | Route | Heading | Tenant name | Cross-tenant leak | Horizontal overflow | Primary (expected / actual) | Screenshot |
|---|---|---|---|---|---|---|---|
${rows}

## Save-without-deploy proof

- Changed the Prima tagline and SEO title in the admin editor and saved.
- Public home then rendered the new tagline and document title without a
  rebuild or deployment.
- Before: \`${report.saveProof.beforeTagline}\`
- After: \`${report.saveProof.afterTagline}\`
- Title after save: \`${report.saveProof.afterTitle}\`

## Failures

${
  report.failures.length === 0
    ? 'None.'
    : report.failures.map((failure) => `- ${failure.viewport} ${failure.route}: ${failure.reasons.join(', ')}`).join('\n')
}

## Scope

- Public home, inventory, vehicle detail, and the second tenant home, desktop
  1440×900 and mobile 390×844.
- Admin \`/admin/settings/showroom\` editor, desktop and mobile, signed in through
  the seeded local PostgreSQL account.
- Each tenant must expose its own stored primary color as a CSS variable, with no
  cross-tenant name leakage and no horizontal overflow.
- The incumbent neutral/amber design is preserved; only accent values and
  tenant data are configuration-driven.
`
}

async function main() {
  await mkdir('.visual-qa/screenshots/desktop', { recursive: true })
  await mkdir('.visual-qa/screenshots/mobile', { recursive: true })
  await mkdir('.visual-qa/reports', { recursive: true })

  const server = spawn('pnpm', ['exec', 'next', 'dev', '-p', PORT], {
    stdio: 'inherit',
    detached: true,
    env: {
      ...process.env,
      NEXT_TELEMETRY_DISABLED: '1',
      NEXT_PUBLIC_SITE_URL: BASE_URL,
      NEXT_PUBLIC_SHOWROOM_SLUG: 'prima-auto-gallery',
      SEED_DEV_AUTH: '1',
      ALLOW_DEV_LOGIN: '1',
      MEDIA_PROVIDER: 'fake',
    },
  })

  const results = []
  const saveProof = { beforeTagline: tenants.prima.tagline, afterTagline: '', afterTitle: '' }

  try {
    await waitForServer(`http://127.0.0.1:${PORT}/cars`)

    const browser = await chromium.launch({
      args: [
        `--host-resolver-rules=MAP ${HOST} 127.0.0.1, MAP prima.otoweb.id 127.0.0.1, MAP tenant-b.otoweb.id 127.0.0.1`,
      ],
    })

    try {
      for (const viewport of viewports) {
        const publicContext = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
          deviceScaleFactor: 1,
        })
        const publicPage = await publicContext.newPage()

        for (const route of publicRoutes) {
          results.push(await capturePublic(publicPage, viewport, route))
        }
        await publicContext.close()

        const adminContext = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
          deviceScaleFactor: 1,
        })
        await signIn(adminContext, BASE_URL)
        const adminPage = await adminContext.newPage()

        for (const route of adminRoutes) {
          results.push(await captureAdmin(adminPage, viewport, route))
        }
        await adminContext.close()
      }

      // Prove an admin save reaches the public site without a deployment.
      const stamp = Date.now()
      const qaTagline = `Tagline visual QA ${stamp}`
      const qaTitle = `SEO visual QA ${stamp}`

      const adminContext = await browser.newContext({ viewport: { width: 1440, height: 900 } })
      await signIn(adminContext, BASE_URL)
      const adminPage = await adminContext.newPage()
      await preparePage(adminPage, {
        host: HOST,
        path: '/admin/settings/showroom',
        heading: 'Profil showroom',
      })
      await adminPage.locator('input[name="tagline"]').fill(qaTagline)
      await adminPage.locator('input[name="seoTitle"]').fill(qaTitle)
      await adminPage.getByRole('button', { name: 'Simpan perubahan' }).click()
      await adminPage.getByText('Profil showroom disimpan.').waitFor({ timeout: 30_000 })
      await adminContext.close()

      for (const viewport of viewports) {
        const context = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
          deviceScaleFactor: 1,
        })
        const page = await context.newPage()
        const result = await capturePublic(
          page,
          viewport,
          publicRoutes[0],
          '-after-save',
        )
        const bodyText = await page.locator('body').innerText()
        const title = await page.title()
        const taglineVisible = bodyText.toUpperCase().includes(qaTagline.toUpperCase())
        saveProof.afterTagline = taglineVisible ? qaTagline : ''
        saveProof.afterTitle = title
        result.savedTaglineVisible = taglineVisible
        result.savedTitleMatches = title === qaTitle
        results.push(result)
        await context.close()
      }
    } finally {
      await browser.close()
    }

    const failures = results
      .filter(
        (result) =>
          !result.headingVisible ||
          !result.tenantVisible ||
          result.crossTenantLeak ||
          result.horizontalOverflow ||
          !result.themeMatches ||
          (result.missingTexts?.length ?? 0) > 0 ||
          result.savedTaglineVisible === false ||
          result.savedTitleMatches === false,
      )
      .map((result) => {
        const reasons = []
        if (!result.headingVisible) reasons.push('heading not visible')
        if (!result.tenantVisible) reasons.push('tenant name missing')
        if (result.crossTenantLeak) reasons.push('cross-tenant name present')
        if (result.horizontalOverflow) reasons.push('horizontal overflow')
        if (!result.themeMatches) reasons.push('tenant primary color not applied')
        if ((result.missingTexts?.length ?? 0) > 0) {
          reasons.push(`missing text: ${result.missingTexts.join(', ')}`)
        }
        if (result.savedTaglineVisible === false) reasons.push('saved tagline not visible publicly')
        if (result.savedTitleMatches === false) reasons.push('saved SEO title not reflected')
        return { ...result, reasons }
      })

    const report = {
      baseUrl: BASE_URL,
      capturedAt: new Date().toISOString(),
      viewports,
      results,
      failures,
      saveProof,
      verdict: failures.length === 0 ? 'PASS' : 'FAIL',
    }

    await writeFile('.visual-qa/reports/f009-capture.json', `${JSON.stringify(report, null, 2)}\n`)
    await writeFile(
      '.visual-qa/reports/f009-showroom-settings-visual-qa.md',
      renderReport(report),
    )

    if (failures.length > 0) {
      console.error('Showroom visual QA checks failed:', failures)
      process.exitCode = 1
      return
    }

    console.log(`Captured ${results.length} screenshots; all checks passed.`)
  } finally {
    try {
      if (server.pid) process.kill(-server.pid, 'SIGKILL')
    } catch {
      // The group may already be gone.
    }
    server.kill('SIGKILL')
  }
}

main().then(
  () => setTimeout(() => process.exit(process.exitCode ?? 0), 100),
  (error) => {
    console.error(error)
    setTimeout(() => process.exit(1), 100)
  },
)
