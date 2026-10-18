import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'

import * as schema from '@/db/schema'

import { getDatabase } from '@/db/client'

/**
 * The database surface used by server-side read paths. Both the production
 * `postgres` client and the development PGlite client satisfy it.
 */
export type AppDatabase = PgDatabase<PgQueryResultHKT, typeof schema>

interface DevDatabaseGlobal {
  __otowebDevDatabase?: Promise<AppDatabase>
}

const globalForDatabase = globalThis as typeof globalThis & DevDatabaseGlobal

const MIGRATIONS_FOLDER = `${process.cwd()}/db/migrations`

async function createDevelopmentDatabase(): Promise<AppDatabase> {
  const [{ PGlite }, { drizzle }, { migrate }] = await Promise.all([
    import('@electric-sql/pglite'),
    import('drizzle-orm/pglite'),
    import('drizzle-orm/pglite/migrator'),
  ])

  const client = new PGlite()
  const database = drizzle(client, { schema })

  await migrate(database, { migrationsFolder: MIGRATIONS_FOLDER })

  const { seedDatabase } = await import('@/db/seed-core')
  await seedDatabase(database)

  console.info(
    '[db] DATABASE_URL is not set; using an in-memory development database seeded from db/migrations.',
  )

  return database
}

function getDevelopmentDatabase(): Promise<AppDatabase> {
  if (!globalForDatabase.__otowebDevDatabase) {
    globalForDatabase.__otowebDevDatabase = createDevelopmentDatabase()
  }

  return globalForDatabase.__otowebDevDatabase
}

/**
 * Return the server database for public reads.
 *
 * Production always uses `DATABASE_URL`. Development may use a real connection
 * too, but falls back to a seeded in-memory PGlite instance so the public site
 * and Visual QA can run without Docker or a local PostgreSQL server. The
 * fallback is deliberately unavailable in production.
 */
export async function getAppDatabase(): Promise<AppDatabase> {
  if (process.env.DATABASE_URL) {
    return getDatabase()
  }

  if (process.env.NODE_ENV !== 'production') {
    return getDevelopmentDatabase()
  }

  throw new Error(
    'DATABASE_URL is required in production. Refusing to serve public data without a database connection.',
  )
}
