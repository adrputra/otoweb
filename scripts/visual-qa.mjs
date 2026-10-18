import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'

import { chromium } from '@playwright/test'

const BASE_URL = process.env.VISUAL_QA_BASE_URL ?? 'http://127.0.0.1:3100'
const PORT = '3100'

const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
]

const routes = [
  { name: 'login', path: '/login', heading: 'Masuk ke akun Anda' },
  { name: 'forgot-password', path: '/forgot-password', heading: 'Pulihkan akses akun' },
  {
    name: 'reset-password-invalid',
    path: '/reset-password',
    heading: 'Tautan pemulihan tidak valid',
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

async function main() {
  await mkdir('.visual-qa/screenshots/desktop', { recursive: true })
  await mkdir('.visual-qa/screenshots/mobile', { recursive: true })
  await mkdir('.visual-qa/reports', { recursive: true })

  const server = spawn('pnpm', ['exec', 'next', 'dev', '-p', PORT], {
    stdio: 'inherit',
    env: {
      ...process.env,
      NEXT_TELEMETRY_DISABLED: '1',
      NEXT_PUBLIC_SITE_URL: BASE_URL,
    },
  })

  try {
    await waitForServer(`${BASE_URL}/login`)

    const browser = await chromium.launch()
    const results = []

    try {
      for (const viewport of viewports) {
        const context = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
          deviceScaleFactor: 1,
        })
        const page = await context.newPage()

        for (const route of routes) {
          await page.goto(`${BASE_URL}${route.path}`, { waitUntil: 'networkidle' })

          const headingVisible = await page
            .getByRole('heading', { name: route.heading, exact: true })
            .isVisible()
            .catch(() => false)

          const horizontalOverflow = await page.evaluate(
            () => document.documentElement.scrollWidth > window.innerWidth + 1,
          )

          const registrationLinks = await page
            .getByRole('link', { name: /daftar|register|sign up|buat akun/i })
            .count()

          const screenshot = `.visual-qa/screenshots/${viewport.name}/${route.name}.png`
          await page.screenshot({ path: screenshot, fullPage: true })

          results.push({
            viewport: viewport.name,
            size: `${viewport.width}x${viewport.height}`,
            route: route.path,
            headingVisible,
            horizontalOverflow,
            registrationLinks,
            screenshot,
          })
        }

        await context.close()
      }
    } finally {
      await browser.close()
    }

    const failures = results.filter(
      (result) =>
        !result.headingVisible || result.horizontalOverflow || result.registrationLinks > 0,
    )

    const report = {
      baseUrl: BASE_URL,
      capturedAt: new Date().toISOString(),
      viewports,
      routes,
      results,
      failures,
      verdict: failures.length === 0 ? 'PASS' : 'FAIL',
    }

    await writeFile('.visual-qa/reports/capture.json', `${JSON.stringify(report, null, 2)}\n`)

    if (failures.length > 0) {
      console.error('Visual QA checks failed:', failures)
      process.exitCode = 1
      return
    }

    console.log(`Captured ${results.length} screenshots; all checks passed.`)
  } finally {
    // Next dev can leave child processes holding stdio open; kill the tree and
    // exit explicitly so the command is usable in CI.
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
