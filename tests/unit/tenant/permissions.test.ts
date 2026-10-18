import { describe, expect, it } from 'vitest'

import { resolveTenantContext } from '@/lib/tenant/context'
import {
  assertContextTenant,
  authorizeTenantAccess,
  requireTenantAccess,
} from '@/lib/tenant/guards'
import { ROLE_CAPABILITIES, assertCapability, can } from '@/lib/tenant/permissions'
import type {
  TenantCapability,
  TenantContext,
  TenantIdentity,
  TenantMembership,
  TenantRole,
} from '@/lib/tenant/types'

import { prima, tenantB } from './fixtures'

const capabilities: TenantCapability[] = [
  'view',
  'manage_vehicles',
  'manage_leads',
  'manage_staff',
  'manage_settings',
]

const primaTenant: TenantIdentity = {
  id: prima.tenantId,
  name: prima.tenantName,
  slug: prima.tenantSlug,
  status: prima.tenantStatus,
  plan: 'starter',
}

const tenantBTenant: TenantIdentity = {
  id: tenantB.tenantId,
  name: tenantB.tenantName,
  slug: tenantB.tenantSlug,
  status: tenantB.tenantStatus,
  plan: 'trial',
}

function context(role: TenantRole, tenant: TenantIdentity = primaTenant): TenantContext {
  return {
    userId: prima.profileId,
    tenant,
    role,
    membershipId: prima.memberId,
    isPlatformAdmin: role === 'platform_admin',
  }
}

function membership(
  role: TenantRole,
  status = 'active',
  tenant: TenantIdentity = primaTenant,
): TenantMembership {
  return {
    id: prima.memberId,
    tenantId: tenant.id,
    userId: prima.profileId,
    role,
    status,
    tenant,
  }
}

describe('permission matrix', () => {
  it('grants an owner every capability', () => {
    for (const capability of capabilities) {
      expect(can(context('owner'), capability), capability).toBe(true)
    }
  })

  it('grants staff vehicle and lead capabilities only', () => {
    expect(can(context('staff'), 'view')).toBe(true)
    expect(can(context('staff'), 'manage_vehicles')).toBe(true)
    expect(can(context('staff'), 'manage_leads')).toBe(true)
    expect(can(context('staff'), 'manage_staff')).toBe(false)
    expect(can(context('staff'), 'manage_settings')).toBe(false)
  })

  it('grants a platform administrator every capability', () => {
    for (const capability of capabilities) {
      expect(can(context('platform_admin', tenantBTenant), capability), capability).toBe(true)
    }
  })

  it('never grants a capability without a context', () => {
    for (const capability of capabilities) {
      expect(can(null, capability)).toBe(false)
      expect(assertCapability(undefined, capability)).toEqual({
        ok: false,
        error: 'forbidden',
      })
    }
  })

  it('exports the documented matrix', () => {
    expect([...ROLE_CAPABILITIES.owner].sort()).toEqual([...capabilities].sort())
    expect([...ROLE_CAPABILITIES.staff].sort()).toEqual(
      ['manage_leads', 'manage_vehicles', 'view'].sort(),
    )
    expect([...ROLE_CAPABILITIES.platform_admin].sort()).toEqual([...capabilities].sort())
  })
})

describe('tenant access guards', () => {
  it('rejects a tenant mismatch before evaluating the role', () => {
    const result = resolveTenantContext({
      user: { id: prima.profileId },
      memberships: [membership('owner')],
    })

    expect(authorizeTenantAccess(result, tenantBTenant.id, 'view')).toEqual({
      ok: false,
      error: 'tenant_mismatch',
    })
  })

  it('propagates context denials unchanged', () => {
    const inactive = resolveTenantContext({
      user: { id: prima.profileId },
      memberships: [membership('owner', 'invited')],
    })

    expect(authorizeTenantAccess(inactive, prima.tenantId, 'view')).toEqual({
      ok: false,
      error: 'inactive_membership',
    })
  })

  it('allows a matching capability', () => {
    const result = resolveTenantContext({
      user: { id: prima.profileId },
      memberships: [membership('staff')],
    })

    const access = authorizeTenantAccess(result, prima.tenantId, 'manage_vehicles')
    expect(access.ok).toBe(true)
    if (!access.ok) return
    expect(access.context.tenant.id).toBe(prima.tenantId)
  })

  it('denies a capability the role lacks', () => {
    const result = resolveTenantContext({
      user: { id: prima.profileId },
      memberships: [membership('staff')],
    })

    expect(authorizeTenantAccess(result, prima.tenantId, 'manage_settings')).toEqual({
      ok: false,
      error: 'forbidden',
    })
  })

  it('allows a platform administrator to act on another tenant', () => {
    const result = resolveTenantContext({
      user: { id: prima.profileId },
      memberships: [membership('platform_admin')],
      requestedTenant: tenantBTenant,
      requestedTenantId: tenantB.tenantId,
    })

    const access = authorizeTenantAccess(result, tenantB.tenantId, 'manage_settings')
    expect(access.ok).toBe(true)
    if (!access.ok) return
    expect(access.context.membershipId).toBeNull()
  })

  it('rejects a malformed tenant id', () => {
    expect(assertContextTenant(context('owner'), 'not-a-uuid')).toEqual({
      ok: false,
      error: 'tenant_mismatch',
    })
  })

  it('throws from the requireTenantAccess wrapper', () => {
    const result = resolveTenantContext({
      user: { id: prima.profileId },
      memberships: [membership('staff')],
    })

    expect(() => requireTenantAccess(result, prima.tenantId, 'manage_staff')).toThrow(
      /Tenant access denied/,
    )
  })
})
