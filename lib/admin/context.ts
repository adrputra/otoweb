import { redirect } from 'next/navigation'
import { connection } from 'next/server'

import { getCurrentUser } from '@/lib/auth/server'
import { getAppDatabase, type AppDatabase } from '@/lib/db/runtime'
import { authorizeTenantAccess } from '@/lib/tenant/guards'
import { assertServerOnly, resolveRequestTenantContext } from '@/lib/tenant/server'
import type { AuthUser } from '@/lib/auth/types'
import type { TenantCapability, TenantContext } from '@/lib/tenant/types'

export interface AdminTenantRequest {
  user: AuthUser
  context: TenantContext
  db: AppDatabase
}

/**
 * Resolve an admin request to a verified user, an authorized tenant context,
 * and the server database. Any denial redirects instead of rendering admin
 * content.
 *
 * Capability is checked here as the first gate; the service/query layer still
 * scopes every statement by the context tenant id.
 */
export async function requireAdminTenantContext(
  capability: TenantCapability = 'manage_vehicles',
): Promise<AdminTenantRequest> {
  assertServerOnly('lib/admin/context')

  // Authentication and tenant context are per-request decisions. Forcing a
  // dynamic render prevents a build-time anonymous result from being baked
  // into a static admin page.
  await connection()

  const user = await getCurrentUser()
  if (!user) redirect('/login?next=/admin')

  const result = await resolveRequestTenantContext(user)
  if (!result.ok) redirect('/')

  const access = authorizeTenantAccess(result, result.context.tenant.id, capability)
  if (!access.ok) redirect('/')

  return { user, context: access.context, db: await getAppDatabase() }
}

export type AdminApiContext =
  | { ok: true; user: AuthUser; context: TenantContext; db: AppDatabase }
  | { ok: false; status: 401 | 403; message: string }

/**
 * API variant of the admin gate.
 *
 * Route handlers cannot call `redirect()` without turning an XHR into a
 * cross-origin HTML navigation, so they receive a typed 401/403 instead. The
 * same server-verified user, tenant resolution, and capability checks run.
 */
export async function requireAdminApiContext(
  capability: TenantCapability = 'manage_vehicles',
): Promise<AdminApiContext> {
  assertServerOnly('lib/admin/context')

  const user = await getCurrentUser()
  if (!user) return { ok: false, status: 401, message: 'Sesi tidak valid. Silakan masuk kembali.' }

  const result = await resolveRequestTenantContext(user)
  if (!result.ok) {
    return { ok: false, status: 403, message: 'Akses showroom ditolak.' }
  }

  const access = authorizeTenantAccess(result, result.context.tenant.id, capability)
  if (!access.ok) {
    return { ok: false, status: 403, message: 'Anda tidak memiliki izin mengelola kendaraan.' }
  }

  return {
    ok: true,
    user,
    context: access.context,
    db: await getAppDatabase(),
  }
}
