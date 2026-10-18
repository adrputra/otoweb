// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  buildDnsInstructions,
  generateVerificationToken,
  resolveCnameTarget,
  verificationRecordName,
  verificationRecordValue,
} from '@/lib/domains/dns'
import { FakeDomainProvider } from '@/lib/domains/fake-provider'
import { HttpDomainProvider } from '@/lib/domains/http-provider'
import {
  createDomainProvider,
  resolveDomainProviderKind,
} from '@/lib/domains/provider'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('DNS instructions', () => {
  it('builds stable TXT and CNAME records', () => {
    expect(
      buildDnsInstructions({
        hostname: 'Showroom.Example.com',
        token: 'fixed-token',
        cnameTarget: 'otoweb.id',
      }),
    ).toEqual([
      {
        type: 'TXT',
        name: '_otoweb-verify.showroom.example.com',
        value: 'otoweb-verify=fixed-token',
        ttl: 300,
        purpose: 'Verifikasi kepemilikan domain',
      },
      {
        type: 'CNAME',
        name: 'showroom.example.com',
        value: 'otoweb.id',
        ttl: 300,
        purpose: 'Arahkan trafik ke platform',
      },
    ])
  })

  it('generates distinct URL-safe tokens', () => {
    const first = generateVerificationToken()
    const second = generateVerificationToken()

    expect(first).toMatch(/^[A-Za-z0-9_-]{16,}$/)
    expect(second).not.toBe(first)
    expect(verificationRecordName('showroom.example.com')).toBe(
      '_otoweb-verify.showroom.example.com',
    )
    expect(verificationRecordValue(first)).toBe(`otoweb-verify=${first}`)
  })

  it('honors the configured CNAME target and ignores malformed values', () => {
    expect(resolveCnameTarget({ CUSTOM_DOMAIN_CNAME_TARGET: 'edge.otoweb.id' })).toBe(
      'edge.otoweb.id',
    )
    expect(
      resolveCnameTarget({
        CUSTOM_DOMAIN_CNAME_TARGET: 'bad target',
        TENANT_ROOT_DOMAIN: 'otoweb.test',
      }),
    ).toBe('otoweb.test')
    expect(resolveCnameTarget({})).toBe('otoweb.id')
  })
})

describe('fake provider', () => {
  it('defaults to verified and active and records calls', async () => {
    const provider = new FakeDomainProvider()
    const dns = await provider.verifyDns({
      hostname: 'showroom.example.com',
      token: 'token',
      recordName: '_otoweb-verify.showroom.example.com',
      recordValue: 'otoweb-verify=token',
    })
    const ssl = await provider.provisionCertificate({ hostname: 'showroom.example.com' })

    expect(dns.status).toBe('verified')
    expect(ssl).toMatchObject({ status: 'active', certificateId: expect.any(String) })
    expect(provider.calls).toHaveLength(2)
  })

  it('supports per-host outcomes', async () => {
    const provider = new FakeDomainProvider({
      dns: 'pending',
      ssl: 'failed',
      dnsByHostname: { 'ready.example.com': 'verified' },
      sslByHostname: { 'ready.example.com': 'active' },
    })

    const pending = await provider.verifyDns({
      hostname: 'pending.example.com',
      token: 'token',
      recordName: 'record',
      recordValue: 'value',
    })
    const ready = await provider.verifyDns({
      hostname: 'ready.example.com',
      token: 'token',
      recordName: 'record',
      recordValue: 'value',
    })
    const sslReady = await provider.provisionCertificate({ hostname: 'ready.example.com' })
    const sslFailed = await provider.provisionCertificate({ hostname: 'other.example.com' })

    expect(pending.status).toBe('pending')
    expect(ready.status).toBe('verified')
    expect(sslReady.status).toBe('active')
    expect(sslFailed.status).toBe('failed')
  })
})

