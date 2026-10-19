import type { NextRequest } from 'next/server'

import { SESSION_COOKIE_NAME } from './session'
import type { AuthResolution, AuthUser } from './types'

/**
 * Fast cookie-presence probe for the request proxy.
 *
 * The proxy runs before rendering and must stay free of database access. A
 * present cookie only means "let the request reach the server"; the admin and
 * platform layouts call `requireAdminUser` / `requirePlatformOperatorPage`,
 * which verify the session row against PostgreSQL. Missing cookies are
 * rejected here without touching the database.
 */
const SESSION_PROBE_USER: AuthUser = {
  id: '00000000-0000-0000-0000-000000000000',
  email: null,
  displayName: null,
}

export async function resolveSessionCookie(request: NextRequest): Promise<AuthResolution> {
  return {
    user: request.cookies.has(SESSION_COOKIE_NAME) ? SESSION_PROBE_USER : null,
  }
}
