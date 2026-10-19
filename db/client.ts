import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import * as schema from './schema'

export type Database = PostgresJsDatabase<typeof schema>

let client: ReturnType<typeof postgres> | undefined
let database: Database | undefined

/**
 * Return the shared server-only Drizzle client.
 *
 * The client is created lazily so importing this module never opens a
 * connection (safe for builds and tests). `prepare: false` keeps the
 * connection compatible with transaction-pooling proxies such as PgBouncer.
 */
export function getDatabase(url: string | undefined = process.env.DATABASE_URL): Database {
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set. Copy .env.example to .env.local and configure the PostgreSQL connection string.',
    )
  }

  if (!database) {
    client = postgres(url, { max: 1, prepare: false })
    database = drizzle(client, { schema })
  }

  return database
}

/** Close the shared connection, if one was opened. */
export async function closeDatabase(): Promise<void> {
  if (!client) return

  await client.end({ timeout: 5 })
  client = undefined
  database = undefined
}