describe('provider selection', () => {
  it('uses the fake provider in development and tests', () => {
    expect(resolveDomainProviderKind({ NODE_ENV: 'development' })).toBe('fake')
    expect(resolveDomainProviderKind({ NODE_ENV: 'test' })).toBe('fake')
    expect(createDomainProvider({ NODE_ENV: 'development' })).toBeInstanceOf(
      FakeDomainProvider,
    )
  })

  it('fails closed in production without a configured provider', async () => {
    expect(resolveDomainProviderKind({ NODE_ENV: 'production' })).toBe('unconfigured')

    const provider = createDomainProvider({ NODE_ENV: 'production' })
    await expect(
      provider.verifyDns({
        hostname: 'showroom.example.com',
        token: 'token',
        recordName: 'record',
        recordValue: 'value',
      }),
    ).resolves.toMatchObject({ status: 'failed' })
    await expect(
      provider.provisionCertificate({ hostname: 'showroom.example.com' }),
    ).resolves.toMatchObject({ status: 'failed' })
  })

  it('never uses the fake provider in production', async () => {
    const provider = createDomainProvider({
      NODE_ENV: 'production',
      DOMAIN_PROVIDER: 'fake',
    })

    await expect(
      provider.verifyDns({
        hostname: 'showroom.example.com',
        token: 'token',
        recordName: 'record',
        recordValue: 'value',
      }),
    ).resolves.toMatchObject({ status: 'failed' })
  })

  it('requires URL and token for the HTTP provider', async () => {
    const provider = createDomainProvider({
      NODE_ENV: 'production',
      DOMAIN_PROVIDER: 'http',
    })

    await expect(
      provider.verifyDns({
        hostname: 'showroom.example.com',
        token: 'token',
        recordName: 'record',
        recordValue: 'value',
      }),
    ).resolves.toMatchObject({ status: 'failed' })
  })

  it('builds the HTTP provider when configured', () => {
    const provider = createDomainProvider({
      NODE_ENV: 'production',
      DOMAIN_PROVIDER: 'http',
      DOMAIN_PROVIDER_URL: 'https://provisioner.example.internal',
      DOMAIN_PROVIDER_TOKEN: 'server-only-token',
    })

    expect(provider).toBeInstanceOf(HttpDomainProvider)
  })
})

describe('HTTP provider adapter', () => {
  it('sends the bearer credential and parses DNS/certificate responses', async () => {
    const calls: { url: string; init: RequestInit | undefined }[] = []
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init })
      if (String(url).endsWith('/verify-dns')) {
        return new Response(JSON.stringify({ status: 'verified', message: 'ok' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }
      return new Response(
        JSON.stringify({ status: 'active', certificateId: 'cert-1', message: 'issued' }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      )
    })

    const provider = new HttpDomainProvider({
      baseUrl: 'https://provisioner.example.internal/',
      token: 'server-only-token',
      fetchImpl,
    })

    const dns = await provider.verifyDns({
      hostname: 'showroom.example.com',
      token: 'token',
      recordName: '_otoweb-verify.showroom.example.com',
      recordValue: 'otoweb-verify=token',
    })
    const ssl = await provider.provisionCertificate({ hostname: 'showroom.example.com' })

    expect(dns.status).toBe('verified')
    expect(ssl).toMatchObject({ status: 'active', certificateId: 'cert-1' })
    expect(calls[0]?.url).toBe('https://provisioner.example.internal/verify-dns')
    expect((calls[0]?.init?.headers as Record<string, string>).authorization).toBe(
      'Bearer server-only-token',
    )
    expect(calls[1]?.url).toBe('https://provisioner.example.internal/certificates')
  })

  it('fails closed on HTTP errors and malformed statuses', async () => {
    const httpError = new HttpDomainProvider({
      baseUrl: 'https://provisioner.example.internal',
      token: 'token',
      fetchImpl: async () => new Response('nope', { status: 503 }),
    })
    await expect(
      httpError.verifyDns({
        hostname: 'showroom.example.com',
        token: 'token',
        recordName: 'record',
        recordValue: 'value',
      }),
    ).resolves.toMatchObject({ status: 'failed' })

    const malformed = new HttpDomainProvider({
      baseUrl: 'https://provisioner.example.internal',
      token: 'token',
      fetchImpl: async () =>
        new Response(JSON.stringify({ status: 'unknown' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    })
    await expect(
      malformed.provisionCertificate({ hostname: 'showroom.example.com' }),
    ).resolves.toMatchObject({ status: 'failed' })
  })
})
