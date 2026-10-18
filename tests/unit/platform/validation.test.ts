import { describe, expect, it } from 'vitest'

import {
  assignOwnerInputSchema,
  createTenantInputSchema,
  normalizePlatformHostname,
  normalizeTenantPlan,
  normalizeTenantSlug,
  registerCustomDomainInputSchema,
  setStatusInputSchema,
  setSubdomainInputSchema,
  toFieldErrors,
  verifyCustomDomainInputSchema,
} from '@/lib/platform/validation'

describe('platform validation primitives', () => {
  it('normalizes slugs and plans to lowercase', () => {
    expect(normalizeTenantSlug('  Prima-New  ')).toBe('prima-new')
    expect(normalizeTenantPlan('  Growth ')).toBe('growth')
  })

  it('normalizes a full hostname', () => {
    expect(normalizePlatformHostname('  New-Showroom.OtoWeb.ID.:443 ')).toBe(
      'new-showroom.otoweb.id',
    )
  })

  it('rejects single-label, malformed, and path-bearing hostnames', () => {
    expect(normalizePlatformHostname('showroom')).toBeNull()
    expect(normalizePlatformHostname('showroom.otoweb.id/path')).toBeNull()
    expect(normalizePlatformHostname('showroom..otoweb.id')).toBeNull()
    expect(normalizePlatformHostname('user@showroom.otoweb.id')).toBeNull()
    expect(normalizePlatformHostname('showroom.otoweb.id:99999')).toBeNull()
    expect(normalizePlatformHostname('')).toBeNull()
    expect(normalizePlatformHostname(null)).toBeNull()
  })
})

describe('create tenant contract', () => {
  it('accepts and normalizes a valid payload', () => {
    const parsed = createTenantInputSchema.safeParse({
      name: '  QA Showroom  ',
      slug: '  QA-Showroom ',
      plan: ' Growth ',
      status: 'trial',
      subdomain: '  QA.OtoWeb.ID ',
      ownerUserId: '',
    })

    expect(parsed.success).toBe(true)
    if (!parsed.success) return
    expect(parsed.data).toMatchObject({
      name: 'QA Showroom',
      slug: 'qa-showroom',
      plan: 'growth',
      status: 'trial',
      subdomain: 'QA.OtoWeb.ID',
    })
  })

  it('rejects invalid slug, plan, status, hostname, and owner id', () => {
    const parsed = createTenantInputSchema.safeParse({
      name: '',
      slug: 'Bad Slug!',
      plan: 'plan with spaces',
      status: 'deleted',
      subdomain: 'not-a-host',
      ownerUserId: 'not-a-uuid',
    })

    expect(parsed.success).toBe(false)
    if (parsed.success) return

    const fields = toFieldErrors(parsed.error.issues)
    expect(fields.name).toBeDefined()
    expect(fields.slug).toBeDefined()
    expect(fields.plan).toBeDefined()
    expect(fields.status).toBeDefined()
    expect(fields.subdomain).toBeDefined()
    expect(fields.ownerUserId).toBeDefined()
  })

  it('treats empty optional values as absent', () => {
    const parsed = createTenantInputSchema.safeParse({
      name: 'Showroom',
      slug: 'showroom',
      plan: 'starter',
      status: 'active',
      subdomain: '',
      ownerUserId: '',
    })

    expect(parsed.success).toBe(true)
    if (!parsed.success) return
    expect(parsed.data.subdomain).toBe('')
    expect(parsed.data.ownerUserId).toBe('')
  })
})

describe('tenant operation contracts', () => {
  it('validates tenant ids and owner ids', () => {
    expect(
      assignOwnerInputSchema.safeParse({
        tenantId: '11111111-1111-4111-8111-111111111111',
        userId: '50000000-0000-4000-8000-000000000003',
      }).success,
    ).toBe(true)

    expect(
      assignOwnerInputSchema.safeParse({ tenantId: 'tenant', userId: 'owner' }).success,
    ).toBe(false)
  })

  it('validates status and hostname changes', () => {
    expect(
      setStatusInputSchema.safeParse({
        tenantId: '11111111-1111-4111-8111-111111111111',
        status: 'disabled',
      }).success,
    ).toBe(true)

    expect(
      setStatusInputSchema.safeParse({
        tenantId: '11111111-1111-4111-8111-111111111111',
        status: 'archived',
      }).success,
    ).toBe(false)

    expect(
      setSubdomainInputSchema.safeParse({
        tenantId: '11111111-1111-4111-8111-111111111111',
        hostname: 'new.otoweb.id',
      }).success,
    ).toBe(true)

    expect(
      setSubdomainInputSchema.safeParse({
        tenantId: '11111111-1111-4111-8111-111111111111',
        hostname: 'bad host',
      }).success,
    ).toBe(false)
  })
})

describe('custom domain contracts', () => {
  it('accepts a full custom hostname', () => {
    const parsed = registerCustomDomainInputSchema.safeParse({
      tenantId: '11111111-1111-4111-8111-111111111111',
      hostname: '  Showroom.Example.COM. ',
    })

    expect(parsed.success).toBe(true)
    if (!parsed.success) return
    expect(parsed.data.hostname).toBe('Showroom.Example.COM.')
  })

  it('rejects malformed, single-label, and path-bearing hostnames', () => {
    for (const hostname of ['not a host', 'single-label', 'showroom.example.com/path', '']) {
      const parsed = registerCustomDomainInputSchema.safeParse({
        tenantId: '11111111-1111-4111-8111-111111111111',
        hostname,
      })
      expect(parsed.success, hostname).toBe(false)
    }
  })

  it('validates tenant and domain ids for verification', () => {
    expect(
      verifyCustomDomainInputSchema.safeParse({
        tenantId: '11111111-1111-4111-8111-111111111111',
        domainId: '70000000-0000-4000-8000-000000000001',
      }).success,
    ).toBe(true)

    expect(
      verifyCustomDomainInputSchema.safeParse({
        tenantId: 'tenant',
        domainId: 'domain',
      }).success,
    ).toBe(false)
  })
})
