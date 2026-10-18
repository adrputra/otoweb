/** Tenant lifecycle status stored on `tenants.status`. */
export const PLATFORM_TENANT_STATUSES = [
  'active',
  'trial',
  'suspended',
  'disabled',
] as const

export type PlatformTenantStatus = (typeof PLATFORM_TENANT_STATUSES)[number]

export type PlatformMemberRole = 'platform_admin' | 'owner' | 'staff'

export interface PlatformTenantDomain {
  id: string
  hostname: string
  type: 'platform_subdomain' | 'custom_domain'
  status: string
  verifiedAt: string | null
  createdAt: string
}

export interface PlatformTenantMember {
  id: string
  userId: string
  fullName: string | null
  role: PlatformMemberRole
  status: string
  createdAt: string
}

export interface PlatformTenantSummary {
  id: string
  name: string
  slug: string
  status: PlatformTenantStatus
  plan: string
  theme: string
  hostnames: string[]
  ownerCount: number
  memberCount: number
  vehicleCount: number
  leadCount: number
  createdAt: string
  updatedAt: string
}

export interface PlatformTenantDetail extends PlatformTenantSummary {
  domains: PlatformTenantDomain[]
  members: PlatformTenantMember[]
  owners: PlatformTenantMember[]
  showroomDisplayName: string | null
}

export type PlatformServiceError = 'invalid' | 'not_found' | 'conflict' | 'forbidden'

export type PlatformResult<T> =
  | { ok: true; data: T }
  | {
      ok: false
      error: PlatformServiceError
      message: string
      fieldErrors?: Record<string, string[]>
    }
