import type { NextRequest } from 'next/server'

export const ADMIN_HOME = '/admin'
export const PLATFORM_HOME = '/platform'
export const LOGIN_PATH = '/login'
export const RESET_PASSWORD_PATH = '/reset-password'

/**
 * Restrict post-login redirects to same-origin admin or platform paths.
 *
 * Rejects absolute/protocol-relative URLs, backslashes, control characters, and
 * any path outside `/admin` or `/platform`. This prevents open redirects through
 * the attacker-controlled `next` query parameter.
 */
export function safeNextPath(
  value: string | null | undefined,
  fallback: string = ADMIN_HOME,
): string {
  if (typeof value !== 'string') return fallback

  const trimmed = value.trim()
  if (!trimmed) return fallback
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return fallback
  if (/[\\\u0000-\u001f]/.test(trimmed)) return fallback
  if (trimmed === ADMIN_HOME || trimmed === PLATFORM_HOME) return trimmed
  if (trimmed.startsWith(`${ADMIN_HOME}/`) || trimmed.startsWith(`${PLATFORM_HOME}/`)) {
    return trimmed
  }

  return fallback
}

/**
 * Restrict auth-callback redirects to the same-origin destinations the callback
 * is allowed to deliver: admin paths and the password-reset form. Everything
 * else falls back to `/admin`, preserving open-redirect protection.
 */
export function safeCallbackPath(
  value: string | null | undefined,
  fallback: string = ADMIN_HOME,
): string {
  if (typeof value === 'string' && value.trim() === RESET_PASSWORD_PATH) {
    return RESET_PASSWORD_PATH
  }

  return safeNextPath(value, fallback)
}

/** Build the sign-in URL for an unauthenticated admin request. */
export function loginUrlFor(request: NextRequest, loginPath: string = LOGIN_PATH): URL {
  const url = request.nextUrl.clone()
  url.pathname = loginPath
  url.search = ''

  const original = `${request.nextUrl.pathname}${request.nextUrl.search}`
  url.searchParams.set('next', safeNextPath(original))

  return url
}
