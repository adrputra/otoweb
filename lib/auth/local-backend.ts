import { and, eq, lt, ne, sql } from 'drizzle-orm'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'

import { authSessions, profiles } from '@/db/schema'
import type * as schema from '@/db/schema'

import {
  generateSessionToken,
  hashPassword,
  hashSessionToken,
  verifyPassword,
} from './crypto'
import { SESSION_COOKIE_NAME, SESSION_TTL_MS } from './session'
import type {
  AuthBackend,
  AuthCookieOptions,
  AuthResult,
  AuthUser,
  SignInCredentials,
} from './types'

type Database = PgDatabase<PgQueryResultHKT, typeof schema>

/** Minimal cookie store shared by Next's `cookies()` and unit-test fakes. */
export interface AuthCookieStore {
  get(name: string): { value: string } | undefined
  set(name: string, value: string, options?: AuthCookieOptions): void
  delete(name: string): void
}

export interface LocalAuthDependencies {
  db: Database
  cookies: AuthCookieStore
  now?: () => Date
}

type ProfileRow = {
  id: string
  email: string | null
  fullName: string | null
}

function toAuthUser(row: ProfileRow): AuthUser {
  return {
    id: row.id,
    email: row.email,
    displayName: row.fullName,
  }
}

function sessionCookieOptions(): AuthCookieOptions {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  }
}

async function findProfileByEmail(
  db: Database,
  normalizedEmail: string,
): Promise<(ProfileRow & { passwordHash: string | null }) | null> {
  const rows = await db
    .select({
      id: profiles.id,
      email: profiles.email,
      fullName: profiles.fullName,
      passwordHash: profiles.passwordHash,
    })
    .from(profiles)
    .where(sql`lower(${profiles.email}) = ${normalizedEmail}`)
    .limit(1)

  return rows[0] ?? null
}

/**
 * PostgreSQL-backed authentication backend.
 *
 * Sessions are opaque random tokens in an HTTP-only cookie; only their SHA-256
 * hash is stored. Passwords use scrypt with a per-password salt. No external
 * identity provider is involved.
 */
export function createLocalAuthBackend(deps: LocalAuthDependencies): AuthBackend {
  const { db, cookies } = deps
  const now = deps.now ?? (() => new Date())

  async function currentSession(): Promise<{
    sessionId: string
    userId: string
    expiresAt: Date
    profile: ProfileRow
  } | null> {
    const token = cookies.get(SESSION_COOKIE_NAME)?.value
    if (!token) return null

    const rows = await db
      .select({
        sessionId: authSessions.id,
        userId: authSessions.userId,
        expiresAt: authSessions.expiresAt,
        id: profiles.id,
        email: profiles.email,
        fullName: profiles.fullName,
      })
      .from(authSessions)
      .innerJoin(profiles, eq(profiles.id, authSessions.userId))
      .where(eq(authSessions.tokenHash, hashSessionToken(token)))
      .limit(1)

    const row = rows[0]
    if (!row) return null
    if (row.expiresAt.getTime() <= now().getTime()) return null

    return {
      sessionId: row.sessionId,
      userId: row.userId,
      expiresAt: row.expiresAt,
      profile: { id: row.id, email: row.email, fullName: row.fullName },
    }
  }

  return {
    async getUser(): Promise<AuthUser | null> {
      const session = await currentSession()
      return session ? toAuthUser(session.profile) : null
    },

    async signInWithPassword(credentials: SignInCredentials): Promise<AuthResult<AuthUser>> {
      const normalizedEmail = credentials.email.trim().toLowerCase()
      const profile = await findProfileByEmail(db, normalizedEmail)

      if (!profile?.passwordHash) {
        return { ok: false, error: 'invalid_credentials' }
      }

      const valid = await verifyPassword(credentials.password, profile.passwordHash)
      if (!valid) return { ok: false, error: 'invalid_credentials' }

      const token = generateSessionToken()
      const tokenHash = hashSessionToken(token)
      const issuedAt = now()
      const expiresAt = new Date(issuedAt.getTime() + SESSION_TTL_MS)

      // Opportunistic cleanup keeps the session table bounded without a cron.
      await db
        .delete(authSessions)
        .where(and(eq(authSessions.userId, profile.id), lt(authSessions.expiresAt, issuedAt)))

      await db.insert(authSessions).values({
        userId: profile.id,
        tokenHash,
        expiresAt,
      })

      cookies.set(SESSION_COOKIE_NAME, token, sessionCookieOptions())

      return { ok: true, data: toAuthUser(profile) }
    },

    async signOut(): Promise<AuthResult<null>> {
      const token = cookies.get(SESSION_COOKIE_NAME)?.value

      if (token) {
        await db
          .delete(authSessions)
          .where(eq(authSessions.tokenHash, hashSessionToken(token)))
      }

      cookies.delete(SESSION_COOKIE_NAME)
      return { ok: true, data: null }
    },

    async requestPasswordReset(email: string, redirectTo?: string): Promise<AuthResult<null>> {
      // Reset is operator-assisted: the UI returns the same message for known
      // and unknown accounts, and an operator sets a new password with
      // `pnpm auth:admin --email ... --password ...`.
      void email
      void redirectTo
      return { ok: true, data: null }
    },

    async updatePassword(password: string): Promise<AuthResult<AuthUser>> {
      const session = await currentSession()
      if (!session) return { ok: false, error: 'session_invalid' }

      const passwordHash = await hashPassword(password)
      const updatedAt = now()

      await db.transaction(async (tx) => {
        await tx
          .update(profiles)
          .set({ passwordHash, updatedAt })
          .where(eq(profiles.id, session.userId))

        // Keep the current browser signed in and revoke every other device.
        await tx
          .delete(authSessions)
          .where(
            and(
              eq(authSessions.userId, session.userId),
              ne(authSessions.id, session.sessionId),
            ),
          )
      })

      return { ok: true, data: toAuthUser(session.profile) }
    },
  }
}
