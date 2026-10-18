import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'

import { chromium } from '@playwright/test'

const PORT = process.env.VISUAL_QA_HARDENING_PORT ?? '3102'
const BASE_URL = `http://prima.otoweb.id:${PORT}`

const hostResolverRules = [
  'MAP prima.otoweb.id 127.0.0.1',
  'MAP tenant-b.otoweb.id 127.0.0.1',
  'MAP unknown.otoweb.id 127.0.0.1',
].join(', ')

const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
]

const routes = [
  {
    name: 'prima-home',
    host: 'prima.otoweb.id',
    path: '/',
    tenant: 'Prima Auto Gallery',
    forbidden: 'Tenant B Test Showroom',
    email: 'halo@primaauto.id',
    phone: '+62217654321',
    inventory: 'Fortuner',
  },
  {
    name: 'prima-inventory',
    host: 'prima.otoweb.id',
    path: '/cars',
    tenant: 'Prima Auto Gallery',
    forbidden: 'Tenant B Test Showroom',
    email: 'halo@primaauto.id',
    phone: '+62217654321',
    inventory: 'Fortuner',
  },
  {
    name: 'prima-detail',
    host: 'prima.otoweb.id',
    path: '/cars/toyota-fortuner-2021-1',
    tenant: 'Prima Auto Gallery',
    forbidden: 'Tenant B Test Showroom',
    email: 'halo@primaauto.id',
    phone: '+62217654321',
    inventory: 'Fortuner',
  },
  {
    name: 'tenant-b-home',
    host: 'tenant-b.otoweb.id',
    path: '/',
    tenant: 'Tenant B Test Showroom',
    forbidden: 'Prima Auto Gallery',
    email: 'hello@tenant-b.test',
    phone: '+622100000002',
    inventory: 'Rush',
  },
  {
    name: 'tenant-b-inventory',
    host: 'tenant-b.otoweb.id',
    path: '/cars',
    tenant: 'Tenant B Test Showroom',
    forbidden: 'Prima Auto Gallery',
    email: 'hello@tenant-b.test',
    phone: '+622100000002',
    inventory: 'Rush',
  },
  {
    name: 'tenant-b-detail',
    host: 'tenant-b.otoweb.id',
    path: '/cars/toyota-rush-2022-1',
    tenant: 'Tenant B Test Showroom',
    forbidden: 'Prima Auto Gallery',
    email: 'hello@tenant-b.test',
    phone: '+622100000002',
    inventory: 'Rush',
  },
]

const notFoundRoute = {
  name: 'unknown-host-404',
  host: 'unknown.otoweb.id',
  path: '/',
  expectedStatus: 404,
}

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
  const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 180_000 })
  await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {})

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

  const reasons = []
  if (!bodyText.includes(route.tenant)) reasons.push('tenant name missing')
  if (bodyText.includes(route.forbidden)) reasons.push('cross-tenant name present')
  if (!bodyText.includes(route.email)) reasons.push('tenant email missing')
  if (!bodyText.includes(route.phone)) reasons.push('tenant phone missing')
  if (!bodyText.includes(route.inventory)) reasons.push('tenant inventory missing')
  if (horizontalOverflow) reasons.push('horizontal overflow')

  const screenshot = `.visual-qa/screenshots/${viewport.name}/f016-${route.name}.png`
  await page.screenshot({ path: screenshot, fullPage: true })

  return {
    viewport: viewport.name,
    size: `${viewport.width}x${viewport.height}`,
    host: route.host,
    route: route.path,
    status: response?.status() ?? null,
    screenshot,
    reasons,
    passed: reasons.length === 0,
  }
}

async function captureNotFound(page, viewport) {
  const url = `http://${notFoundRoute.host}:${PORT}${notFoundRoute.path}`
  const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 180_000 })
  await page
    .getByRole('heading', { name: 'Halaman tidak ditemukan' })
    .waitFor({ state: 'visible', timeout: 15_000 })
    .catch(() => {})
  await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {})
  const bodyText = await page.locator('body').innerText()
  const reasons = []

  if (response?.status() !== notFoundRoute.expectedStatus) {
    reasons.push(`expected ${notFoundRoute.expectedStatus}, got ${response?.status()}`)
  }
  if (/Prima Auto Gallery|Tenant B Test Showroom/.test(bodyText)) {
    reasons.push('unknown host leaked a tenant identity')
  }
  if (!/tidak ditemukan|404/i.test(bodyText)) reasons.push('not-found copy missing')

  const screenshot = `.visual-qa/screenshots/${viewport.name}/f016-${notFoundRoute.name}.png`
  await page.screenshot({ path: screenshot, fullPage: true })

  return {
    viewport: viewport.name,
    size: `${viewport.width}x${viewport.height}`,
    host: notFoundRoute.host,
    route: notFoundRoute.path,
    status: response?.status() ?? null,
    screenshot,
    reasons,
    passed: reasons.length === 0,
  }
}

function renderReport(report) {
  const rows = report.results
    .map(
      (result) =>
        `| ${result.viewport} | ${result.host}${result.route} | ${result.status ?? '—'} | ${result.passed ? 'PASS' : 'FAIL'} | ${result.reasons.length === 0 ? '—' : result.reasons.join(', ')} | ${result.screenshot} |`,
    )
    .join('\n')

  return `# F016 Production Hardening Visual QA

**Captured**: ${report.capturedAt}
**Base URL**: ${report.baseUrl}
**Verdict**: ${report.verdict}

| Viewport | Route | Status | Result | Findings | Screenshot |
|---|---|---|---|---|---|
${rows}

## Coverage

- Prima Auto Gallery and Tenant B Test Showroom: home, inventory, and vehicle detail.
- Desktop 1440×900 and mobile 390×844.
- Tenant-specific identity, contact details, inventory, cross-tenant leakage, and horizontal overflow.
- Unknown-host failure state: status 404, no tenant identity, and visible not-found copy.

## Failures

${report.failures.length === 0 ? 'None.' : report.failures.map((failure) => `- ${failure.viewport} ${failure.host}${failure.route}: ${failure.reasons.join(', ')}`).join('\n')}
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
    await waitForServer(`http://127.0.0.1:${PORT}/cars`)

    const browser = await chromium.launch({ args: [`--host-resolver-rules=${hostResolverRules}`] })
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
        results.push(await captureNotFound(page, viewport))

        await context.close()
      }
    } finally {
      await browser.close()
    }

    const failures = results.filter((result) => !result.passed)
    const report = {
      baseUrl: BASE_URL,
      capturedAt: new Date().toISOString(),
      viewports,
      routes: routes.map(({ name, host, path }) => ({ name, host, path })),
      results,
      failures,
      verdict: failures.length === 0 ? 'PASS' : 'FAIL',
    }

    await writeFile(
      '.visual-qa/reports/f016-production-hardening-capture.json',
      `${JSON.stringify(report, null, 2)}\n`,
    )
    await writeFile(
      '.visual-qa/reports/f016-production-hardening-visual-qa.md',
      renderReport(report),
    )

    if (failures.length > 0) {
      console.error('Visual QA checks failed:', failures)
      process.exitCode = 1
      return
    }

    console.log(`Captured ${results.length} screenshots; all checks passed.`)
  } finally {
    try {
      if (server.pid) process.kill(-server.pid, 'SIGKILL')
    } catch {
      // The process group may already be gone.
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
