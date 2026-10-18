import { cache } from 'react'
import { headers } from 'next/headers'

import { getAppDatabase, type AppDatabase } from '@/lib/db/runtime'
import { findTenantByHostname } from '@/lib/tenant/hostname'
import { findTenantBySlug } from '@/lib/tenant/memberships'
import { assertServerOnly } from '@/lib/tenant/server'
import type { TenantIdentity } from '@/lib/tenant/types'

const DEFAULT_DEVELOPMENT_SLUG = 'prima-auto-gallery'

export interface PublicTenantDependencies {
  db?: AppDatabase
  hostname?: string | null
}

async function readHostname(deps: PublicTenantDependencies): Promise<string | null> {
  if (Object.prototype.hasOwnProperty.call(deps, 'hostname')) {
    return deps.hostname ?? null
  }

  const requestHeaders = await headers()
  return requestHeaders.get('host')
}

/**
 * Resolve the tenant that owns a public request.
 *
 * The verified hostname is authoritative. In development only, an unmatched
 * local hostname falls back to the configured showroom slug so `next dev` works
 * without host mapping. Production never falls back to another tenant.
 */
export async function resolvePublicTenant(
  deps: PublicTenantDependencies = {},
): Promise<TenantIdentity | null> {
  assertServerOnly('lib/public/tenant')

  const db = deps.db ?? (await getAppDatabase())
  const hostname = await readHostname(deps)

  try {
    const result = await findTenantByHostname(db, hostname)
    if (result.ok) return result.tenant

    if (process.env.NODE_ENV === 'development') {
      const slug = process.env.NEXT_PUBLIC_SHOWROOM_SLUG?.trim() || DEFAULT_DEVELOPMENT_SLUG
      return findTenantBySlug(db, slug)
    }

    return null
  } catch {
    // A public page must never fall back to another tenant or mock data when
    // resolution fails. The caller renders not-found instead.
    return null
  }
}

/** Request-scoped memoization for the public tenant. */
export const getPublicTenant = cache(async () => resolvePublicTenant())
