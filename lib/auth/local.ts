import { cookies } from 'next/headers'

import { getAppDatabase } from '@/lib/db/runtime'

import { createLocalAuthBackend, type AuthCookieStore } from './local-backend'
import type { AuthBackend } from './types'

/**
 * Request-scoped PostgreSQL auth backend for server actions, route handlers,
 * and server components. A new backend is created on every call; the database
 * client and cookie store are request-scoped.
 */
export async function createServerAuthBackend(): Promise<AuthBackend> {
  const [db, cookieStore] = await Promise.all([getAppDatabase(), cookies()])

  return createLocalAuthBackend({
    db,
    cookies: cookieStore as unknown as AuthCookieStore,
  })
}
