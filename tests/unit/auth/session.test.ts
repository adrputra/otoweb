import { describe, expect, it } from 'vitest'

import { isSessionActive, resolveSessionUser } from '@/lib/auth/session'

import { FakeAuthBackend, testUser } from './fake-auth'

describe('session helpers', () => {
  it('accepts an active session with a user and future expiry', () => {
    expect(isSessionActive({ user: testUser, expiresAt: Date.now() + 60_000 }, Date.now())).toBe(
      true,
    )
  })

  it('accepts a session when the provider owns expiry', () => {
    expect(isSessionActive({ user: testUser, expiresAt: null }, Date.now())).toBe(true)
  })

  it('rejects a session whose expiry has passed', () => {
    expect(isSessionActive({ user: testUser, expiresAt: Date.now() - 1 }, Date.now())).toBe(false)
  })

  it('rejects an anonymous snapshot', () => {
    expect(isSessionActive({ user: null, expiresAt: null }, Date.now())).toBe(false)
  })

  it('resolves the user from an active fake session', async () => {
    const auth = new FakeAuthBackend({ startSignedInAs: 'owner@example.com' })
    await expect(resolveSessionUser(auth)).resolves.toEqual(testUser)
  })

  it('resolves to anonymous when the session has expired', async () => {
    const auth = new FakeAuthBackend({ startSignedInAs: 'owner@example.com' })
    auth.expireSession()

    await expect(resolveSessionUser(auth)).resolves.toBeNull()
  })

  it('resolves to anonymous when the provider throws', async () => {
    const auth = new FakeAuthBackend()
    auth.failNext = 'getUser'

    await expect(resolveSessionUser(auth)).resolves.toBeNull()
  })
})
