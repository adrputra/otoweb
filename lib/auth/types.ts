/** A PostgreSQL-backed identity as consumed by the OtoWeb application. */
export interface AuthUser {
  id: string
  email: string | null
  displayName: string | null
}

export type AuthErrorCode =
  | 'invalid_credentials'
  | 'not_configured'
  | 'session_expired'
  | 'session_invalid'
  | 'weak_password'
  | 'unexpected'

export type AuthResult<T> =
  { ok: true; data: T } | { ok: false; error: AuthErrorCode; message?: string }

export interface SignInCredentials {
  email: string
  password: string
}

/**
 * The authentication contract used by server actions, the proxy, and tests.
 * Production uses PostgreSQL-backed local sessions; tests inject a controlled
 * fake backend.
 */
export interface AuthBackend {
  /** Server-verified user lookup. Returns null for anonymous/expired/invalid sessions. */
  getUser(): Promise<AuthUser | null>
  signInWithPassword(credentials: SignInCredentials): Promise<AuthResult<AuthUser>>
  signOut(): Promise<AuthResult<null>>
  requestPasswordReset(email: string, redirectTo?: string): Promise<AuthResult<null>>
  updatePassword(password: string): Promise<AuthResult<AuthUser>>
}

/** Cookie attributes accepted by Next's cookie store and response cookies. */
export interface AuthCookieOptions {
  path?: string
  httpOnly?: boolean
  secure?: boolean
  sameSite?: 'lax' | 'strict' | 'none'
  maxAge?: number
  expires?: Date
  domain?: string
}

export interface AuthCookie {
  name: string
  value: string
  options?: AuthCookieOptions
}

/** Result of resolving a request's session, including refreshed cookies. */
export interface AuthResolution {
  user: AuthUser | null
  cookies?: AuthCookie[]
  headers?: Record<string, string>
}

/** State returned by auth server actions to their form islands. */
export interface AuthActionState {
  error?: string
  success?: string
}
