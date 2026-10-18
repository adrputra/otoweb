import { createHash } from 'node:crypto'

import {
  MediaProviderError,
  type MediaProvider,
  type MediaUploadInput,
  type MediaUploadResult,
} from './types'

export interface CloudinaryConfig {
  readonly cloudName: string
  readonly apiKey: string
  readonly apiSecret: string
  readonly folder: string
}

export const DEFAULT_CLOUDINARY_FOLDER = 'otoweb/vehicles'

type Env = Record<string, string | undefined>

function readValue(env: Env, key: string): string {
  return env[key]?.trim() ?? ''
}

/**
 * Resolve Cloudinary configuration. All credential variables must be present
 * together; a partial configuration is a startup error, never a silent
 * fallback that would accept uploads it cannot store.
 */
export function readCloudinaryConfig(env: Env = process.env): CloudinaryConfig | null {
  const cloudName = readValue(env, 'CLOUDINARY_CLOUD_NAME')
  const apiKey = readValue(env, 'CLOUDINARY_API_KEY')
  const apiSecret = readValue(env, 'CLOUDINARY_API_SECRET')
  const folder = readValue(env, 'CLOUDINARY_UPLOAD_FOLDER') || DEFAULT_CLOUDINARY_FOLDER

  const values = [cloudName, apiKey, apiSecret]
  const present = values.filter(Boolean).length

  if (present === 0) return null
  if (present !== values.length) {
    const missing = [
      !cloudName && 'CLOUDINARY_CLOUD_NAME',
      !apiKey && 'CLOUDINARY_API_KEY',
      !apiSecret && 'CLOUDINARY_API_SECRET',
    ].filter(Boolean)
    throw new Error(
      `Cloudinary is partially configured. Set all of CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET (missing: ${missing.join(', ')}).`,
    )
  }

  return { cloudName, apiKey, apiSecret, folder }
}

/** Cloudinary signs the sorted, non-empty request parameters plus the secret. */
export function cloudinarySignature(
  params: Record<string, string | number | boolean>,
  apiSecret: string,
): string {
  const payload = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => [key, String(value)] as const)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('&')

  return createHash('sha1').update(`${payload}${apiSecret}`).digest('hex')
}

export function cloudinaryUploadUrl(cloudName: string): string {
  return `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`
}

export function cloudinaryDestroyUrl(cloudName: string): string {
  return `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/destroy`
}

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

export interface CloudinaryProviderDependencies {
  readonly fetch?: FetchLike
  readonly now?: () => number
  readonly timeoutMs?: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function transientStatus(status: number): boolean {
  return status === 408 || status === 420 || status === 429 || status >= 500
}

async function readJson(response: Response): Promise<unknown> {
  return response.json().catch(() => null)
}

function providerFailure(status: number, body: unknown): MediaProviderError {
  const message =
    isRecord(body) && typeof body.error === 'string' ? body.error : `Cloudinary request failed (${status})`
  return new MediaProviderError(transientStatus(status) ? 'transient' : 'permanent', message)
}

function asDimension(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback
}

/**
 * Cloudinary implementation of the media provider contract using the documented
 * signed REST API. No SDK or credential is needed at import time.
 */
export function createCloudinaryMediaProvider(
  config: CloudinaryConfig,
  deps: CloudinaryProviderDependencies = {},
): MediaProvider {
  const fetchImpl: FetchLike = deps.fetch ?? ((input, init) => fetch(input, init))
  const now = deps.now ?? Date.now
  const timeoutMs = deps.timeoutMs ?? 30_000

  async function request(url: string, body: FormData): Promise<{ status: number; body: unknown }> {
    try {
      const response = await fetchImpl(url, {
        method: 'POST',
        body,
        signal: AbortSignal.timeout(timeoutMs),
      })
      return { status: response.status, body: await readJson(response) }
    } catch (error) {
      throw new MediaProviderError(
        'transient',
        error instanceof Error ? error.message : 'Cloudinary is unreachable.',
      )
    }
  }

  return {
    key: 'cloudinary',

    async upload(input: MediaUploadInput): Promise<MediaUploadResult> {
      const timestamp = Math.floor(now() / 1000)
      const params = {
        invalidate: 'true',
        overwrite: 'true',
        public_id: input.publicId,
        timestamp,
      }
      const signature = cloudinarySignature(params, config.apiSecret)

      const form = new FormData()
      form.append(
        'file',
        new Blob([new Uint8Array(input.bytes)], { type: input.contentType }),
        input.filename,
      )
      form.append('api_key', config.apiKey)
      for (const [key, value] of Object.entries(params)) form.append(key, String(value))
      form.append('signature', signature)

      const result = await request(cloudinaryUploadUrl(config.cloudName), form)
      if (result.status < 200 || result.status >= 300) throw providerFailure(result.status, result.body)

      const body = result.body
      if (
        !isRecord(body) ||
        typeof body.secure_url !== 'string' ||
        typeof body.public_id !== 'string'
      ) {
        throw new MediaProviderError('permanent', 'Cloudinary returned an unexpected upload response.')
      }

      return {
        provider: 'cloudinary',
        assetId: body.public_id,
        url: body.secure_url,
        width: asDimension(body.width, input.width),
        height: asDimension(body.height, input.height),
      }
    },

    async destroy(assetId: string): Promise<void> {
      if (!assetId) return

      const timestamp = Math.floor(now() / 1000)
      const params = { invalidate: 'true', public_id: assetId, timestamp }
      const signature = cloudinarySignature(params, config.apiSecret)

      const form = new FormData()
      form.append('api_key', config.apiKey)
      for (const [key, value] of Object.entries(params)) form.append(key, String(value))
      form.append('signature', signature)

      const result = await request(cloudinaryDestroyUrl(config.cloudName), form)
      if (result.status < 200 || result.status >= 300) throw providerFailure(result.status, result.body)

      if (isRecord(result.body) && result.body.result === 'not found') return
    },
  }
}
