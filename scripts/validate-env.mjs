import { pathToFileURL } from 'node:url'

import { z } from 'zod'

/**
 * Public, browser-safe environment variables for the current no-backend
 * baseline. Future backend phases add required server variables here; secrets
 * must never be added to NEXT_PUBLIC_* values.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  NEXT_PUBLIC_SITE_URL: z
    .string()
    .trim()
    .url('NEXT_PUBLIC_SITE_URL must be a valid URL')
    .default('http://localhost:3000'),
  NEXT_PUBLIC_SHOWROOM_SLUG: z
    .string()
    .trim()
    .min(1, 'NEXT_PUBLIC_SHOWROOM_SLUG is required')
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      'NEXT_PUBLIC_SHOWROOM_SLUG must be lowercase letters, digits, and hyphens',
    )
    .default('prima'),
})

/**
 * Validate an environment object and return the parsed values.
 * Throws with a readable message (and prints it) when validation fails.
 *
 * @param {Record<string, string | undefined>} [source]
 */
export function validateEnv(source = process.env) {
  const result = envSchema.safeParse(source)

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => {
        const key = issue.path.join('.') || 'environment'
        return `  - ${key}: ${issue.message}`
      })
      .join('\n')
    const message = `Invalid environment variables:\n${details}`
    console.error(message)
    throw new Error(message)
  }

  return result.data
}

const isDirectRun =
  Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href

if (isDirectRun) {
  try {
    validateEnv()
    console.log('Environment validation passed.')
  } catch {
    // validateEnv already printed the field-level details.
    process.exit(1)
  }
}
