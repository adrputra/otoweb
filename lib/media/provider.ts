import { createCloudinaryMediaProvider, readCloudinaryConfig, DEFAULT_CLOUDINARY_FOLDER } from './cloudinary'
import { createFakeMediaProvider } from './fake'
import { createR2MediaProvider, readR2Config } from './r2'
import type { MediaProvider } from './types'

type Env = Record<string, string | undefined>

export const MEDIA_PROVIDER_KEYS = ['cloudinary', 'r2', 'fake'] as const

function assertServerOnly(): void {
  if (typeof window !== 'undefined') {
    throw new Error('lib/media/provider is server-only and must never be imported by browser code.')
  }
}

function readString(env: Env, key: string): string {
  return env[key]?.trim() ?? ''
}

function fakeProvider(env: Env): MediaProvider {
  return createFakeMediaProvider({
    baseDir: readString(env, 'MEDIA_LOCAL_DIR') || `${process.cwd()}/public/uploads`,
    urlPrefix: readString(env, 'MEDIA_PUBLIC_PREFIX') || '/uploads',
  })
}

/**
 * Folder prefix for deterministic provider public ids. Shared by uploads and
 * the fake provider so tests exercise the same path shape as production.
 */
export function resolveMediaFolder(env: Env = process.env): string {
  return (
    readString(env, 'MEDIA_UPLOAD_FOLDER') ||
    readString(env, 'CLOUDINARY_UPLOAD_FOLDER') ||
    DEFAULT_CLOUDINARY_FOLDER
  )
}

/**
 * Resolve the configured media provider.
 *
 * Priority:
 * 1. An explicit `MEDIA_PROVIDER` (`r2`, `cloudinary`, or `fake`).
 * 2. Complete Cloudflare R2 credentials.
 * 3. Complete Cloudinary credentials.
 * 4. The deterministic fake provider outside production.
 *
 * A partial credential set is an error; production never silently accepts
 * media it cannot store.
 */
export function resolveMediaProvider(env: Env = process.env): MediaProvider {
  assertServerOnly()

  const explicit = readString(env, 'MEDIA_PROVIDER')
  if (explicit && !MEDIA_PROVIDER_KEYS.includes(explicit as (typeof MEDIA_PROVIDER_KEYS)[number])) {
    throw new Error('MEDIA_PROVIDER must be "cloudinary", "r2", or "fake".')
  }

  const isProduction = env.NODE_ENV === 'production'

  if (explicit === 'fake') {
    if (isProduction) {
      throw new Error('MEDIA_PROVIDER=fake is not allowed in production.')
    }
    return fakeProvider(env)
  }

  if (explicit === 'r2') {
    const config = readR2Config(env)
    if (!config) {
      throw new Error(
        'MEDIA_PROVIDER=r2 requires R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_BASE_URL, and R2_ACCOUNT_ID (or R2_ENDPOINT).',
      )
    }
    return createR2MediaProvider(config)
  }

  if (explicit === 'cloudinary') {
    const config = readCloudinaryConfig(env)
    if (!config) {
      throw new Error(
        'MEDIA_PROVIDER=cloudinary requires CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.',
      )
    }
    return createCloudinaryMediaProvider(config)
  }

  const r2 = readR2Config(env)
  if (r2) return createR2MediaProvider(r2)

  const cloudinary = readCloudinaryConfig(env)
  if (cloudinary) return createCloudinaryMediaProvider(cloudinary)

  if (!isProduction) return fakeProvider(env)

  throw new Error(
    'Media storage is not configured. Set R2_* (recommended) or CLOUDINARY_* variables.',
  )
}

/**
 * Non-throwing provider lookup for post-commit cleanup. Returns null in
 * production when media is not configured, because cleanup is best-effort and
 * must never block a vehicle deletion.
 */
export function resolveMediaProviderOrNull(env: Env = process.env): MediaProvider | null {
  assertServerOnly()

  const explicit = readString(env, 'MEDIA_PROVIDER')

  if (explicit === 'fake') {
    return env.NODE_ENV !== 'production' ? fakeProvider(env) : null
  }

  try {
    if (explicit === 'r2') {
      const r2 = readR2Config(env)
      return r2 ? createR2MediaProvider(r2) : null
    }

    if (explicit === 'cloudinary') {
      const cloudinary = readCloudinaryConfig(env)
      return cloudinary ? createCloudinaryMediaProvider(cloudinary) : null
    }

    const r2 = readR2Config(env)
    if (r2) return createR2MediaProvider(r2)

    const cloudinary = readCloudinaryConfig(env)
    if (cloudinary) return createCloudinaryMediaProvider(cloudinary)
  } catch {
    return null
  }

  if (env.NODE_ENV !== 'production') return fakeProvider(env)

  return null
}
