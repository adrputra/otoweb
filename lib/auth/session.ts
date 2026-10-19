import type { AuthBackend, AuthUser } from './types'

/** Opaque HTTP-only session cookie issued by the local auth backend. */
export const SESSION_COOKIE_NAME = 'otoweb_session'

/** Session lifetime. Expired rows are removed on the next sign-in. */
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000

export interface SessionSnapshot {
  user: AuthUser | null
  /** Epoch milliseconds. `null`/`undefined` means the provider owns expiry. */
  expiresAt?: number | null
}

/**
 * Pure session validity check used by the fake backend and session tests.
 * A session is active only when a user exists and no known expiry has passed.
 */
export function isSessionActive(snapshot: SessionSnapshot, now: number = Date.now()): boolean {
  if (!snapshot.user) return false
  if (snapshot.expiresAt != null && snapshot.expiresAt <= now) return false
  return true
}

/**
 * Resolve a server-verified user. Provider/config failures fail closed: the
 * caller sees an anonymous session rather than an exception.
 */
export async function resolveSessionUser(auth: AuthBackend): Promise<AuthUser | null> {
  try {
    return await auth.getUser()
  } catch {
    return null
  }
}
