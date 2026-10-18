import http from 'node:http'

import { expect, test } from '@playwright/test'

const PORT = Number(process.env.SEO_TEST_PORT ?? 3000)
const PRIMA_HOST = 'prima.otoweb.id'
const TENANT_B_HOST = 'tenant-b.otoweb.id'
const PRIMA_ORIGIN = `http://${PRIMA_HOST}:${PORT}`
const TENANT_B_ORIGIN = `http://${TENANT_B_HOST}:${PORT}`

const SOLD_SLUG = 'toyota-camry-2019-11'
const DRAFT_SLUG = 'toyota-raize-2022-10'
const FORTUNER_SLUG = 'toyota-fortuner-2021-1'

interface RawResponse {
  status: number
  contentType: string
  body: string
}

/**
 * Fetch the raw server response with an explicit tenant Host header.
 *
 * This deliberately bypasses the browser: SEO acceptance requires the tags to
 * exist in generated HTML/XML, not in a hydrated DOM.
 */
function fetchRaw(host: string, path: string): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        hostname: '127.0.0.1',
        port: PORT,
        path,
        method: 'GET',
        headers: {
          host: `${host}:${PORT}`,
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
    request.end()
  })
}

function metaContent(html: string, attribute: 'name' | 'property', value: string): string | null {
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const patterns = [
    new RegExp(`<meta[^>]+${attribute}="${escaped}"[^>]+content="([^"]*)"`, 'i'),
    new RegExp(`<meta[^>]+content="([^"]*)"[^>]+${attribute}="${escaped}"`, 'i'),
  ]

  for (const pattern of patterns) {
    const match = html.match(pattern)
    if (match?.[1]) return match[1]
  }

  return null
}

function canonical(html: string): string | null {
  return html.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i)?.[1] ?? null
}

function jsonLdBlocks(html: string): Record<string, unknown>[] {
  const blocks: Record<string, unknown>[] = []
  const pattern = /<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi

  for (const match of html.matchAll(pattern)) {
    blocks.push(JSON.parse(match[1] ?? '{}') as Record<string, unknown>)
  }

  return blocks
}

function sitemapLocations(xml: string): string[] {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1] ?? '')
}

test.describe('generated HTML metadata', () => {
  test('home ships tenant title, description, canonical, OpenGraph, and LocalBusiness JSON-LD', async () => {
    const response = await fetchRaw(PRIMA_HOST, '/')

    expect(response.status).toBe(200)
    expect(response.contentType).toContain('text/html')

    expect(response.body).toContain(
      '<title>Prima Auto Gallery — Mobil Bekas Berkualitas</title>',
    )
    expect(metaContent(response.body, 'name', 'description')).toBe(
      'Temukan mobil bekas berkualitas dan terinspeksi di Prima Auto Gallery.',
    )
    expect(canonical(response.body)).toBe(PRIMA_ORIGIN)
    expect(metaContent(response.body, 'property', 'og:title')).toBe(
      'Prima Auto Gallery — Mobil Bekas Berkualitas',
    )
    expect(metaContent(response.body, 'property', 'og:url')).toBe(PRIMA_ORIGIN)
    expect(metaContent(response.body, 'property', 'og:site_name')).toBe(
      'Prima Auto Gallery',
    )
    expect(metaContent(response.body, 'property', 'og:type')).toBe('website')

    const showroom = jsonLdBlocks(response.body).find((block) =>
      Array.isArray(block['@type'])
        ? (block['@type'] as string[]).includes('LocalBusiness')
        : block['@type'] === 'LocalBusiness',
    )
    expect(showroom).toMatchObject({
      '@context': 'https://schema.org',
      name: 'Prima Auto Gallery',
      url: `${PRIMA_ORIGIN}/`,
    })
    expect((showroom?.['@type'] as string[]) ?? []).toEqual(
      expect.arrayContaining(['LocalBusiness', 'AutoDealer']),
    )
  })

  test('tenant B receives its own metadata and none of Prima identity', async () => {
    const response = await fetchRaw(TENANT_B_HOST, '/')

    expect(response.status).toBe(200)
    expect(response.body).toContain('<title>Tenant B Test Showroom</title>')
    expect(canonical(response.body)).toBe(TENANT_B_ORIGIN)
    expect(metaContent(response.body, 'property', 'og:site_name')).toBe(
      'Tenant B Test Showroom',
    )
    expect(response.body).not.toContain('Prima Auto Gallery')
    expect(response.body).not.toContain('prima.otoweb.id')
  })

  test('filtered inventory is canonicalized to the clean /cars URL', async () => {
    const response = await fetchRaw(
      PRIMA_HOST,
      '/cars?brand=Toyota&sort=harga-terendah',
    )

    expect(response.status).toBe(200)
    expect(response.body).toContain('<title>Koleksi mobil — Prima Auto Gallery</title>')
    expect(canonical(response.body)).toBe(`${PRIMA_ORIGIN}/cars`)
    expect(metaContent(response.body, 'property', 'og:url')).toBe(`${PRIMA_ORIGIN}/cars`)
  })

  test('vehicle detail uses the roadmap title pattern and self-canonical URL', async () => {
    const response = await fetchRaw(PRIMA_HOST, `/cars/${FORTUNER_SLUG}`)

    expect(response.status).toBe(200)
    expect(response.body).toContain(
      '<title>Toyota Fortuner 2.4 VRZ TRD 2021 Bekas Jakarta Selatan | Prima Auto Gallery</title>',
    )
    expect(canonical(response.body)).toBe(`${PRIMA_ORIGIN}/cars/${FORTUNER_SLUG}`)
    expect(metaContent(response.body, 'property', 'og:image')).toContain(
      'images.unsplash.com',
    )

    const vehicle = jsonLdBlocks(response.body).find((block) => block['@type'] === 'Vehicle')
    expect(vehicle).toMatchObject({
      '@type': 'Vehicle',
      name: 'Toyota Fortuner 2.4 VRZ TRD',
      url: `${PRIMA_ORIGIN}/cars/${FORTUNER_SLUG}`,
    })
    expect(vehicle?.offers).toMatchObject({
      '@type': 'Offer',
      priceCurrency: 'IDR',
      availability: 'https://schema.org/InStock',
    })
  })
})

