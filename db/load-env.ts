import { config } from 'dotenv'

/**
 * Load local environment files for CLI scripts (migrations and seeds).
 *
 * Next.js loads these files automatically for the application, but standalone
 * `tsx` scripts do not. Existing process environment variables win over file
 * values so CI and production deployments can inject `DATABASE_URL` directly.
 */
export function loadDatabaseEnv(): void {
  config({ path: '.env.local', quiet: true })
  config({ path: '.env', quiet: true })
}
