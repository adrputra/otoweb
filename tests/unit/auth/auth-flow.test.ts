import { describe, expect, it } from 'vitest'

import { resolveSessionUser } from '@/lib/auth/session'
import {
  requestPasswordReset,
  signInWithPassword,
  signOut,
  updatePassword,
} from '@/lib/auth/service'
import { buildResetCallbackUrl } from '@/lib/auth/site-url'

import { FakeAuthBackend, testUser } from './fake-auth'

describe('auth flow', () => {
  it('signs in with valid credentials and resolves the user', async () => {
    const auth = new FakeAuthBackend()

    const result = await signInWithPassword(auth, {
      email: '  OWNER@example.com ',
      password: 'correct-horse',
    })

    expect(result).toEqual({ ok: true, data: testUser })
    await expect(resolveSessionUser(auth)).resolves.toEqual(testUser)
  })

  it('rejects invalid credentials without creating a session', async () => {
    const auth = new FakeAuthBackend()

    const result = await signInWithPassword(auth, {
      email: 'owner@example.com',
      password: 'wrong-password',
    })

    expect(result).toEqual({ ok: false, error: 'invalid_credentials' })
    await expect(resolveSessionUser(auth)).resolves.toBeNull()
  })

  it('returns an unexpected error when the provider throws on sign-in', async () => {
    const auth = new FakeAuthBackend()
    auth.failNext = 'signIn'

    const result = await signInWithPassword(auth, {
      email: 'owner@example.com',
      password: 'correct-horse',
    })

    expect(result).toEqual({
      ok: false,
      error: 'unexpected',
      message: 'Autentikasi tidak tersedia.',
    })
    await expect(resolveSessionUser(auth)).resolves.toBeNull()
  })

  it('signs out and clears the session', async () => {
    const auth = new FakeAuthBackend({ startSignedInAs: 'owner@example.com' })

    await expect(resolveSessionUser(auth)).resolves.toEqual(testUser)

    const result = await signOut(auth)

    expect(result).toEqual({ ok: true, data: null })
    expect(auth.signOutCalls).toBe(1)
    await expect(resolveSessionUser(auth)).resolves.toBeNull()
  })

  it('rejects an expired session on the next lookup', async () => {
    const auth = new FakeAuthBackend({ startSignedInAs: 'owner@example.com' })
    auth.expireSession()

    await expect(resolveSessionUser(auth)).resolves.toBeNull()
  })

  it('rejects an invalidated session on the next lookup', async () => {
    const auth = new FakeAuthBackend({ startSignedInAs: 'owner@example.com' })
    auth.invalidateSession()

    await expect(resolveSessionUser(auth)).resolves.toBeNull()
  })

  it('requests a password reset with the recovery callback URL', async () => {
    const auth = new FakeAuthBackend()
    const redirectTo = buildResetCallbackUrl()

    const result = await requestPasswordReset(auth, ' OWNER@example.com ', redirectTo)

    expect(result).toEqual({ ok: true, data: null })
    expect(redirectTo).toBe('http://localhost:3000/auth/callback?next=/reset-password')
    expect(auth.resetRequests).toEqual([{ email: 'owner@example.com', redirectTo }])
  })

  it('accepts a reset request for an unknown email without revealing existence', async () => {
    const auth = new FakeAuthBackend()

    const result = await requestPasswordReset(auth, 'missing@example.com', buildResetCallbackUrl())

    expect(result).toEqual({ ok: true, data: null })
    expect(auth.resetRequests).toHaveLength(1)
    expect(auth.resetRequests[0]?.email).toBe('missing@example.com')
  })

  it('updates the password only while a session is active', async () => {
    const auth = new FakeAuthBackend({ startSignedInAs: 'owner@example.com' })

    const success = await updatePassword(auth, 'new-password-123')
    expect(success.ok).toBe(true)
    expect(auth.passwordUpdates).toEqual(['new-password-123'])

    const signedInAgain = await signInWithPassword(auth, {
      email: 'owner@example.com',
      password: 'new-password-123',
    })
    expect(signedInAgain.ok).toBe(true)

    await signOut(auth)

    const failure = await updatePassword(auth, 'another-password-123')
    expect(failure).toEqual({
      ok: false,
      error: 'session_invalid',
      message: 'Sesi pemulihan tidak valid atau sudah kedaluwarsa.',
    })
  })

  it('rejects a password update for an expired recovery session', async () => {
    const auth = new FakeAuthBackend({ startSignedInAs: 'owner@example.com' })
    auth.expireSession()

    const result = await updatePassword(auth, 'new-password-123')

    expect(result).toEqual({
      ok: false,
      error: 'session_invalid',
      message: 'Sesi pemulihan tidak valid atau sudah kedaluwarsa.',
    })
    expect(auth.passwordUpdates).toEqual([])
  })
})
