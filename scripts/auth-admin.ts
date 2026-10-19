import { randomBytes, randomUUID } from 'node:crypto'

import { eq, sql } from 'drizzle-orm'

import { closeDatabase, getDatabase } from '../db/client'
import { loadDatabaseEnv } from '../db/load-env'
import { profiles, tenantMembers, tenants } from '../db/schema'
import { hashPassword } from '../lib/auth/crypto'

function arg(name: string): string | undefined {
  const prefix = `--${name}=`
  const equals = process.argv.find((value) => value.startsWith(prefix))
  if (equals) return equals.slice(prefix.length)

  const index = process.argv.indexOf(`--${name}`)
  if (index >= 0) return process.argv[index + 1]
  return undefined
}

function fail(message: string): never {
  throw new Error(message)
}

async function main(): Promise<void> {
  loadDatabaseEnv()

  const email = (arg('email') ?? '').trim().toLowerCase()
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    fail('Usage: pnpm auth:admin --email <email> [--password <password>] [--name <name>] [--role platform_admin|owner] [--tenant <slug>]')
  }

  const name = arg('name')?.trim() || 'Administrator'
  const role = arg('role') === 'owner' ? 'owner' : 'platform_admin'
  const tenantSlug = arg('tenant')?.trim() || 'prima-auto-gallery'
  const password = arg('password') ?? randomBytes(12).toString('base64url')

  if (password.length < 8) fail('Password must be at least 8 characters.')

  const db = getDatabase()

  try {
    const tenantRows = await db
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.slug, tenantSlug))
      .limit(1)

    const tenant = tenantRows[0]
    if (!tenant) fail(`Tenant not found: ${tenantSlug}`)

    const passwordHash = await hashPassword(password)
    const now = new Date()

    const existingRows = await db
      .select({ id: profiles.id })
      .from(profiles)
      .where(sql`lower(${profiles.email}) = ${email}`)
      .limit(1)

    let userId = existingRows[0]?.id

    if (userId) {
      await db
        .update(profiles)
        .set({
          fullName: name,
          email,
          passwordHash,
          emailVerifiedAt: now,
          updatedAt: now,
        })
        .where(eq(profiles.id, userId))
    } else {
      userId = randomUUID()
      await db.insert(profiles).values({
        id: userId,
        fullName: name,
        email,
        passwordHash,
        emailVerifiedAt: now,
        updatedAt: now,
      })
    }

    await db
      .insert(tenantMembers)
      .values({
        tenantId: tenant.id,
        userId,
        role,
        status: 'active',
      })
      .onConflictDoUpdate({
        target: [tenantMembers.tenantId, tenantMembers.userId],
        set: { role, status: 'active', updatedAt: now },
      })

    console.log('Admin account ready.')
    console.log(`  Email:    ${email}`)
    console.log(`  Password: ${password}`)
    console.log(`  Role:     ${role}`)
    console.log(`  Tenant:   ${tenantSlug}`)
  } finally {
    await closeDatabase()
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
