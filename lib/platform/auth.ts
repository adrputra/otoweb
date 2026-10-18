import { and, eq } from 'drizzle-orm'
import { notFound, redirect } from 'next/navigation'
import { connection } from 'next/server'

import { tenantMembers } from '@/db/schema'
import { getCurrentUser } from '@/lib/auth/server'
import type { AuthUser } from '@/lib/auth/types'
import { getAppDatabase, type AppDatabase } from '@/lib/db/runtime'
import { assertServerOnly } from '@/lib/tenant/server'
import { isUuid } from '@/lib/tenant/session'

/**
 * Explicit platform-operator authorization.
 *
 * A showroom owner or staff membership never grants platform access. The only
 * accepted proof is an active `tenant_members` row with role `platform_admin`.
 * This check is intentionally independent of the request hostname, the active
 * showroom tenant, and that tenant's lifecycle status.
 */
export async function findPlatformOperatorMembership(
  db: AppDatabase,
  userId: string,
): Promise<boolean> {
  if (!isUuid(userId)) return false

  const rows = await db
    .select({ id: tenantMembers.id })
    .from(tenantMembers)
    .where(
      and(
        eq(tenantMembers.userId, userId),
        eq(tenantMembers.role, 'platform_admin'),
        eq(tenantMembers.status, 'active'),
      ),
    )
    .limit(1)

  return rows.length > 0
}

export type PlatformOperatorResolution =
  | { ok: true; user: AuthUser; db: AppDatabase }
  | { ok: false; reason: 'unauthenticated' | 'forbidden' }

export interface PlatformOperatorDependencies {
  getUser?: () => Promise<AuthUser | null>
  getDb?: () => Promise<AppDatabase>
}

/**
 * Resolve the current request to a platform operator. Injectable dependencies
 * keep the boundary testable without a live auth provider.
 */
export async function resolvePlatformOperator(
  deps: PlatformOperatorDependencies = {},
): Promise<PlatformOperatorResolution> {
  assertServerOnly('lib/platform/auth')

  const user = await (deps.getUser ?? getCurrentUser)()
  if (!user) return { ok: false, reason: 'unauthenticated' }

  const db = await (deps.getDb ?? getAppDatabase)()
  if (!(await findPlatformOperatorMembership(db, user.id))) {
    return { ok: false, reason: 'forbidden' }
  }

  return { ok: true, user, db }
}

export interface PlatformPageSession {
  user: AuthUser
  db: AppDatabase
}

/**
 * Page/layout boundary. Unauthenticated requests go to sign-in with a safe
 * `/platform` return path; authenticated non-operators see not-found so the
 * surface is not disclosed.
 */
export async function requirePlatformOperatorPage(): Promise<PlatformPageSession> {
  await connection()

  const result = await resolvePlatformOperator()
  if (!result.ok) {
    if (result.reason === 'unauthenticated') redirect('/login?next=/platform')
    notFound()
  }

  return { user: result.user, db: result.db }
}

/**
 * Server-action boundary. Actions return a typed denial instead of navigating,
 * so a malicious caller cannot turn an XHR into an HTML redirect.
 */
export async function requirePlatformOperatorAction(): Promise<
  | { ok: true; user: AuthUser; db: AppDatabase }
  | { ok: false; reason: 'forbidden' }
> {
  const result = await resolvePlatformOperator()
  if (!result.ok) return { ok: false, reason: 'forbidden' }
  return result
}
