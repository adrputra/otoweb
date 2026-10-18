import { pathToFileURL } from 'node:url'

import { z } from 'zod'

/**
 * Public, browser-safe environment variables for the current no-backend
 * baseline. Future backend phases add required server variables here; secrets
 * must never be added to NEXT_PUBLIC_* values.
 */
export const envSchema = z
  .object({
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
      .default('prima-auto-gallery'),
    TENANT_ROOT_DOMAIN: z
      .string()
      .trim()
      .toLowerCase()
      .max(253, 'TENANT_ROOT_DOMAIN must be 253 characters or fewer')
      .regex(
        /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?:\.(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?))*$/,
        'TENANT_ROOT_DOMAIN must be a lowercase DNS hostname such as otoweb.id',
      )
      .default('otoweb.id'),
    // Custom-domain provider. Development/tests default to the deterministic
    // fake provider; production without a provider fails closed. A real
    // deployment selects `http` and supplies the two server-only values below.
    DOMAIN_PROVIDER: z.enum(['fake', 'http']).optional(),
    DOMAIN_PROVIDER_URL: z
      .string()
      .trim()
      .url('DOMAIN_PROVIDER_URL must be a valid URL')
      .optional(),
    DOMAIN_PROVIDER_TOKEN: z.string().trim().min(1).optional(),
    CUSTOM_DOMAIN_CNAME_TARGET: z
      .string()
      .trim()
      .toLowerCase()
      .max(253, 'CUSTOM_DOMAIN_CNAME_TARGET must be 253 characters or fewer')
      .regex(
        /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?:\.(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?))*$/,
        'CUSTOM_DOMAIN_CNAME_TARGET must be a lowercase DNS hostname such as otoweb.id',
      )
      .optional(),
    // Optional media configuration. Absent credentials select the local fake
    // provider in development; production surfaces a clear runtime error when
    // uploads are attempted without Cloudinary configured.
    MEDIA_PROVIDER: z.enum(['cloudinary', 'fake']).optional(),
    MEDIA_LOCAL_DIR: z.string().trim().optional(),
    MEDIA_PUBLIC_PREFIX: z
      .string()
      .trim()
      .startsWith('/', 'MEDIA_PUBLIC_PREFIX must start with "/"')
      .optional(),
    CLOUDINARY_CLOUD_NAME: z.string().trim().optional(),
    CLOUDINARY_API_KEY: z.string().trim().optional(),
    CLOUDINARY_API_SECRET: z.string().trim().optional(),
    CLOUDINARY_UPLOAD_FOLDER: z.string().trim().optional(),
  })
  .superRefine((value, context) => {
    const credentials = [
      value.CLOUDINARY_CLOUD_NAME,
      value.CLOUDINARY_API_KEY,
      value.CLOUDINARY_API_SECRET,
    ]
    const present = credentials.filter(Boolean).length

    if (present > 0 && present < credentials.length) {
      context.addIssue({
        code: 'custom',
        path: ['CLOUDINARY_CLOUD_NAME'],
        message:
          'Cloudinary credentials must be set together: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.',
      })
    }

    if (value.DOMAIN_PROVIDER === 'http') {
      if (!value.DOMAIN_PROVIDER_URL) {
        context.addIssue({
          code: 'custom',
          path: ['DOMAIN_PROVIDER_URL'],
          message: 'DOMAIN_PROVIDER_URL is required when DOMAIN_PROVIDER=http.',
        })
      }
      if (!value.DOMAIN_PROVIDER_TOKEN) {
        context.addIssue({
          code: 'custom',
          path: ['DOMAIN_PROVIDER_TOKEN'],
          message: 'DOMAIN_PROVIDER_TOKEN is required when DOMAIN_PROVIDER=http.',
        })
      }
    }

    if (value.DOMAIN_PROVIDER === 'fake' && value.NODE_ENV === 'production') {
      context.addIssue({
        code: 'custom',
        path: ['DOMAIN_PROVIDER'],
        message:
          'DOMAIN_PROVIDER=fake is not allowed in production. Configure the http provider with server-only credentials.',
      })
    }
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
