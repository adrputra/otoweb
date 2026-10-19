import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'

import { chromium } from '@playwright/test'

import { signIn } from './visual-qa-auth.mjs'

const PORT = '3106'
const HOST = 'prima.otoweb.id'
const CUSTOM_HOST = 'showroom.prima.test'
const PLATFORM_BASE = `http://${HOST}:${PORT}`
const PRIMA_TENANT_ID = '11111111-1111-4111-8111-111111111111'

const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
]


const routes = [
  {
    name: 'f014-platform-custom-domain',
    url: `${PLATFORM_BASE}/platform/tenants/${PRIMA_TENANT_ID}`,
    heading: 'Prima Auto Gallery',
    requiredTexts: [
      'Domain kustom',
      'showroom.prima.test',
      'Terverifikasi',
      'SSL aktif',
      '_otoweb-verify.showroom.prima.test',
      'otoweb-verify=',
      'Sudah aktif',
    ],
    forbiddenTexts: [],
  },
  {
    name: 'f014-custom-domain-home',
    url: `http://${CUSTOM_HOST}:${PORT}/`,
    heading: null,
    requiredTexts: ['Prima Auto Gallery'],
    forbiddenTexts: ['Tenant B Test Showroom'],
  },
  {
    name: 'f014-platform-subdomain-fallback',
    url: `http://${HOST}:${PORT}/`,
    heading: null,
    requiredTexts: ['Prima Auto Gallery'],
    forbiddenTexts: ['Tenant B Test Showroom'],
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

async function addPlatformSession(context) {
  await signIn(context, PLATFORM_BASE)
}

async function registerAndVerify(page) {
  await page.goto(`${PLATFORM_BASE}/platform/tenants/${PRIMA_TENANT_ID}`, {
    waitUntil: 'domcontentloaded',
    timeout: 180_000,
  })
  await page.getByRole('heading', { name: 'Domain kustom', exact: true }).waitFor({
    state: 'visible',
    timeout: 120_000,
  })
  await page.waitForLoadState('networkidle', { timeout: 30_000 }).catch(() => {})

  await page.getByLabel('Domain kustom').fill(CUSTOM_HOST)
  await page.getByRole('button', { name: 'Daftarkan domain' }).click()
  await page.getByText(CUSTOM_HOST).first().waitFor({ state: 'visible', timeout: 60_000 })
  await page.getByText('Menunggu verifikasi').first().waitFor({ state: 'visible' })

  await page.getByRole('button', { name: `Verifikasi DNS ${CUSTOM_HOST}` }).click()
  await page.getByText('Terverifikasi').first().waitFor({ state: 'visible', timeout: 60_000 })
  await page.getByText('SSL aktif').first().waitFor({ state: 'visible', timeout: 60_000 })
}

async function captureRoute(page, viewport, route) {
  await page.goto(route.url, { waitUntil: 'domcontentloaded', timeout: 180_000 })

  let headingVisible = true
  if (route.heading) {
    headingVisible = await page
      .getByRole('heading', { name: route.heading, exact: true })
      .first()
      .waitFor({ state: 'visible', timeout: 120_000 })
      .then(() => true)
      .catch(() => false)
  }

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
  const missingTexts = route.requiredTexts.filter((text) => !bodyText.includes(text))
  const unexpectedTexts = route.forbiddenTexts.filter((text) => bodyText.includes(text))
  const screenshot = `.visual-qa/screenshots/${viewport.name}/${route.name}.png`

  await page.screenshot({ path: screenshot, fullPage: true })

  return {
    viewport: viewport.name,
    size: `${viewport.width}x${viewport.height}`,
    url: route.url,
    headingVisible,
    horizontalOverflow,
    missingTexts,
    unexpectedTexts,
    screenshot,
  }
}

function renderReport(report) {
  const rows = report.results
    .map(
      (result) =>
        `| ${result.viewport} | ${result.url} | ${result.headingVisible ? 'yes' : 'no'} | ${result.horizontalOverflow ? 'yes' : 'no'} | ${result.missingTexts.length === 0 ? 'none' : result.missingTexts.join(', ')} | ${result.unexpectedTexts.length === 0 ? 'none' : result.unexpectedTexts.join(', ')} | ${result.screenshot} |`,
    )
    .join('\n')

  return `# F014 Custom Domains — Visual QA

**Captured**: ${report.capturedAt}
**Base URL**: ${report.baseUrl}
**Verdict**: ${report.verdict}

| Viewport | URL | Heading | Horizontal overflow | Missing required text | Unexpected text | Screenshot |
|---|---|---|---|---|---|---|
${rows}

## Coverage

- Registered \`${CUSTOM_HOST}\` through the real platform tenant-detail UI.
- Verified DNS and provisioned the certificate through the deterministic fake
  provider selected by \`DOMAIN_PROVIDER=fake\`.
- Captured the platform domain-management section, the verified custom-domain
  public home, and the \`${HOST}\` platform-subdomain fallback.
- Desktop 1440×900 and mobile 390×844, signed in through the seeded local PostgreSQL account
  endpoint as the seeded \`platform_admin\` identity.
- Checks include visible verification/SSL state, exact TXT/CNAME instructions,
  correct showroom identity, absence of the other tenant, and no horizontal
  overflow.

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
      NEXT_PUBLIC_SITE_URL: `http://${HOST}:${PORT}`,
      NEXT_PUBLIC_SHOWROOM_SLUG: 'prima-auto-gallery',
      SEED_DEV_AUTH: '1',
      ALLOW_DEV_LOGIN: '1',
      DOMAIN_PROVIDER: 'fake',
    },
  })

  try {
    await waitForServer(`http://127.0.0.1:${PORT}/cars`)

    const browser = await chromium.launch({
      args: [
        `--host-resolver-rules=MAP ${HOST} 127.0.0.1, MAP ${CUSTOM_HOST} 127.0.0.1, MAP prima.otoweb.id 127.0.0.1, MAP tenant-b.otoweb.id 127.0.0.1`,
      ],
    })

    const results = []

    try {
      // Register and verify once; both viewports then capture the same state.
      const setupContext = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 1,
      })
      await addPlatformSession(setupContext)
      await registerAndVerify(await setupContext.newPage())
      await setupContext.close()

      for (const viewport of viewports) {
        const context = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
          deviceScaleFactor: 1,
        })
        await addPlatformSession(context)
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
          result.missingTexts.length > 0 ||
          result.unexpectedTexts.length > 0,
      )
      .map((result) => {
        const reasons = []
        if (!result.headingVisible) reasons.push('heading not visible')
        if (result.horizontalOverflow) reasons.push('horizontal overflow')
        if (result.missingTexts.length > 0) {
          reasons.push(`missing text: ${result.missingTexts.join(', ')}`)
        }
        if (result.unexpectedTexts.length > 0) {
          reasons.push(`unexpected text: ${result.unexpectedTexts.join(', ')}`)
        }
        return { ...result, reasons }
      })

    const report = {
      baseUrl: PLATFORM_BASE,
      capturedAt: new Date().toISOString(),
      viewports,
      routes: routes.map(({ name, url }) => ({ name, url })),
      results,
      failures,
      verdict: failures.length === 0 ? 'PASS' : 'FAIL',
    }

    await writeFile(
      '.visual-qa/reports/f014-custom-domains-capture.json',
      `${JSON.stringify(report, null, 2)}\n`,
    )
    await writeFile(
      '.visual-qa/reports/f014-custom-domains-visual-qa.md',
      renderReport(report),
    )

    if (failures.length > 0) {
      console.error('Custom domain visual QA checks failed:', failures)
      process.exitCode = 1
      return
    }

    console.log(`Captured ${results.length} custom-domain screenshots; all checks passed.`)
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
