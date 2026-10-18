import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'

import { chromium } from '@playwright/test'

const PORT = '3100'
const AUTH_PORT = '54321'
const HOST = 'prima.otoweb.id'
const BASE_URL = `http://${HOST}:${PORT}`
const AUTH_URL = `http://127.0.0.1:${AUTH_PORT}`

const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
]

const routes = [
  {
    name: 'f010-public-contact-form',
    path: '/',
    heading: 'Kirim pertanyaan',
    requiredTexts: ['Nama', 'Nomor telepon', 'Email (opsional)', 'Pesan', 'Kirim pesan'],
  },
  {
    name: 'f010-admin-leads',
    path: '/admin/leads',
    heading: 'Leads',
    requiredTexts: [
      'Total',
      'Baru',
      'Dihubungi',
      'Kualifikasi',
      'Menang',
      'Kalah',
      'Formulir kontak',
      'Semua status',
      'Semua sumber',
    ],
  },
]

function sessionCookie() {
  const user = {
    id: '50000000-0000-4000-8000-000000000001',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'owner@primaauto.test',
    email_confirmed_at: '2026-10-18T00:00:00.000Z',
    phone: '',
    confirmed_at: '2026-10-18T00:00:00.000Z',
    last_sign_in_at: '2026-10-18T00:00:00.000Z',
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: { full_name: 'Aditya Pranata' },
    identities: [],
    created_at: '2026-10-18T00:00:00.000Z',
    updated_at: '2026-10-18T00:00:00.000Z',
  }

  const session = {
    access_token: 'fake-access-token',
    refresh_token: 'fake-refresh-token',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user,
  }

  return {
    name: `sb-${new URL(AUTH_URL).hostname.split('.')[0]}-auth-token`,
    value: `base64-${Buffer.from(JSON.stringify(session)).toString('base64url')}`,
  }
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
    tenantVisible,
    crossTenantLeak,
    horizontalOverflow,
    missingTexts,
    screenshot,
  }
}

function renderReport(report) {
  const rows = report.results
    .map(
      (result) =>
        `| ${result.viewport} | ${result.route} | ${result.headingVisible ? 'yes' : 'no'} | ${result.tenantVisible ? 'yes' : 'no'} | ${result.crossTenantLeak ? 'yes' : 'no'} | ${result.horizontalOverflow ? 'yes' : 'no'} | ${result.missingTexts.length === 0 ? 'yes' : result.missingTexts.join(', ')} | ${result.screenshot} |`,
    )
    .join('\n')

  return `# F010 Lead Capture — Visual QA

**Captured**: ${report.capturedAt}
**Base URL**: ${report.baseUrl}
**Verdict**: ${report.verdict}

| Viewport | Route | Heading | Tenant name | Cross-tenant leak | Horizontal overflow | Required copy | Screenshot |
|---|---|---|---|---|---|---|---|
${rows}

## Failures

${report.failures.length === 0 ? 'None.' : report.failures.map((failure) => `- ${failure.viewport} ${failure.url}: ${failure.reasons.join(', ')}`).join('\n')}

## Scope

- Public home contact form (labels, message field, submit control) on Prima.
- Admin lead dashboard with summary counts, filters, the submitted inquiry, and
  status controls.
- Desktop 1440×900 and mobile 390×844.
- The capture submits a real contact inquiry first, so the dashboard screenshot
  proves the inquiry -> tenant lead -> admin dashboard loop.
- The incumbent neutral/amber design is preserved; no new visual language is
  introduced.
- Cross-tenant text must not appear on the Prima surfaces.
`
}

async function main() {
  await mkdir('.visual-qa/screenshots/desktop', { recursive: true })
  await mkdir('.visual-qa/screenshots/mobile', { recursive: true })
  await mkdir('.visual-qa/reports', { recursive: true })

  const auth = spawn('node', ['scripts/fake-supabase-auth.mjs'], {
    stdio: 'inherit',
    env: { ...process.env, FAKE_AUTH_PORT: AUTH_PORT },
  })

  const server = spawn('pnpm', ['exec', 'next', 'dev', '-p', PORT], {
    stdio: 'inherit',
    detached: true,
    env: {
      ...process.env,
      NEXT_TELEMETRY_DISABLED: '1',
      NEXT_PUBLIC_SITE_URL: BASE_URL,
      NEXT_PUBLIC_SHOWROOM_SLUG: 'prima-auto-gallery',
      NEXT_PUBLIC_SUPABASE_URL: AUTH_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'fake-anon-key',
    },
  })

  try {
    await waitForServer(`http://127.0.0.1:${PORT}/cars`)
    await waitForServer(`${AUTH_URL}/health`, 30_000)

    const browser = await chromium.launch({
      args: [
        `--host-resolver-rules=MAP ${HOST} 127.0.0.1, MAP tenant-b.otoweb.id 127.0.0.1`,
      ],
    })

    const results = []

    try {
      const firstViewport = viewports[0]
      const seedContext = await browser.newContext({
        viewport: { width: firstViewport.width, height: firstViewport.height },
        deviceScaleFactor: 1,
      })
      const cookie = sessionCookie()
      await seedContext.addCookies([
        {
          name: cookie.name,
          value: cookie.value,
          domain: HOST,
          path: '/',
          httpOnly: true,
          sameSite: 'Lax',
        },
      ])

      const seedPage = await seedContext.newPage()
      const stamp = Date.now()
      await seedPage.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 180_000 })
      await seedPage.getByLabel('Nama', { exact: true }).fill(`Visual QA Lead ${stamp}`)
      await seedPage.getByLabel('Nomor telepon', { exact: true }).fill('0812 9900 7711')
      await seedPage.getByLabel('Email (opsional)', { exact: true }).fill('visual-qa@example.com')
      await seedPage
        .getByLabel('Pesan', { exact: true })
        .fill(`Inquiry visual QA ${stamp} untuk unit Toyota Fortuner.`)
      await seedPage.getByRole('button', { name: 'Kirim pesan' }).click()
      await seedPage.getByRole('status').waitFor({ state: 'visible', timeout: 30_000 })
      await seedContext.close()

      for (const viewport of viewports) {
        const context = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
          deviceScaleFactor: 1,
        })

        await context.addCookies([
          {
            name: cookie.name,
            value: cookie.value,
            domain: HOST,
            path: '/',
            httpOnly: true,
            sameSite: 'Lax',
          },
        ])

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
          result.horizontalOverflow ||
          result.missingTexts.length > 0,
      )
      .map((result) => {
        const reasons = []
        if (!result.headingVisible) reasons.push('heading not visible')
        if (!result.tenantVisible) reasons.push('tenant name missing')
        if (result.crossTenantLeak) reasons.push('cross-tenant name present')
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
      routes,
      results,
      failures,
      verdict: failures.length === 0 ? 'PASS' : 'FAIL',
    }

    await writeFile(
      '.visual-qa/reports/f010-capture.json',
      `${JSON.stringify(report, null, 2)}\n`,
    )
    await writeFile(
      '.visual-qa/reports/f010-lead-capture-visual-qa.md',
      renderReport(report),
    )

    if (failures.length > 0) {
      console.error('Lead capture visual QA checks failed:', failures)
      process.exitCode = 1
      return
    }

    console.log(`Captured ${results.length} lead-capture screenshots; all checks passed.`)
  } finally {
    auth.kill('SIGTERM')
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
