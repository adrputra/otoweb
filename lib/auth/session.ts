import type { AuthBackend, AuthUser } from './types'

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
