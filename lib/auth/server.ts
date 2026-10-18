import { redirect } from 'next/navigation'

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
 */
export async function requireAdminUser(): Promise<AuthUser> {
  const user = await getCurrentUser()
  if (!user) redirect('/login?next=/admin')
  return user
}
