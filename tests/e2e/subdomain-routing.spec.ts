import http from 'node:http'

import { expect, test } from '@playwright/test'

const PORT = Number(process.env.SUBDOMAIN_TEST_PORT ?? 3000)

const PRIMA_HOST = 'prima.otoweb.id'
const TENANT_B_HOST = 'tenant-b.otoweb.id'
const PRIMA_WILDCARD_HOST = 'prima-auto-gallery.otoweb.id'
const TENANT_B_WILDCARD_HOST = 'tenant-b-test-showroom.otoweb.id'
const PRIMA_LOCAL_HOST = 'prima.localhost'
const TENANT_B_LOCAL_HOST = 'tenant-b.localhost'

const PRIMA_EMAIL = 'halo@primaauto.id'
const PRIMA_PHONE = '+62217654321'
const TENANT_B_EMAIL = 'hello@tenant-b.test'
const TENANT_B_PHONE = '+622100000002'

interface RawResponse {
  status: number
  contentType: string
  body: string
}

/**
 * Fetch the raw server response with an explicit tenant Host header.
 *
 * The production-shaped and localhost hostnames all reach the same server on
 * 127.0.0.1; the Host header is the only routing input. This proves server-side
 * resolution without a browser or a per-host deployment.
 */
function fetchRaw(host: string, path = '/'): Promise<RawResponse> {
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

test.describe('production-shaped tenant hosts', () => {
  test('Prima host serves Prima branding, inventory, and contact details only', async () => {
    const response = await fetchRaw(PRIMA_HOST)

    expect(response.status).toBe(200)
    expect(response.contentType).toContain('text/html')
    expect(response.body).toContain('Prima Auto Gallery')
    expect(response.body).toContain(PRIMA_EMAIL)
    expect(response.body).toContain(PRIMA_PHONE)
    expect(response.body).toContain('/cars/toyota-fortuner-2021-1')
    expect(response.body).not.toContain('Tenant B Test Showroom')
    expect(response.body).not.toContain(TENANT_B_EMAIL)
    expect(response.body).not.toContain(TENANT_B_PHONE)
  })

  test('Tenant B host serves Tenant B branding and contact details without Prima data', async () => {
    const response = await fetchRaw(TENANT_B_HOST)

    expect(response.status).toBe(200)
    expect(response.body).toContain('Tenant B Test Showroom')
    expect(response.body).toContain(TENANT_B_EMAIL)
    expect(response.body).toContain(TENANT_B_PHONE)
    expect(response.body).not.toContain('Prima Auto Gallery')
    expect(response.body).not.toContain(PRIMA_EMAIL)
    expect(response.body).not.toContain(PRIMA_PHONE)
    expect(response.body).not.toContain('/cars/toyota-fortuner-2021-1')
  })

  test('inventory is tenant-scoped across the two hostnames', async () => {
    const prima = await fetchRaw(PRIMA_HOST, '/cars')
    const tenantB = await fetchRaw(TENANT_B_HOST, '/cars')

    expect(prima.status).toBe(200)
    expect(prima.body).toContain('Koleksi mobil')
    expect(prima.body).toContain('/cars/toyota-fortuner-2021-1')
    expect(prima.body).not.toContain('Tenant B Test Showroom')

    expect(tenantB.status).toBe(200)
    expect(tenantB.body).toContain('Tenant B Test Showroom')
    expect(tenantB.body).toMatch(/0(?:<!-- -->)? unit/)
    expect(tenantB.body).toContain('Belum ada unit yang sesuai')
    expect(tenantB.body).not.toContain('/cars/toyota-fortuner-2021-1')
    expect(tenantB.body).not.toContain('Prima Auto Gallery')
  })
})

test.describe('wildcard slug hosts', () => {
  test('a slug subdomain resolves without an exact domain record', async () => {
    const prima = await fetchRaw(PRIMA_WILDCARD_HOST)
    const tenantB = await fetchRaw(TENANT_B_WILDCARD_HOST)

    expect(prima.status).toBe(200)
    expect(prima.body).toContain('Prima Auto Gallery')
    expect(prima.body).not.toContain('Tenant B Test Showroom')

    expect(tenantB.status).toBe(200)
    expect(tenantB.body).toContain('Tenant B Test Showroom')
    expect(tenantB.body).not.toContain('Prima Auto Gallery')
  })
})

test.describe('development localhost hosts', () => {
  test('short localhost aliases render their own showrooms', async () => {
    const prima = await fetchRaw(PRIMA_LOCAL_HOST)
    const tenantB = await fetchRaw(TENANT_B_LOCAL_HOST)

    expect(prima.status).toBe(200)
    expect(prima.body).toContain('Prima Auto Gallery')
    expect(prima.body).toContain(PRIMA_EMAIL)
    expect(prima.body).not.toContain('Tenant B Test Showroom')

    expect(tenantB.status).toBe(200)
    expect(tenantB.body).toContain('Tenant B Test Showroom')
    expect(tenantB.body).toContain(TENANT_B_EMAIL)
    expect(tenantB.body).not.toContain('Prima Auto Gallery')
  })
})

test.describe('unknown hosts fail closed', () => {
  test('unknown production and local subdomains return not-found', async () => {
    const production = await fetchRaw('unknown.otoweb.id')
    const local = await fetchRaw('unknown.localhost')

    expect(production.status).toBe(404)
    expect(local.status).toBe(404)
    expect(production.body).not.toContain('Prima Auto Gallery')
    expect(local.body).not.toContain('Prima Auto Gallery')
  })
})
