// @vitest-environment node
import { randomUUID } from 'node:crypto'

import { describe, expect, it } from 'vitest'

import { PRIMA_TENANT_ID } from '@/db/seed-core'
import { profiles, tenantMembers } from '@/db/schema'
import { hashPassword } from '@/lib/auth/crypto'
import { createLocalAuthBackend, type AuthCookieStore } from '@/lib/auth/local-backend'
import { SESSION_COOKIE_NAME } from '@/lib/auth/session'

import { createTenantTestDatabase } from '../tenant/database'

function memoryCookies(): AuthCookieStore & { values: Map<string, string> } {
  const values = new Map<string, string>()

  return {
    values,
    get(name) {
      const value = values.get(name)
      return value === undefined ? undefined : { value }
    },
    set(name, value) {
      values.set(name, value)
    },
    delete(name) {
      values.delete(name)
    },
  }
}

async function createAdmin(
  db: Awaited<ReturnType<typeof createTenantTestDatabase>>['db'],
  email: string,
  password: string,
): Promise<string> {
  const userId = randomUUID()

  await db.insert(profiles).values({
    id: userId,
    fullName: 'Test Admin',
    email,
    passwordHash: await hashPassword(password),
    emailVerifiedAt: new Date(),
  })

  await db.insert(tenantMembers).values({
    tenantId: PRIMA_TENANT_ID,
    userId,
    role: 'platform_admin',
    status: 'active',
  })

  return userId
}

describe('local PostgreSQL auth backend', () => {
  it('signs in, resolves the session, and signs out', async () => {
    const testDb = await createTenantTestDatabase()

    try {
      const userId = await createAdmin(testDb.db, 'admin@example.test', 'correct-horse')
      const cookies = memoryCookies()
      const auth = createLocalAuthBackend({ db: testDb.db, cookies })

      await expect(auth.getUser()).resolves.toBeNull()

      const rejected = await auth.signInWithPassword({
        email: 'admin@example.test',
        password: 'wrong-password',
      })
      expect(rejected).toEqual({ ok: false, error: 'invalid_credentials' })
      expect(cookies.values.has(SESSION_COOKIE_NAME)).toBe(false)

      const signedIn = await auth.signInWithPassword({
        email: '  ADMIN@example.test ',
        password: 'correct-horse',
      })
      expect(signedIn.ok).toBe(true)
      if (!signedIn.ok) throw new Error('expected sign-in to succeed')
      expect(signedIn.data.id).toBe(userId)
      expect(cookies.values.has(SESSION_COOKIE_NAME)).toBe(true)

      await expect(auth.getUser()).resolves.toMatchObject({
        id: userId,
        email: 'admin@example.test',
        displayName: 'Test Admin',
      })

      await expect(auth.signOut()).resolves.toEqual({ ok: true, data: null })
      expect(cookies.values.has(SESSION_COOKIE_NAME)).toBe(false)
      await expect(auth.getUser()).resolves.toBeNull()
    } finally {
      await testDb.close()
    }
  })

  it('rejects an expired session', async () => {
    const testDb = await createTenantTestDatabase()

    try {
      await createAdmin(testDb.db, 'expired@example.test', 'correct-horse')
      const cookies = memoryCookies()
      let current = new Date('2026-01-01T00:00:00.000Z')
      const auth = createLocalAuthBackend({ db: testDb.db, cookies, now: () => current })

      await expect(
        auth.signInWithPassword({ email: 'expired@example.test', password: 'correct-horse' }),
      ).resolves.toMatchObject({ ok: true })

      current = new Date('2026-01-09T00:00:00.000Z')
      await expect(auth.getUser()).resolves.toBeNull()
    } finally {
      await testDb.close()
    }
  })

  it('updates the password and revokes other sessions', async () => {
    const testDb = await createTenantTestDatabase()

    try {
      await createAdmin(testDb.db, 'rotate@example.test', 'correct-horse')

      const firstCookies = memoryCookies()
      const first = createLocalAuthBackend({ db: testDb.db, cookies: firstCookies })
      await expect(
        first.signInWithPassword({ email: 'rotate@example.test', password: 'correct-horse' }),
      ).resolves.toMatchObject({ ok: true })

      const secondCookies = memoryCookies()
      const second = createLocalAuthBackend({ db: testDb.db, cookies: secondCookies })
      await expect(
        second.signInWithPassword({ email: 'rotate@example.test', password: 'correct-horse' }),
      ).resolves.toMatchObject({ ok: true })

      await expect(first.updatePassword('new-password-123')).resolves.toMatchObject({ ok: true })

      // The updating browser stays signed in; the other device is revoked.
      await expect(first.getUser()).resolves.toMatchObject({ email: 'rotate@example.test' })
      await expect(second.getUser()).resolves.toBeNull()

      const oldPassword = createLocalAuthBackend({ db: testDb.db, cookies: memoryCookies() })
      await expect(
        oldPassword.signInWithPassword({
          email: 'rotate@example.test',
          password: 'correct-horse',
        }),
      ).resolves.toEqual({ ok: false, error: 'invalid_credentials' })

      const newPassword = createLocalAuthBackend({ db: testDb.db, cookies: memoryCookies() })
      await expect(
        newPassword.signInWithPassword({
          email: 'rotate@example.test',
          password: 'new-password-123',
        }),
      ).resolves.toMatchObject({ ok: true })
    } finally {
      await testDb.close()
    }
  })

  it('returns the same reset response for known and unknown accounts', async () => {
    const testDb = await createTenantTestDatabase()

    try {
      await createAdmin(testDb.db, 'known@example.test', 'correct-horse')
      const auth = createLocalAuthBackend({ db: testDb.db, cookies: memoryCookies() })

      await expect(auth.requestPasswordReset('known@example.test')).resolves.toEqual({
        ok: true,
        data: null,
      })
      await expect(auth.requestPasswordReset('missing@example.test')).resolves.toEqual({
        ok: true,
        data: null,
      })
    } finally {
      await testDb.close()
    }
  })
})
