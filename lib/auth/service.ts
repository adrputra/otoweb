import type { AuthBackend, AuthResult, AuthUser } from './types'

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

/** Establish a session with email/password. Provider errors are returned, never thrown. */
export async function signInWithPassword(
  auth: AuthBackend,
  credentials: { email: string; password: string },
): Promise<AuthResult<AuthUser>> {
  try {
    return await auth.signInWithPassword({
      email: normalizeEmail(credentials.email),
      password: credentials.password,
    })
  } catch {
    return { ok: false, error: 'unexpected', message: 'Autentikasi tidak tersedia.' }
  }
}

/** Clear the provider session. Idempotent and never throws. */
export async function signOut(auth: AuthBackend): Promise<AuthResult<null>> {
  try {
    return await auth.signOut()
  } catch {
    return { ok: false, error: 'unexpected', message: 'Sesi tidak dapat diakhiri.' }
  }
}

/** Request a recovery email. The caller must not reveal whether the account exists. */
export async function requestPasswordReset(
  auth: AuthBackend,
  email: string,
  redirectTo?: string,
): Promise<AuthResult<null>> {
  try {
    return await auth.requestPasswordReset(normalizeEmail(email), redirectTo)
  } catch {
    return { ok: false, error: 'unexpected', message: 'Permintaan pemulihan tidak tersedia.' }
  }
}

/** Update the password only when a recovery/session user exists. */
export async function updatePassword(
  auth: AuthBackend,
  password: string,
): Promise<AuthResult<AuthUser>> {
  try {
    const user = await auth.getUser()
    if (!user) {
      return {
        ok: false,
        error: 'session_invalid',
        message: 'Sesi pemulihan tidak valid atau sudah kedaluwarsa.',
      }
    }

    return await auth.updatePassword(password)
  } catch {
    return {
      ok: false,
      error: 'session_invalid',
      message: 'Sesi pemulihan tidak valid atau sudah kedaluwarsa.',
    }
  }
}