test.describe('sold listing handling', () => {
  test('sold detail stays reachable, indexable, self-canonical, and SoldOut', async () => {
    const response = await fetchRaw(PRIMA_HOST, `/cars/${SOLD_SLUG}`)

    expect(response.status).toBe(200)
    expect(response.body).toContain('Terjual')
    expect(canonical(response.body)).toBe(`${PRIMA_ORIGIN}/cars/${SOLD_SLUG}`)
    expect(metaContent(response.body, 'name', 'robots')).not.toContain('noindex')

    const vehicle = jsonLdBlocks(response.body).find((block) => block['@type'] === 'Vehicle')
    expect(vehicle?.offers).toMatchObject({
      availability: 'https://schema.org/SoldOut',
    })

    const related = response.body.match(/Mungkin Anda juga suka/)
    expect(related).not.toBeNull()

    const sitemap = await fetchRaw(PRIMA_HOST, '/sitemap.xml')
    expect(sitemapLocations(sitemap.body)).toContain(
      `${PRIMA_ORIGIN}/cars/${SOLD_SLUG}`,
    )
  })
})

test.describe('tenant-specific crawl surfaces', () => {
  test('Prima sitemap contains only Prima URLs and excludes the draft', async () => {
    const response = await fetchRaw(PRIMA_HOST, '/sitemap.xml')

    expect(response.status).toBe(200)
    expect(response.contentType).toMatch(/xml/)

    const locations = sitemapLocations(response.body)
    expect(locations).toContain(`${PRIMA_ORIGIN}/`)
    expect(locations).toContain(`${PRIMA_ORIGIN}/cars`)
    expect(locations).toContain(`${PRIMA_ORIGIN}/cars/${FORTUNER_SLUG}`)
    expect(locations).toContain(`${PRIMA_ORIGIN}/cars/${SOLD_SLUG}`)
    expect(locations).not.toContain(`${PRIMA_ORIGIN}/cars/${DRAFT_SLUG}`)
    expect(locations.every((url) => url.startsWith(PRIMA_ORIGIN))).toBe(true)
    expect(locations.some((url) => url.includes(TENANT_B_HOST))).toBe(false)
  })

  test('Tenant B sitemap contains only Tenant B URLs', async () => {
    const response = await fetchRaw(TENANT_B_HOST, '/sitemap.xml')

    expect(response.status).toBe(200)

    const locations = sitemapLocations(response.body)
    expect(locations).toContain(`${TENANT_B_ORIGIN}/`)
    expect(locations).toContain(`${TENANT_B_ORIGIN}/cars`)
    expect(locations.every((url) => url.startsWith(TENANT_B_ORIGIN))).toBe(true)
    expect(locations.some((url) => url.includes(PRIMA_HOST))).toBe(false)
    expect(locations).not.toContain(`${TENANT_B_ORIGIN}/cars/${FORTUNER_SLUG}`)
  })

  test('robots.txt references the request host sitemap and blocks private routes', async () => {
    const prima = await fetchRaw(PRIMA_HOST, '/robots.txt')
    const tenantB = await fetchRaw(TENANT_B_HOST, '/robots.txt')

    expect(prima.status).toBe(200)
    expect(prima.contentType).toContain('text/plain')
    expect(prima.body).toContain('User-Agent: *')
    expect(prima.body).toContain('Allow: /')
    expect(prima.body).toContain('Disallow: /admin/')
    expect(prima.body).toContain('Disallow: /api/')
    expect(prima.body).toContain(`Sitemap: ${PRIMA_ORIGIN}/sitemap.xml`)

    expect(tenantB.body).toContain(`Sitemap: ${TENANT_B_ORIGIN}/sitemap.xml`)
    expect(tenantB.body).not.toContain(PRIMA_ORIGIN)
  })
})
