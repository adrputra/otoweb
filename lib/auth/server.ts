import { redirect } from 'next/navigation'
import { connection } from 'next/server'

import { requireTenantContext } from '@/lib/tenant/server'

import { resolveSessionUser } from './session'
import { createServerAuthBackend } from './supabase-server'
import type { AuthUser } from './types'

/**
 * Resolve the current server-verified user. Any configuration or provider
 * failure is treated as an anonymous session.
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const auth = await createServerAuthBackend()
    return await resolveSessionUser(auth)
  } catch {
    return null
  }
}

/**
 * Defense-in-depth guard for the admin layout. The proxy is the primary
 * boundary; this guard ensures a rendering mistake cannot expose admin content.
 *
 * Authentication alone is not enough: the request must also resolve to a valid,
 * unambiguous tenant membership. A tenant denial redirects to the public home
 * instead of rendering an admin surface.
 */
export async function requireAdminUser(): Promise<AuthUser> {
  // Authentication and tenant context are per-request decisions. Forcing a
  // dynamic render prevents a build-time "anonymous" result from being baked
  // into a static admin page.
  await connection()

  const user = await getCurrentUser()
  if (!user) redirect('/login?next=/admin')
  await requireTenantContext(user)
  return user
}
