/** Roles stored on `tenant_members.role`. */
export type TenantRole = 'platform_admin' | 'owner' | 'staff'

/** Tenant lifecycle status. `active` and `trial` participate in access decisions. */
export type TenantStatus = 'active' | 'suspended' | 'trial' | 'disabled'

export type TenantCapability =
  | 'view'
  | 'manage_vehicles'
  | 'manage_leads'
  | 'manage_staff'
  | 'manage_settings'

export interface TenantIdentity {
  id: string
  name: string
  slug: string
  status: TenantStatus
  plan: string
}

export interface TenantMembership {
  id: string
  tenantId: string
  userId: string
  role: TenantRole
  status: string
  tenant: TenantIdentity
}

export interface TenantContext {
  userId: string
  tenant: TenantIdentity
  role: TenantRole
  /** Null only for a platform administrator acting on a tenant they do not belong to. */
  membershipId: string | null
  isPlatformAdmin: boolean
}

export type TenantDenialCode =
  | 'unauthenticated'
  | 'no_membership'
  | 'inactive_membership'
  | 'tenant_unavailable'
  | 'tenant_mismatch'
  | 'unknown_tenant'
  | 'ambiguous'

export type TenantContextResult =
  | { ok: true; context: TenantContext }
  | { ok: false; error: TenantDenialCode }

export type HostnameDenialCode = 'unknown_hostname' | 'tenant_unavailable'

export type HostnameTenantResult =
  | { ok: true; tenant: TenantIdentity }
  | { ok: false; error: HostnameDenialCode }

export type TenantAccessError =
  | { ok: false; error: 'forbidden' }
  | { ok: false; error: 'tenant_mismatch' }

export type TenantAccessResult =
  | { ok: true; context: TenantContext }
  | { ok: false; error: 'forbidden' | 'tenant_mismatch' | TenantDenialCode }

/** Tenant states that may serve requests. */
export const USABLE_TENANT_STATUSES: readonly TenantStatus[] = ['active', 'trial']

export function isUsableTenantStatus(status: TenantStatus): boolean {
  return USABLE_TENANT_STATUSES.includes(status)
}
