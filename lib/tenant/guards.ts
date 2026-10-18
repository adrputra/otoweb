import { can } from './permissions'
import { isUuid } from './session'
import type {
  TenantAccessResult,
  TenantCapability,
  TenantContext,
  TenantContextResult,
} from './types'

/**
 * Verify that a resolved context may act on the requested tenant. This check
 * runs before capability evaluation so a staff role can never be reused across
 * a tenant boundary.
 */
export function assertContextTenant(
  context: TenantContext,
  tenantId: string,
): { ok: true } | { ok: false; error: 'tenant_mismatch' } {
  if (!isUuid(tenantId)) return { ok: false, error: 'tenant_mismatch' }
  if (context.isPlatformAdmin) return { ok: true }
  if (context.tenant.id !== tenantId) return { ok: false, error: 'tenant_mismatch' }

  return { ok: true }
}

/**
 * Data/API guard: propagate context denials, reject tenant mismatches, then
 * check the capability.
 */
export function authorizeTenantAccess(
  result: TenantContextResult,
  tenantId: string,
  capability: TenantCapability,
): TenantAccessResult {
  if (!result.ok) return result

  const tenantCheck = assertContextTenant(result.context, tenantId)
  if (!tenantCheck.ok) return tenantCheck

  if (!can(result.context, capability)) return { ok: false, error: 'forbidden' }

  return { ok: true, context: result.context }
}

/** Throwing variant for code paths that must stop before a scoped query. */
export function requireTenantAccess(
  result: TenantContextResult,
  tenantId: string,
  capability: TenantCapability,
): TenantContext {
  const access = authorizeTenantAccess(result, tenantId, capability)
  if (access.ok) return access.context

  const error = new Error(`Tenant access denied: ${access.error}`)
  error.name = 'TenantAccessDenied'
  throw error
}
