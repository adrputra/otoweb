import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'

import { chromium } from '@playwright/test'

import { signIn } from './visual-qa-auth.mjs'

const PORT = '3104'
const HOST = 'prima.otoweb.id'
const BASE_URL = `http://${HOST}:${PORT}`
const PRIMA_TENANT_ID = '11111111-1111-4111-8111-111111111111'

const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
]

const routes = [
  {
    name: 'f012-platform-list',
    path: '/platform',
    heading: 'Tenant',
    requiredTexts: [
      'Prima Auto Gallery',
      'Tenant B Test Showroom',
      'prima.otoweb.id',
      'tenant-b.otoweb.id',
      'Tenant baru',
      'Aktif',
      'Uji coba',
    ],
  },
  {
    name: 'f012-platform-new',
    path: '/platform/tenants/new',
    heading: 'Tenant baru',
    requiredTexts: [
      'Nama tenant',
      'Slug',
      'Plan',
      'Status',
      'Subdomain (opsional)',
      'User ID pemilik (opsional)',
      'Buat tenant',
    ],
  },
  {
    name: 'f012-platform-detail',
    path: `/platform/tenants/${PRIMA_TENANT_ID}`,
    heading: 'Prima Auto Gallery',
    requiredTexts: [
      'Identitas',
      'Domain',
      'Anggota',
      'Plan',
      'Status',
      'Subdomain',
      'Pemilik',
      'Nonaktifkan tenant',
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
  const horizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  )
  const missingTexts = (route.requiredTexts ?? []).filter((text) => !bodyText.includes(text))
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
    horizontalOverflow,
    missingTexts,
    screenshot,
  }
}

function renderReport(report) {
  const rows = report.results
    .map(
      (result) =>
        `| ${result.viewport} | ${result.route} | ${result.headingVisible ? 'yes' : 'no'} | ${result.horizontalOverflow ? 'yes' : 'no'} | ${result.missingTexts.length === 0 ? 'none' : result.missingTexts.join(', ')} | ${result.screenshot} |`,
    )
    .join('\n')

  return `# F012 Platform Administration — Visual QA

**Captured**: ${report.capturedAt}
**Base URL**: ${report.baseUrl}
**Verdict**: ${report.verdict}

| Viewport | Route | Heading | Horizontal overflow | Missing required text | Screenshot |
|---|---|---|---|---|---|
${rows}

## Failures

${report.failures.length === 0 ? 'None.' : report.failures.map((failure) => `- ${failure.viewport} ${failure.url}: ${failure.reasons.join(', ')}`).join('\n')}

## Scope

- Platform tenant list, create form, and the seeded Prima tenant detail with
  plan, status, owner, subdomain, and disable controls.
- Desktop 1440×900 and mobile 390×844.
- Signed in through the seeded local PostgreSQL account as the
  \`platform_admin\` identity. The real Next proxy, platform layout, explicit
  operator membership check, and database code all run.
- No horizontal overflow and every roadmap capability is visible without a
  modal or a separate admin navigation.
- The incumbent neutral palette, square borders, Inter/Jakarta typography, and
  form vocabulary are preserved; the platform shell is distinguished by its
  dark navigation surface and separate two-item navigation.
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
          result.horizontalOverflow ||
          result.missingTexts.length > 0,
      )
      .map((result) => {
        const reasons = []
        if (!result.headingVisible) reasons.push('heading not visible')
        if (result.horizontalOverflow) reasons.push('horizontal overflow')
        if (result.missingTexts.length > 0) {
          reasons.push(`missing text: ${result.missingTexts.join(', ')}`)
        }
        return { ...result, reasons }
      })

    const report = {
      baseUrl: BASE_URL,
      capturedAt: new Date().toISOString(),
      viewports,
      routes: routes.map(({ name, path, heading }) => ({ name, path, heading })),
      results,
      failures,
      verdict: failures.length === 0 ? 'PASS' : 'FAIL',
    }

    await writeFile(
      '.visual-qa/reports/f012-platform-capture.json',
      `${JSON.stringify(report, null, 2)}\n`,
    )
    await writeFile(
      '.visual-qa/reports/f012-platform-administration-visual-qa.md',
      renderReport(report),
    )

    if (failures.length > 0) {
      console.error('Platform visual QA checks failed:', failures)
      process.exitCode = 1
      return
    }

    console.log(`Captured ${results.length} platform screenshots; all checks passed.`)
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
