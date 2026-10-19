import { NextResponse, type NextRequest } from 'next/server'

import { resolveSessionCookie } from './local-proxy'
import { loginUrlFor } from './paths'
import type { AuthResolution } from './types'

export type AdminAuthResolver = (request: NextRequest) => Promise<AuthResolution>

export interface AdminProxyOptions {
  /** Injectable resolver so the production proxy logic is testable. */
  resolveAuth?: AdminAuthResolver
  loginPath?: string
}

/**
 * Build the admin request proxy.
 *
 * Fail-closed behavior: missing configuration, resolver exceptions, expired
 * sessions, and invalid sessions are all treated as anonymous. Authenticated
 * responses carry any refreshed auth cookies and cache headers.
 */
export function createAdminProxy(options: AdminProxyOptions = {}) {
  const resolveAuth = options.resolveAuth ?? resolveSessionCookie

  return async function proxy(request: NextRequest): Promise<NextResponse> {
    let resolution: AuthResolution

    try {
      resolution = await resolveAuth(request)
    } catch {
      resolution = { user: null }
    }

    const response = resolution.user
      ? NextResponse.next({ request })
      : NextResponse.redirect(loginUrlFor(request, options.loginPath))

    for (const cookie of resolution.cookies ?? []) {
      response.cookies.set(cookie.name, cookie.value, cookie.options)
    }

    for (const [key, value] of Object.entries(resolution.headers ?? {})) {
      response.headers.set(key, value)
    }

    return response
  }
}
