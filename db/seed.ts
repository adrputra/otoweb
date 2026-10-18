import { pathToFileURL } from 'node:url'

import { closeDatabase, getDatabase } from './client'
import { loadDatabaseEnv } from './load-env'
import { seedDatabase } from './seed-core'

/** Upsert the deterministic development dataset over `DATABASE_URL`. */
export async function runSeed(): Promise<void> {
  loadDatabaseEnv()
  const database = getDatabase()

  try {
    const result = await seedDatabase(database)
    console.log(
      [
        'Database seed applied:',
        `${result.tenants} tenants,`,
        `${result.domains} domains,`,
        `${result.profiles} profiles,`,
        `${result.memberships} memberships,`,
        `${result.showroomSettings} showroom settings,`,
        `${result.vehicles} vehicles,`,
        `${result.vehicleImages} vehicle images.`,
      ].join(' '),
    )
  } finally {
    await closeDatabase()
  }
}

const isDirectRun =
  Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  runSeed().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
