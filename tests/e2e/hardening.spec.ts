import { mkdir, writeFile } from 'node:fs/promises'
import http from 'node:http'

import { expect, test, type Page } from '@playwright/test'

const PORT = Number(process.env.HARDENING_TEST_PORT ?? 3000)
const PRIMA_HOST = 'prima.otoweb.id'
const TENANT_B_HOST = 'tenant-b.otoweb.id'
const PRIMA_ORIGIN = `http://${PRIMA_HOST}:${PORT}`
const TENANT_B_ORIGIN = `http://${TENANT_B_HOST}:${PORT}`
const PRIMA_FORTUNER = 'toyota-fortuner-2021-1'
const TENANT_B_RUSH = 'toyota-rush-2022-1'

interface RawResponse {
  status: number
  contentType: string
  body: string
}

function requestRaw(
  host: string,
  path: string,
  options: { method?: string; body?: string; headers?: Record<string, string> } = {},
): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        hostname: '127.0.0.1',
        port: PORT,
        path,
        method: options.method ?? 'GET',
        headers: {
          host: `${host}:${PORT}`,
          ...(options.body ? { 'content-length': String(Buffer.byteLength(options.body)) } : {}),
          ...options.headers,
        },
      },
      (response) => {
        let body = ''
        response.setEncoding('utf8')
        response.on('data', (chunk: string) => {
          body += chunk
        })
        response.on('end', () => {
          resolve({
            status: response.statusCode ?? 0,
            contentType: String(response.headers['content-type'] ?? ''),
            body,
          })
        })
      },
    )

    request.on('error', reject)
    if (options.body) request.write(options.body)
    request.end()
  })
}

function canonical(html: string): string | null {
  return html.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i)?.[1] ?? null
}

function title(html: string): string | null {
  return html.match(/<title>([^<]*)<\/title>/i)?.[1] ?? null
}

const showrooms = [
  {
    name: 'Prima Auto Gallery',
    host: PRIMA_HOST,
    origin: PRIMA_ORIGIN,
    forbidden: 'Tenant B Test Showroom',
    homeHeading: 'Prima Auto Gallery',
    inventoryHeading: 'Koleksi mobil',
    detailHeading: 'Fortuner',
    detailSlug: PRIMA_FORTUNER,
    otherDetailSlug: TENANT_B_RUSH,
    expectedTitle: 'Prima Auto Gallery',
  },
  {
    name: 'Tenant B Test Showroom',
    host: TENANT_B_HOST,
    origin: TENANT_B_ORIGIN,
    forbidden: 'Prima Auto Gallery',
    homeHeading: 'Tenant B Test Showroom',
    inventoryHeading: 'Koleksi mobil',
    detailHeading: 'Rush',
    detailSlug: TENANT_B_RUSH,
    otherDetailSlug: PRIMA_FORTUNER,
    expectedTitle: 'Tenant B Test Showroom',
  },
] as const

const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
] as const

async function assertNoOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  )
  expect(overflow, 'page must not overflow horizontally').toBe(false)
}

test.describe('two-showroom public matrix', () => {
  test.slow()

  test('both showrooms render their own home, inventory, and detail on desktop and mobile', async ({
    page,
  }) => {
    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })

      for (const showroom of showrooms) {
        const routes = [
          { path: '/', heading: showroom.homeHeading },
          { path: '/cars', heading: showroom.inventoryHeading },
          { path: `/cars/${showroom.detailSlug}`, heading: showroom.detailHeading },
        ]

        for (const route of routes) {
          await page.goto(`${showroom.origin}${route.path}`, {
            waitUntil: 'domcontentloaded',
            timeout: 180_000,
          })

          await expect(
            page.getByRole('heading', { level: 1, name: route.heading, exact: true }).first(),
          ).toBeVisible({ timeout: 30_000 })

          const body = await page.locator('body').innerText()
          expect(body).toContain(showroom.name)
          expect(body).not.toContain(showroom.forbidden)
          expect(body).not.toContain(`/cars/${showroom.otherDetailSlug}`)
          await assertNoOverflow(page)
        }
      }
    }
  })

  test('tenant inventory and detail pages keep cross-tenant slugs unreachable', async () => {
    for (const showroom of showrooms) {
      const crossTenant = await requestRaw(showroom.host, `/cars/${showroom.otherDetailSlug}`)
      expect(crossTenant.status).toBe(404)
      expect(crossTenant.body).not.toContain(showroom.forbidden)
    }
  })
})

