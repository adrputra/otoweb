import {
  isUsableTenantStatus,
  type TenantContext,
  type TenantContextResult,
  type TenantIdentity,
  type TenantMembership,
  type TenantRole,
} from './types'

export interface ResolveTenantContextInput {
  user: { id: string } | null
  memberships: readonly TenantMembership[]
  /** A tenant selected by a trusted server route. */
  requestedTenant?: TenantIdentity | null
  /** The raw requested id, so an unknown tenant can be reported as such. */
  requestedTenantId?: string | null
  /** The tenant resolved from the request hostname. Null when unknown. */
  hostnameTenant?: TenantIdentity | null
}

function buildContext(
  tenant: TenantIdentity,
  role: TenantRole,
  membershipId: string | null,
  userId: string,
  isPlatformAdmin: boolean,
): TenantContext {
  return { userId, tenant, role, membershipId, isPlatformAdmin }
}

function membershipFor(
  memberships: readonly TenantMembership[],
  tenantId: string,
): TenantMembership | undefined {
  return memberships.find((membership) => membership.tenantId === tenantId)
}

/**
 * Resolve the active tenant for a request.
 *
 * Precedence: explicit requested tenant -> hostname tenant -> single active
 * membership. Conflicts and ambiguity fail closed; no branch ever selects a
 * tenant the user cannot prove a relationship with.
 */
export function resolveTenantContext(input: ResolveTenantContextInput): TenantContextResult {
  const { user } = input
  if (!user) return { ok: false, error: 'unauthenticated' }

  const memberships = input.memberships.filter((membership) => membership.userId === user.id)
  if (memberships.length === 0) return { ok: false, error: 'no_membership' }

  const activeMemberships = memberships.filter((membership) => membership.status === 'active')
  if (activeMemberships.length === 0) {
    return { ok: false, error: 'inactive_membership' }
  }

  const usableMemberships = activeMemberships.filter((membership) =>
    isUsableTenantStatus(membership.tenant.status),
  )
  if (usableMemberships.length === 0) {
    return { ok: false, error: 'tenant_unavailable' }
  }

  const isPlatformAdmin = usableMemberships.some(
    (membership) => membership.role === 'platform_admin',
  )

  const requestedTenant =
    input.requestedTenantId && !input.requestedTenant ? null : (input.requestedTenant ?? null)
  const hostnameTenant = input.hostnameTenant ?? null

  if (input.requestedTenantId && !input.requestedTenant) {
    return { ok: false, error: 'unknown_tenant' }
  }

  if (requestedTenant && hostnameTenant && requestedTenant.id !== hostnameTenant.id) {
    return { ok: false, error: 'tenant_mismatch' }
  }

  const target = requestedTenant ?? hostnameTenant

  if (target) {
    if (!isUsableTenantStatus(target.status)) {
      return { ok: false, error: 'tenant_unavailable' }
    }

    const membership = membershipFor(memberships, target.id)
    if (membership) {
      if (membership.status !== 'active') return { ok: false, error: 'inactive_membership' }
      if (!isUsableTenantStatus(membership.tenant.status)) {
        return { ok: false, error: 'tenant_unavailable' }
      }

      return {
        ok: true,
        context: buildContext(
          membership.tenant,
          membership.role,
          membership.id,
          user.id,
          membership.role === 'platform_admin',
        ),
      }
    }

    if (isPlatformAdmin) {
      return {
        ok: true,
        context: buildContext(target, 'platform_admin', null, user.id, true),
      }
    }

    return { ok: false, error: 'tenant_mismatch' }
  }

  if (usableMemberships.length > 1) {
    return { ok: false, error: 'ambiguous' }
  }

  const membership = usableMemberships[0]
  if (!membership) return { ok: false, error: 'tenant_unavailable' }

  return {
    ok: true,
    context: buildContext(
      membership.tenant,
      membership.role,
      membership.id,
      user.id,
      membership.role === 'platform_admin',
    ),
  }
}
