import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'

import { chromium } from '@playwright/test'

const PORT = '3100'
const BASE_URL = process.env.VISUAL_QA_BASE_URL ?? `http://127.0.0.1:${PORT}`

const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
]

const tenantHosts = {
  prima: 'prima.otoweb.id',
  'tenant-b': 'tenant-b.otoweb.id',
}

const routes = [
  {
    name: 'home',
    host: tenantHosts.prima,
    path: '/',
    heading: 'Prima Auto Gallery',
    tenant: 'Prima Auto Gallery',
    forbiddenTenant: 'Tenant B Test Showroom',
  },
  {
    name: 'inventory',
    host: tenantHosts.prima,
    path: '/cars',
    heading: 'Koleksi mobil',
    tenant: 'Prima Auto Gallery',
    forbiddenTenant: 'Tenant B Test Showroom',
  },
  {
    name: 'vehicle-detail',
    host: tenantHosts.prima,
    path: '/cars/toyota-fortuner-2021-1',
    heading: 'Fortuner',
    tenant: 'Prima Auto Gallery',
    forbiddenTenant: 'Tenant B Test Showroom',
  },
  {
    name: 'tenant-b-home',
    host: tenantHosts['tenant-b'],
    path: '/',
    heading: 'Tenant B Test Showroom',
    tenant: 'Tenant B Test Showroom',
    forbiddenTenant: 'Prima Auto Gallery',
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

async function captureRoute(page, viewport, route) {
  const url = `http://${route.host}:${PORT}${route.path}`
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 180_000 })

  const heading = page.getByRole('heading', { name: route.heading, exact: true }).first()
  const headingVisible = await heading
    .waitFor({ state: 'visible', timeout: 120_000 })
    .then(() => true)
    .catch(() => false)

  // Scroll the full page so Next.js lazy images below the fold are loaded
  // before the full-page capture.
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
  const horizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  )
  const tenantVisible = bodyText.includes(route.tenant)
  const crossTenantLeak = bodyText.includes(route.forbiddenTenant)

  const screenshot = `.visual-qa/screenshots/${viewport.name}/${route.name}.png`
  await page.screenshot({ path: screenshot, fullPage: true })

  return {
    viewport: viewport.name,
    size: `${viewport.width}x${viewport.height}`,
    host: route.host,
    route: route.path,
    url,
    heading: route.heading,
    headingVisible,
    tenantVisible,
    crossTenantLeak,
    horizontalOverflow,
    screenshot,
  }
}

function renderReport(report) {
  const rows = report.results
    .map(
      (result) =>
        `| ${result.viewport} | ${result.host}${result.route} | ${result.headingVisible ? 'yes' : 'no'} | ${result.tenantVisible ? 'yes' : 'no'} | ${result.crossTenantLeak ? 'yes' : 'no'} | ${result.horizontalOverflow ? 'yes' : 'no'} | ${result.screenshot} |`,
    )
    .join('\n')

  return `# F006 Public Site Visual QA

**Captured**: ${report.capturedAt}
**Base URL**: ${report.baseUrl}
**Verdict**: ${report.verdict}

| Viewport | Route | Heading | Tenant name | Cross-tenant leak | Horizontal overflow | Screenshot |
|---|---|---|---|---|---|---|
${rows}

## Failures

${report.failures.length === 0 ? 'None.' : report.failures.map((failure) => `- ${failure.viewport} ${failure.url}: ${failure.reasons.join(', ')}`).join('\n')}

## Scope

- Public home, inventory, vehicle detail, and Tenant B home.
- Desktop 1440×900 and mobile 390×844.
- Hostnames are resolved through Chromium host-resolver rules, so the capture
  exercises the same verified-domain public tenant resolution as production.
- The incumbent neutral/amber visual design is preserved; only tenant-derived
  data and the minimum component wiring changed.
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
    },
  })

  try {
    await waitForServer(`${BASE_URL}/cars`)

    const browser = await chromium.launch({
      args: [
        '--host-resolver-rules=MAP prima.otoweb.id 127.0.0.1, MAP tenant-b.otoweb.id 127.0.0.1',
      ],
    })
    const results = []

    try {
      for (const viewport of viewports) {
        const context = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
          deviceScaleFactor: 1,
        })
        const page = await context.newPage()

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
          result.horizontalOverflow,
      )
      .map((result) => {
        const reasons = []
        if (!result.headingVisible) reasons.push('heading not visible')
        if (!result.tenantVisible) reasons.push('tenant name missing')
        if (result.crossTenantLeak) reasons.push('cross-tenant name present')
        if (result.horizontalOverflow) reasons.push('horizontal overflow')
        return { ...result, reasons }
      })

    const report = {
      baseUrl: BASE_URL,
      capturedAt: new Date().toISOString(),
      viewports,
      routes: routes.map(({ name, host, path, heading }) => ({ name, host, path, heading })),
      results,
      failures,
      verdict: failures.length === 0 ? 'PASS' : 'FAIL',
    }

    await writeFile('.visual-qa/reports/capture.json', `${JSON.stringify(report, null, 2)}\n`)
    await writeFile('.visual-qa/reports/f006-public-database-visual-qa.md', renderReport(report))

    if (failures.length > 0) {
      console.error('Visual QA checks failed:', failures)
      process.exitCode = 1
      return
    }

    console.log(`Captured ${results.length} screenshots; all checks passed.`)
  } finally {
    // `next dev` spawns worker processes; kill the whole detached group so the
    // command exits instead of leaving an orphan holding stdio open.
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
