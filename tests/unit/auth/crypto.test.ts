import { describe, expect, it } from 'vitest'

import {
  generateSessionToken,
  hashPassword,
  hashSessionToken,
  verifyPassword,
} from '@/lib/auth/crypto'

describe('password hashing', () => {
  it('verifies the correct password and rejects the wrong one', async () => {
    const hash = await hashPassword('correct-horse')

    expect(hash.startsWith('scrypt$')).toBe(true)
    await expect(verifyPassword('correct-horse', hash)).resolves.toBe(true)
    await expect(verifyPassword('wrong-password', hash)).resolves.toBe(false)
  })

  it('uses a unique salt for every hash', async () => {
    const first = await hashPassword('same-password')
    const second = await hashPassword('same-password')

    expect(first).not.toBe(second)
    await expect(verifyPassword('same-password', first)).resolves.toBe(true)
    await expect(verifyPassword('same-password', second)).resolves.toBe(true)
  })

  it('fails closed for malformed stored hashes', async () => {
    for (const value of ['', 'plain', 'scrypt$only', 'bcrypt$a$b', 'scrypt$$']) {
      await expect(verifyPassword('anything', value)).resolves.toBe(false)
    }
  })
})

describe('session tokens', () => {
  it('generates opaque tokens and stable, non-reversible hashes', () => {
    const token = generateSessionToken()
    const hash = hashSessionToken(token)

    expect(token).toMatch(/^[A-Za-z0-9_-]{40,}$/)
    expect(hash).toMatch(/^[a-f0-9]{64}$/)
    expect(hash).not.toBe(token)
    expect(hashSessionToken(token)).toBe(hash)
  })
})
