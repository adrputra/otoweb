import { fileURLToPath, pathToFileURL } from 'node:url'

import { migrate } from 'drizzle-orm/postgres-js/migrator'

import { closeDatabase, getDatabase } from './client'
import { loadDatabaseEnv } from './load-env'

const migrationsFolder = fileURLToPath(new URL('./migrations', import.meta.url))

/** Apply every migration that has not been recorded in this database yet. */
export async function runMigrations(): Promise<void> {
  loadDatabaseEnv()
  const database = getDatabase()

  try {
    await migrate(database, { migrationsFolder })
    console.log('Database migrations applied.')
  } finally {
    await closeDatabase()
  }
}

const isDirectRun =
  Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  runMigrations().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
