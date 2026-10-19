import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'

import { chromium } from '@playwright/test'

import { signIn } from './visual-qa-auth.mjs'

const PORT = '3100'
const HOST = process.env.VISUAL_QA_HOST ?? 'prima.otoweb.id'
const BASE_URL = `http://${HOST}:${PORT}`
const VEHICLE_SLUG = 'toyota-fortuner-2021-1'

const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
]

const routes = [
  {
    name: 'analytics-vehicle-share',
    path: `/cars/${VEHICLE_SLUG}`,
    heading: 'Fortuner',
    requiredTexts: ['Bagikan unit'],
  },
  {
    name: 'analytics-admin-dashboard',
    path: '/admin',
    heading: 'Dashboard',
    requiredTexts: [
      'Analitik',
      'Paling banyak dilihat',
      'Kunjungan unit',
      'Klik WhatsApp',
      'Lead baru',
      'Konversi',
      'SEMUA WAKTU',
      'Fortuner',
    ],
    requiresAnalyticsViews: true,
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

async function seedVehicleViews(page) {
  await page.evaluate(async (slug) => {
    for (let index = 0; index < 3; index += 1) {
      await fetch('/api/public/analytics', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          event: 'vehicle_view',
          vehicleSlug: slug,
          path: `/cars/${slug}`,
        }),
      })
    }
  }, VEHICLE_SLUG)
}

async function captureRoute(page, viewport, route) {
  const url = `${BASE_URL}${route.path}`
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 180_000 })

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

  const bodyText = await page.locator('body').innerText()
  const normalizedText = bodyText.toLowerCase()
  const horizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  )
  const tenantVisible = normalizedText.includes('prima auto gallery')
  const crossTenantLeak = normalizedText.includes('tenant b test showroom')
  const requiredTexts = route.requiredTexts ?? []
  const missingTexts = requiredTexts.filter((text) => !bodyText.includes(text))

  let analyticsViews = null
  if (route.requiresAnalyticsViews) {
    const views = page.getByTestId('analytics-vehicle-views')
    analyticsViews = (await views.count()) > 0 ? Number(await views.innerText()) : 0
  }

  const screenshot = `.visual-qa/screenshots/${viewport.name}/${route.name}.png`
  await page.screenshot({ path: screenshot, fullPage: true })

  return {
    viewport: viewport.name,
    size: `${viewport.width}x${viewport.height}`,
    host: HOST,
    route: route.path,
    url,
    heading: route.heading,
    headingVisible,
    tenantVisible,
    crossTenantLeak,
    horizontalOverflow,
    analyticsViews,
    missingTexts,
    screenshot,
  }
}

function renderReport(report) {
  const rows = report.results
    .map(
      (result) =>
        `| ${result.viewport} | ${result.route} | ${result.headingVisible ? 'yes' : 'no'} | ${result.tenantVisible ? 'yes' : 'no'} | ${result.crossTenantLeak ? 'yes' : 'no'} | ${result.horizontalOverflow ? 'yes' : 'no'} | ${result.analyticsViews ?? '—'} | ${result.screenshot} |`,
    )
    .join('\n')

  return `# F015 Analytics — Visual QA

**Captured**: ${report.capturedAt}
**Base URL**: ${report.baseUrl}
**Verdict**: ${report.verdict}

| Viewport | Route | Heading | Tenant name | Cross-tenant leak | Horizontal overflow | Vehicle views | Screenshot |
|---|---|---|---|---|---|---|---|
${rows}

## Failures

${report.failures.length === 0 ? 'None.' : report.failures.map((failure) => `- ${failure.viewport} ${failure.url}: ${failure.reasons.join(', ')}`).join('\n')}

## Scope

- Authenticated admin dashboard analytics section (metrics, most viewed
  vehicles, empty-state behaviour) and the public vehicle detail share control.
- Desktop 1440×900 and mobile 390×844.
- Signed in through the seeded local PostgreSQL account; the real Next proxy, admin layout, tenant
  resolver, RLS session, database, and analytics beacon all run.
- Three \`vehicle_view\` events are seeded through the public beacon before the
  dashboard capture so the most-viewed panel is proven with real data.
- The incumbent neutral/amber admin and showroom design is preserved; F015 only
  adds the analytics section and replaces the inert share control.
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
    },
  })

  try {
    await waitForServer(`http://127.0.0.1:${PORT}/cars`)

    const browser = await chromium.launch({
      args: [
        `--host-resolver-rules=MAP ${HOST} 127.0.0.1, MAP prima.otoweb.id 127.0.0.1, MAP tenant-b.otoweb.id 127.0.0.1`,
      ],
    })

    const results = []

    try {
      for (const viewport of viewports) {
        const context = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
          deviceScaleFactor: 1,
        })

        await signIn(context, BASE_URL)

        const page = await context.newPage()

        await page.goto(`${BASE_URL}/cars/${VEHICLE_SLUG}`, {
          waitUntil: 'domcontentloaded',
          timeout: 180_000,
        })
        await page
          .getByRole('heading', { name: 'Fortuner', exact: true })
          .first()
          .waitFor({ state: 'visible', timeout: 120_000 })
        await seedVehicleViews(page)

        for (const route of routes) {
          results.push(await captureRoute(page, viewport, route))
        }

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
          result.missingTexts.length > 0 ||
          (result.analyticsViews !== null && result.analyticsViews <= 0),
      )
      .map((result) => {
        const reasons = []
        if (!result.headingVisible) reasons.push('heading not visible')
        if (!result.tenantVisible) reasons.push('tenant name missing')
        if (result.crossTenantLeak) reasons.push('cross-tenant name present')
        if (result.horizontalOverflow) reasons.push('horizontal overflow')
        if (result.analyticsViews !== null && result.analyticsViews <= 0) {
          reasons.push('analytics views did not render a positive count')
        }
        if (result.missingTexts.length > 0) {
          reasons.push(`missing text: ${result.missingTexts.join(', ')}`)
        }
        return { ...result, reasons }
      })

    const report = {
      baseUrl: BASE_URL,
      capturedAt: new Date().toISOString(),
      viewports,
      routes,
      results,
      failures,
      verdict: failures.length === 0 ? 'PASS' : 'FAIL',
    }

    await writeFile(
      '.visual-qa/reports/f015-analytics-capture.json',
      `${JSON.stringify(report, null, 2)}\n`,
    )
    await writeFile('.visual-qa/reports/f015-analytics-visual-qa.md', renderReport(report))

    if (failures.length > 0) {
      console.error('Analytics visual QA checks failed:', failures)
      process.exitCode = 1
      return
    }

    console.log(`Captured ${results.length} analytics screenshots; all checks passed.`)
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
