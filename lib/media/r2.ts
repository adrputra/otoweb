import { AwsClient } from 'aws4fetch'

import {
  MediaProviderError,
  type MediaProvider,
  type MediaUploadInput,
  type MediaUploadResult,
} from './types'

export interface R2Config {
  readonly accountId: string
  readonly accessKeyId: string
  readonly secretAccessKey: string
  readonly bucket: string
  /** Public origin for delivered objects, e.g. https://media.example.com */
  readonly publicBaseUrl: string
  /** S3-compatible endpoint, default https://<accountId>.r2.cloudflarestorage.com */
  readonly endpoint: string
  readonly region: string
}

type Env = Record<string, string | undefined>

function readValue(env: Env, key: string): string {
  return env[key]?.trim() ?? ''
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '')
}

/**
 * Resolve Cloudflare R2 configuration.
 *
 * All credentials must be present together. A partial configuration is a
 * startup error instead of a silent fallback that would accept uploads it
 * cannot store. `R2_ENDPOINT` may replace `R2_ACCOUNT_ID` for tests or
 * S3-compatible gateways.
 */
export function readR2Config(env: Env = process.env): R2Config | null {
  const accountId = readValue(env, 'R2_ACCOUNT_ID')
  const accessKeyId = readValue(env, 'R2_ACCESS_KEY_ID')
  const secretAccessKey = readValue(env, 'R2_SECRET_ACCESS_KEY')
  const bucket = readValue(env, 'R2_BUCKET')
  const publicBaseUrl = readValue(env, 'R2_PUBLIC_BASE_URL')
  const configuredEndpoint = readValue(env, 'R2_ENDPOINT')
  const region = readValue(env, 'R2_REGION') || 'auto'

  const hasAny =
    accountId ||
    accessKeyId ||
    secretAccessKey ||
    bucket ||
    publicBaseUrl ||
    configuredEndpoint

  if (!hasAny) return null

  const endpoint = stripTrailingSlash(
    configuredEndpoint || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : ''),
  )

  const missing: string[] = []
  if (!accessKeyId) missing.push('R2_ACCESS_KEY_ID')
  if (!secretAccessKey) missing.push('R2_SECRET_ACCESS_KEY')
  if (!bucket) missing.push('R2_BUCKET')
  if (!publicBaseUrl) missing.push('R2_PUBLIC_BASE_URL')
  if (!endpoint) missing.push('R2_ACCOUNT_ID or R2_ENDPOINT')

  if (missing.length > 0) {
    throw new Error(
      `Cloudflare R2 is partially configured. Missing: ${missing.join(', ')}.`,
    )
  }

  let publicOrigin: URL
  try {
    publicOrigin = new URL(publicBaseUrl)
  } catch {
    throw new Error('R2_PUBLIC_BASE_URL must be a valid absolute URL.')
  }

  if (!endpoint) throw new Error('R2 endpoint could not be resolved.')

  try {
    new URL(endpoint)
  } catch {
    throw new Error('R2_ENDPOINT must be a valid absolute URL.')
  }

  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucket,
    publicBaseUrl: stripTrailingSlash(publicOrigin.toString()),
    endpoint,
    region,
  }
}

type FetchLike = (input: Request, init?: RequestInit) => Promise<Response>

export interface R2ProviderDependencies {
  readonly fetch?: FetchLike
  readonly timeoutMs?: number
}

function encodeKey(key: string): string {
  return key
    .split('/')
    .filter((segment) => segment.length > 0)
    .map((segment) => encodeURIComponent(segment))
    .join('/')
}

function normalizeKey(publicId: string): string {
  const key = publicId.replace(/^\/+/, '')
  const segments = key.split('/')

  if (
    !key ||
    segments.some((segment) => segment === '' || segment === '.' || segment === '..')
  ) {
    throw new MediaProviderError('permanent', 'Invalid R2 object key.')
  }

  return key
}

function objectUrl(config: R2Config, key: string): string {
  return `${config.endpoint}/${encodeURIComponent(config.bucket)}/${encodeKey(key)}`
}

function publicUrl(config: R2Config, key: string): string {
  return `${config.publicBaseUrl}/${encodeKey(key)}`
}

function transientStatus(status: number): boolean {
  return status === 408 || status === 409 || status === 425 || status === 429 || status >= 500
}

function failure(status: number, body: string): MediaProviderError {
  const detail = body.trim().slice(0, 300)
  return new MediaProviderError(
    transientStatus(status) ? 'transient' : 'permanent',
    `Cloudflare R2 request failed (${status})${detail ? `: ${detail}` : ''}`,
  )
}

/**
 * Cloudflare R2 (S3-compatible) implementation of the media provider contract.
 *
 * Uploads use a signed `PutObject` request; deletes use `DeleteObject`. Object
 * keys are the deterministic public ids produced by the image services, so
 * repeated uploads and retries remain idempotent.
 */
export function createR2MediaProvider(
  config: R2Config,
  deps: R2ProviderDependencies = {},
): MediaProvider {
  const fetchImpl: FetchLike = deps.fetch ?? ((input, init) => fetch(input, init))
  const timeoutMs = deps.timeoutMs ?? 30_000
  const signer = new AwsClient({
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    service: 's3',
    region: config.region,
  })

  async function send(request: Request): Promise<Response> {
    try {
      return await fetchImpl(request, { signal: AbortSignal.timeout(timeoutMs) })
    } catch (error) {
      throw new MediaProviderError(
        'transient',
        error instanceof Error ? error.message : 'Cloudflare R2 is unreachable.',
      )
    }
  }

  return {
    key: 'r2',

    async upload(input: MediaUploadInput): Promise<MediaUploadResult> {
      const key = normalizeKey(input.publicId)
      const request = await signer.sign(objectUrl(config, key), {
        method: 'PUT',
        headers: {
          'content-type': input.contentType,
          'cache-control': 'public, max-age=31536000, immutable',
        },
        body: new Uint8Array(input.bytes),
      })

      const response = await send(request)
      if (!response.ok) throw failure(response.status, await response.text().catch(() => ''))

      return {
        provider: 'r2',
        assetId: key,
        url: publicUrl(config, key),
        width: input.width,
        height: input.height,
      }
    },

    async destroy(assetId: string): Promise<void> {
      const key = normalizeKey(assetId)
      const request = await signer.sign(objectUrl(config, key), { method: 'DELETE' })
      const response = await send(request)

      // Deleting an already-missing object is idempotent.
      if (response.status === 404) return
      if (!response.ok) throw failure(response.status, await response.text().catch(() => ''))
    },
  }
}
