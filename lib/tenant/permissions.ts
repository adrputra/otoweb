import type {
  TenantCapability,
  TenantContext,
  TenantRole,
} from './types'

const OWNER_CAPABILITIES: readonly TenantCapability[] = [
  'view',
  'manage_vehicles',
  'manage_leads',
  'manage_staff',
  'manage_settings',
]

const STAFF_CAPABILITIES: readonly TenantCapability[] = [
  'view',
  'manage_vehicles',
  'manage_leads',
]

/** Documented capability matrix. Platform administrators receive every capability. */
export const ROLE_CAPABILITIES: Readonly<
  Record<TenantRole, ReadonlySet<TenantCapability>>
> = {
  platform_admin: new Set(OWNER_CAPABILITIES),
  owner: new Set(OWNER_CAPABILITIES),
  staff: new Set(STAFF_CAPABILITIES),
}

export type CapabilityResult =
  | { ok: true }
  | { ok: false; error: 'forbidden' }

/** Pure capability check. A missing context can never grant a capability. */
export function can(
  context: TenantContext | null | undefined,
  capability: TenantCapability,
): boolean {
  if (!context) return false
  if (context.isPlatformAdmin || context.role === 'platform_admin') return true

  return ROLE_CAPABILITIES[context.role].has(capability)
}

export function assertCapability(
  context: TenantContext | null | undefined,
  capability: TenantCapability,
): CapabilityResult {
  return can(context, capability) ? { ok: true } : { ok: false, error: 'forbidden' }
}