test.describe('tenant SEO and crawl surfaces', () => {
  test('each host ships its own metadata, sitemap, and robots rules', async () => {
    for (const showroom of showrooms) {
      const home = await requestRaw(showroom.host, '/')
      expect(home.status).toBe(200)
      expect(title(home.body)).toContain(showroom.expectedTitle)
      expect(canonical(home.body)).toBe(showroom.origin)
      expect(home.body).not.toContain(showroom.forbidden)

      const robots = await requestRaw(showroom.host, '/robots.txt')
      expect(robots.status).toBe(200)
      expect(robots.body).toContain('Disallow: /admin/')
      expect(robots.body).toContain('Disallow: /platform')
      expect(robots.body).toContain('Disallow: /api/')
      expect(robots.body).toContain(`${showroom.origin}/sitemap.xml`)

      const sitemap = await requestRaw(showroom.host, '/sitemap.xml')
      expect(sitemap.status).toBe(200)
      expect(sitemap.body).toContain(`${showroom.origin}/cars/${showroom.detailSlug}`)
      expect(sitemap.body).not.toContain(`/cars/${showroom.otherDetailSlug}`)
    }
  })
})

test.describe('failure states', () => {
  test('unknown hosts, vehicles, and routes fail safely', async () => {
    const unknownHost = await requestRaw('unknown.otoweb.id', '/')
    expect(unknownHost.status).toBe(404)
    expect(unknownHost.body).toContain('Halaman tidak ditemukan')
    expect(unknownHost.body).not.toContain('Prima Auto Gallery')
    expect(unknownHost.body).not.toContain('Tenant B Test Showroom')

    const unknownVehicle = await requestRaw(PRIMA_HOST, '/cars/does-not-exist')
    expect(unknownVehicle.status).toBe(404)
    expect(unknownVehicle.body).toContain('Mobil tidak ditemukan')

    const unknownRoute = await requestRaw(PRIMA_HOST, '/this-route-does-not-exist')
    expect(unknownRoute.status).toBe(404)
    expect(unknownRoute.body).toContain('Halaman tidak ditemukan')
  })

  test('the analytics beacon is quiet for malformed, oversized, unknown-host, and wrong-method input', async () => {
    const malformed = await requestRaw(PRIMA_HOST, '/api/public/analytics', {
      method: 'POST',
      body: '{not-json',
      headers: { 'content-type': 'application/json' },
    })
    expect(malformed.status).toBe(204)
    expect(malformed.body).toBe('')

    const oversized = await requestRaw(PRIMA_HOST, '/api/public/analytics', {
      method: 'POST',
      body: JSON.stringify({ eventType: 'vehicle_view', path: `/${'x'.repeat(10_000)}` }),
      headers: { 'content-type': 'application/json' },
    })
    expect(oversized.status).toBe(204)

    const unknownHost = await requestRaw('unknown.otoweb.id', '/api/public/analytics', {
      method: 'POST',
      body: JSON.stringify({ eventType: 'vehicle_view' }),
      headers: { 'content-type': 'application/json' },
    })
    expect(unknownHost.status).toBe(204)

    const wrongMethod = await requestRaw(PRIMA_HOST, '/api/public/analytics')
    expect(wrongMethod.status).toBe(405)
  })
})

test.describe('warm-route performance audit', () => {
  test.slow()

  test('both showrooms stay inside the documented local performance budget', async ({ page }) => {
    const measurements: {
      host: string
      path: string
      ttfbMs: number
      domContentLoadedMs: number
      transferBytes: number
      resources: number
    }[] = []

    for (const showroom of showrooms) {
      for (const path of ['/', '/cars']) {
        const url = `${showroom.origin}${path}`
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 180_000 })
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 180_000 })

        const timing = await page.evaluate(() => {
          const navigation = performance.getEntriesByType('navigation')[0] as
            | PerformanceNavigationTiming
            | undefined
          const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[]
          return {
            ttfbMs: navigation ? navigation.responseStart : 0,
            domContentLoadedMs: navigation ? navigation.domContentLoadedEventEnd : 0,
            transferBytes: resources.reduce(
              (total, resource) => total + (resource.transferSize || 0),
              0,
            ),
            resources: resources.length,
          }
        })

        expect(timing.ttfbMs, `${url} TTFB`).toBeLessThan(3_000)
        expect(timing.domContentLoadedMs, `${url} DOMContentLoaded`).toBeLessThan(8_000)
        expect(timing.transferBytes, `${url} transfer`).toBeLessThan(15_000_000)
        measurements.push({ host: showroom.host, path, ...timing })
      }
    }

    await mkdir('.visual-qa/reports', { recursive: true })
    await writeFile(
      '.visual-qa/reports/f016-performance.json',
      `${JSON.stringify({ capturedAt: new Date().toISOString(), measurements }, null, 2)}\n`,
    )
  })
})
