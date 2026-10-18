// @vitest-environment node
import { fileURLToPath } from 'node:url'

import { PGlite } from '@electric-sql/pglite'
import { drizzle, type PgliteDatabase } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import { sql } from 'drizzle-orm'

import { seedDatabase } from '@/db/seed-core'
import * as schema from '@/db/schema'

const migrationsFolder = fileURLToPath(new URL('../../../db/migrations', import.meta.url))

/** Role used to prove row-level security. It intentionally has no BYPASSRLS. */
export const RESTRICTED_ROLE = 'tenant_app'

export interface TenantTestDatabase {
  client: PGlite
  db: PgliteDatabase<typeof schema>
  /** Run a callback with a session-level tenant/user GUC under the restricted role. */
  asTenant<T>(
    values: { tenantId: string | null; userId: string | null; platformAdmin?: boolean },
    callback: (db: PgliteDatabase<typeof schema>) => Promise<T>,
  ): Promise<T>
  /** Run a callback as the privileged migration/seed role. */
  asOwner<T>(callback: (db: PgliteDatabase<typeof schema>) => Promise<T>): Promise<T>
  /** Execute raw SQL under the restricted role (for RLS attack assertions). */
  rawAsTenant(
    values: { tenantId: string | null; userId: string | null; platformAdmin?: boolean },
    callback: (client: PGlite) => Promise<void>,
  ): Promise<void>
  close(): Promise<void>
}

async function createRestrictedRole(client: PGlite): Promise<void> {
  await client.exec(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${RESTRICTED_ROLE}') THEN
        CREATE ROLE ${RESTRICTED_ROLE} NOLOGIN;
      END IF;
    END
    $$;
    GRANT USAGE ON SCHEMA public TO ${RESTRICTED_ROLE};
    GRANT USAGE ON SCHEMA app TO ${RESTRICTED_ROLE};
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${RESTRICTED_ROLE};
  `)
}

async function applySession(
  client: PGlite,
  values: { tenantId: string | null; userId: string | null; platformAdmin?: boolean },
): Promise<void> {
  await client.query(`SET ROLE ${RESTRICTED_ROLE}`)
  await client.query("SELECT set_config('app.tenant_id', $1, false)", [values.tenantId ?? ''])
  await client.query("SELECT set_config('app.user_id', $1, false)", [values.userId ?? ''])
  await client.query("SELECT set_config('app.is_platform_admin', $1, false)", [
    values.platformAdmin ? 'true' : 'false',
  ])
}

async function clearSession(client: PGlite): Promise<void> {
  await client.query("SELECT set_config('app.tenant_id', '', false)")
  await client.query("SELECT set_config('app.user_id', '', false)")
  await client.query("SELECT set_config('app.is_platform_admin', 'false', false)")
  await client.query('RESET ROLE')
}

/** Create an isolated embedded database with both F003 fixtures and a restricted role. */
export async function createTenantTestDatabase(): Promise<TenantTestDatabase> {
  const client = new PGlite()
  const db = drizzle(client, { schema })

  await migrate(db, { migrationsFolder })
  await seedDatabase(db)
  await createRestrictedRole(client)

  return {
    client,
    db,
    async asTenant(values, callback) {
      await applySession(client, values)
      try {
        return await callback(db)
      } finally {
        await clearSession(client)
      }
    },
    async asOwner(callback) {
      return callback(db)
    },
    async rawAsTenant(values, callback) {
      await applySession(client, values)
      try {
        await callback(client)
      } finally {
        await clearSession(client)
      }
    },
    async close() {
      await client.close()
    },
  }
}

/** True when row-level security is enabled and forced on a table. */
export async function tableRlsState(
  db: PgliteDatabase<typeof schema>,
  tableName: string,
): Promise<{ enabled: boolean; forced: boolean } | null> {
  const result = await db.execute<{ relrowsecurity: boolean; relforcerowsecurity: boolean }>(sql`
    select c.relrowsecurity, c.relforcerowsecurity
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = ${tableName}
  `)

  const row = result.rows[0]
  if (!row) return null

  return { enabled: row.relrowsecurity, forced: row.relforcerowsecurity }
}
