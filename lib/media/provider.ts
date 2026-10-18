import { createCloudinaryMediaProvider, readCloudinaryConfig, DEFAULT_CLOUDINARY_FOLDER } from './cloudinary'
import { createFakeMediaProvider } from './fake'
import type { MediaProvider } from './types'

type Env = Record<string, string | undefined>

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
  return readString(env, 'CLOUDINARY_UPLOAD_FOLDER') || DEFAULT_CLOUDINARY_FOLDER
}

/**
 * Resolve the configured media provider.
 *
 * - Complete Cloudinary credentials always win.
 * - In non-production, an explicit `MEDIA_PROVIDER=fake` or no configuration
 *   selects the deterministic local provider.
 * - In production, missing Cloudinary credentials raise a clear error so the
 *   upload route cannot silently accept media it cannot store.
 */
export function resolveMediaProvider(env: Env = process.env): MediaProvider {
  assertServerOnly()

  const explicit = readString(env, 'MEDIA_PROVIDER')
  if (explicit && explicit !== 'cloudinary' && explicit !== 'fake') {
    throw new Error('MEDIA_PROVIDER must be either "cloudinary" or "fake".')
  }

  const isProduction = env.NODE_ENV === 'production'

  if (explicit === 'fake') {
    if (isProduction) {
      throw new Error('MEDIA_PROVIDER=fake is not allowed in production.')
    }
    return fakeProvider(env)
  }

  const cloudinary = readCloudinaryConfig(env)
  if (cloudinary) return createCloudinaryMediaProvider(cloudinary)

  if (!isProduction) return fakeProvider(env)

  throw new Error(
    'Media storage is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.',
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
  if (explicit === 'fake' && env.NODE_ENV !== 'production') return fakeProvider(env)

  const cloudinary = readCloudinaryConfig(env)
  if (cloudinary) return createCloudinaryMediaProvider(cloudinary)

  if (env.NODE_ENV !== 'production') return fakeProvider(env)

  return null
}
