// @vitest-environment node
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { tenantMembers } from '@/db/schema'
import {
  findPlatformOperatorMembership,
  resolvePlatformOperator,
} from '@/lib/platform/auth'
import type { AuthUser } from '@/lib/auth/types'

import { createTenantTestDatabase, type TenantTestDatabase } from '../tenant/database'
import { platformOperator, prima, tenantB } from '../tenant/fixtures'

let harness: TenantTestDatabase

beforeEach(async () => {
  harness = await createTenantTestDatabase()
}, 30_000)

afterEach(async () => {
  await harness.close()
})

function authUser(id: string): AuthUser {
  return { id, email: null, displayName: null }
}

describe('platform operator membership', () => {
  it('accepts an active platform_admin membership', async () => {
    await expect(
      findPlatformOperatorMembership(harness.db, platformOperator.profileId),
    ).resolves.toBe(true)
  })

  it('rejects showroom owners, staff, unknown, and malformed identities', async () => {
    await expect(findPlatformOperatorMembership(harness.db, prima.profileId)).resolves.toBe(false)
    await expect(findPlatformOperatorMembership(harness.db, tenantB.profileId)).resolves.toBe(false)
    await expect(
      findPlatformOperatorMembership(harness.db, '99999999-9999-4999-8999-999999999999'),
    ).resolves.toBe(false)
    await expect(findPlatformOperatorMembership(harness.db, 'not-a-uuid')).resolves.toBe(false)
    await expect(findPlatformOperatorMembership(harness.db, '')).resolves.toBe(false)
  })
})

describe('resolvePlatformOperator', () => {
  it('reports unauthenticated sessions', async () => {
    await expect(
      resolvePlatformOperator({
        getUser: async () => null,
        getDb: async () => harness.db,
      }),
    ).resolves.toEqual({ ok: false, reason: 'unauthenticated' })
  })

  it('resolves a real platform operator', async () => {
    const result = await resolvePlatformOperator({
      getUser: async () => authUser(platformOperator.profileId),
      getDb: async () => harness.db,
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.user.id).toBe(platformOperator.profileId)
  })

  it('denies a showroom owner', async () => {
    await expect(
      resolvePlatformOperator({
        getUser: async () => authUser(prima.profileId),
        getDb: async () => harness.db,
      }),
    ).resolves.toEqual({ ok: false, reason: 'forbidden' })
  })

  it('denies a staff member', async () => {
    await harness.db
      .update(tenantMembers)
      .set({ role: 'staff' })
      .where(eq(tenantMembers.id, prima.memberId))

    await expect(
      resolvePlatformOperator({
        getUser: async () => authUser(prima.profileId),
        getDb: async () => harness.db,
      }),
    ).resolves.toEqual({ ok: false, reason: 'forbidden' })
  })

  it('denies an inactive platform operator', async () => {
    await harness.db
      .update(tenantMembers)
      .set({ status: 'inactive' })
      .where(eq(tenantMembers.id, platformOperator.memberId))

    await expect(
      resolvePlatformOperator({
        getUser: async () => authUser(platformOperator.profileId),
        getDb: async () => harness.db,
      }),
    ).resolves.toEqual({ ok: false, reason: 'forbidden' })
  })

  it('denies a malformed identity', async () => {
    await expect(
      resolvePlatformOperator({
        getUser: async () => authUser('not-a-uuid'),
        getDb: async () => harness.db,
      }),
    ).resolves.toEqual({ ok: false, reason: 'forbidden' })
  })
})

describe('showroom navigation isolation', () => {
  it('never links to /platform from the showroom admin shell or routes', () => {
    const shell = readFileSync('components/admin-shell.tsx', 'utf8')
    expect(shell).not.toContain('/platform')

    const offenders: string[] = []
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name)
        if (entry.isDirectory()) walk(path)
        else if (/\.(ts|tsx)$/.test(entry.name)) {
          const source = readFileSync(path, 'utf8')
          if (source.includes('/platform')) offenders.push(path)
        }
      }
    }
    walk('app/admin')
    expect(offenders).toEqual([])
  })
})
