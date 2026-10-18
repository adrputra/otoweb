import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'

import { chromium } from '@playwright/test'

const PORT = process.env.VISUAL_QA_SUBDOMAIN_PORT ?? '3101'
const BASE_URL = process.env.VISUAL_QA_SUBDOMAIN_BASE_URL ?? `http://127.0.0.1:${PORT}`

const PRIMA_EMAIL = 'halo@primaauto.id'
const PRIMA_PHONE = '+62217654321'
const TENANT_B_EMAIL = 'hello@tenant-b.test'
const TENANT_B_PHONE = '+622100000002'

const hostResolverRules = [
  'MAP prima.otoweb.id 127.0.0.1',
  'MAP tenant-b.otoweb.id 127.0.0.1',
  'MAP prima-auto-gallery.otoweb.id 127.0.0.1',
  'MAP tenant-b-test-showroom.otoweb.id 127.0.0.1',
  'MAP prima.localhost 127.0.0.1',
  'MAP tenant-b.localhost 127.0.0.1',
].join(', ')

const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
]

const routes = [
  {
    name: 'prima-otoweb-home',
    host: 'prima.otoweb.id',
    path: '/',
    tenant: 'Prima Auto Gallery',
    forbidden: 'Tenant B Test Showroom',
    email: PRIMA_EMAIL,
    phone: PRIMA_PHONE,
    inventory: 'Fortuner',
  },
  {
    name: 'tenant-b-otoweb-home',
    host: 'tenant-b.otoweb.id',
    path: '/',
    tenant: 'Tenant B Test Showroom',
    forbidden: 'Prima Auto Gallery',
    email: TENANT_B_EMAIL,
    phone: TENANT_B_PHONE,
    inventory: null,
  },
  {
    name: 'prima-otoweb-inventory',
    host: 'prima.otoweb.id',
    path: '/cars',
    tenant: 'Prima Auto Gallery',
    forbidden: 'Tenant B Test Showroom',
    email: PRIMA_EMAIL,
    phone: PRIMA_PHONE,
    inventory: 'Fortuner',
  },
  {
    name: 'tenant-b-otoweb-inventory',
    host: 'tenant-b.otoweb.id',
    path: '/cars',
    tenant: 'Tenant B Test Showroom',
    forbidden: 'Prima Auto Gallery',
    email: TENANT_B_EMAIL,
    phone: TENANT_B_PHONE,
    inventory: null,
    emptyState: 'Belum ada unit yang sesuai',
  },
  {
    name: 'prima-localhost-home',
    host: 'prima.localhost',
    path: '/',
    tenant: 'Prima Auto Gallery',
    forbidden: 'Tenant B Test Showroom',
    email: PRIMA_EMAIL,
    phone: PRIMA_PHONE,
    inventory: 'Fortuner',
  },
  {
    name: 'tenant-b-localhost-home',
    host: 'tenant-b.localhost',
    path: '/',
    tenant: 'Tenant B Test Showroom',
    forbidden: 'Prima Auto Gallery',
    email: TENANT_B_EMAIL,
    phone: TENANT_B_PHONE,
    inventory: null,
  },
]

async function waitForServer(url, timeoutMs = 180_000) {
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
  if (route.inventory && !bodyText.includes(route.inventory)) {
    reasons.push('tenant inventory missing')
  }
  if (route.emptyState && !bodyText.includes(route.emptyState)) {
    reasons.push('tenant empty state missing')
  }
  if (horizontalOverflow) reasons.push('horizontal overflow')

  const screenshot = `.visual-qa/screenshots/${viewport.name}/f013-${route.name}.png`
  await page.screenshot({ path: screenshot, fullPage: true })

  return {
    viewport: viewport.name,
    size: `${viewport.width}x${viewport.height}`,
    host: route.host,
    route: route.path,
    url,
    tenant: route.tenant,
    screenshot,
    reasons,
    passed: reasons.length === 0,
  }
}

function renderReport(report) {
  const rows = report.results
    .map(
      (result) =>
        `| ${result.viewport} | ${result.host}${result.route} | ${result.passed ? 'PASS' : 'FAIL'} | ${result.reasons.length === 0 ? '—' : result.reasons.join(', ')} | ${result.screenshot} |`,
    )
    .join('\n')

  return `# F013 Subdomain Routing Visual QA

**Captured**: ${report.capturedAt}
**Base URL**: ${report.baseUrl}
**Verdict**: ${report.verdict}

| Viewport | Route | Result | Findings | Screenshot |
|---|---|---|---|---|
${rows}

## Coverage

- Production-shaped exact hosts: \`prima.otoweb.id\`, \`tenant-b.otoweb.id\`.
- Development hosts: \`prima.localhost\`, \`tenant-b.localhost\`.
- Home and inventory surfaces at desktop 1440×900 and mobile 390×844.
- Each route checks the expected tenant name, absence of the other tenant,
  tenant-specific contact details, tenant-specific inventory (or the Tenant B
  empty state), and horizontal overflow.

## Failures

${report.failures.length === 0 ? 'None.' : report.failures.map((failure) => `- ${failure.viewport} ${failure.url}: ${failure.reasons.join(', ')}`).join('\n')}
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
      NEXT_PUBLIC_SITE_URL: `http://prima.otoweb.id:${PORT}`,
      NEXT_PUBLIC_SHOWROOM_SLUG: 'prima-auto-gallery',
    },
  })

  try {
    await waitForServer(`${BASE_URL}/cars`)

    const browser = await chromium.launch({
      args: [`--host-resolver-rules=${hostResolverRules}`],
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
      '.visual-qa/reports/f013-subdomain-routing-capture.json',
      `${JSON.stringify(report, null, 2)}\n`,
    )
    await writeFile('.visual-qa/reports/f013-subdomain-routing-visual-qa.md', renderReport(report))

    if (failures.length > 0) {
      console.error('Subdomain routing visual QA failed:', failures)
      process.exitCode = 1
      return
    }

    console.log(`Captured ${results.length} screenshots; all subdomain checks passed.`)
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
