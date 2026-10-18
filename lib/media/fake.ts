import { mkdir, rm, writeFile } from 'node:fs/promises'
import { dirname, resolve, sep } from 'node:path'

import {
  MediaProviderError,
  type MediaProvider,
  type MediaUploadInput,
  type MediaUploadResult,
} from './types'

const EXTENSIONS: Record<MediaUploadInput['contentType'], string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

export interface FakeMediaProviderOptions {
  /** Directory that receives uploaded files (tests use a temp directory). */
  readonly baseDir: string
  /** Public URL prefix, default `/uploads`. */
  readonly urlPrefix?: string
  /** Number of initial uploads that fail before succeeding (transient). */
  readonly failUploads?: number
  /** Number of initial destroys that fail. */
  readonly failDestroys?: number
  /** Error classification used for injected failures. */
  readonly errorCode?: 'transient' | 'permanent'
}

export interface FakeMediaProvider extends MediaProvider {
  readonly uploads: readonly MediaUploadInput[]
  readonly destroys: readonly string[]
}

function sanitizeSegment(segment: string): string {
  return segment.replace(/[^a-zA-Z0-9._-]/g, '-')
}

function assetPath(baseDir: string, publicId: string, extension: string): string {
  const rawSegments = publicId.split('/').filter((segment) => segment.length > 0)

  if (rawSegments.length === 0 || rawSegments.some((segment) => segment === '.' || segment === '..')) {
    throw new MediaProviderError('permanent', 'Invalid media asset id.')
  }

  const segments = rawSegments.map(sanitizeSegment)

  const root = resolve(baseDir)
  const target = resolve(root, `${segments.join(sep)}.${extension}`)

  if (target !== root && !target.startsWith(`${root}${sep}`)) {
    throw new MediaProviderError('permanent', 'Invalid media asset id.')
  }

  return target
}

/**
 * Deterministic local provider for development, Visual QA, and tests.
 *
 * It writes real bytes under `baseDir`, so the admin grid renders actual images
 * while CI stays offline. Failures can be injected to prove retry behavior.
 */
export function createFakeMediaProvider(options: FakeMediaProviderOptions): FakeMediaProvider {
  const prefix = (options.urlPrefix ?? '/uploads').replace(/\/+$/, '')
  const uploads: MediaUploadInput[] = []
  const destroys: string[] = []
  let uploadsToFail = options.failUploads ?? 0
  let destroysToFail = options.failDestroys ?? 0

  return {
    key: 'fake',
    uploads,
    destroys,

    async upload(input: MediaUploadInput): Promise<MediaUploadResult> {
      uploads.push(input)

      if (uploadsToFail > 0) {
        uploadsToFail -= 1
        throw new MediaProviderError(
          options.errorCode ?? 'transient',
          'Injected fake provider upload failure.',
        )
      }

      const extension = EXTENSIONS[input.contentType]
      const path = assetPath(options.baseDir, input.publicId, extension)

      await mkdir(dirname(path), { recursive: true })
      await writeFile(path, input.bytes)

      return {
        provider: 'fake',
        assetId: input.publicId,
        url: `${prefix}/${input.publicId}.${extension}`,
        width: input.width,
        height: input.height,
      }
    },

    async destroy(assetId: string): Promise<void> {
      destroys.push(assetId)

      if (destroysToFail > 0) {
        destroysToFail -= 1
        throw new MediaProviderError(
          options.errorCode ?? 'transient',
          'Injected fake provider destroy failure.',
        )
      }

      for (const extension of Object.values(EXTENSIONS)) {
        await rm(assetPath(options.baseDir, assetId, extension), { force: true })
      }
    },
  }
}
