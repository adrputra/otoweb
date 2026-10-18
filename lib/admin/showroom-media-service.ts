import { createHash } from 'node:crypto'

import { inspectImage } from '@/lib/media/inspect'
import { uploadWithRetry, type RetryOptions } from '@/lib/media/retry'
import type { MediaProvider, MediaProviderKey } from '@/lib/media/types'
import { requireTenantId } from '@/lib/tenant/scoped-queries'

import type { SettingsActor } from './showroom-settings-service'

export const SHOWROOM_MEDIA_FOLDER = 'otoweb/showrooms'

export const SHOWROOM_MEDIA_KINDS = ['logo', 'hero'] as const
export type ShowroomMediaKind = (typeof SHOWROOM_MEDIA_KINDS)[number]

export type ShowroomMediaError = 'invalid' | 'provider'

export type ShowroomMediaResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ShowroomMediaError; message: string; fieldErrors?: Record<string, string[]> }

export interface UploadShowroomMediaInput {
  readonly bytes: Uint8Array
  readonly filename: string
}

export interface UploadShowroomMediaOptions {
  readonly folder?: string
  readonly retry?: RetryOptions
}

export interface UploadedShowroomMedia {
  readonly url: string
  readonly provider: MediaProviderKey
  readonly assetId: string
  readonly width: number
  readonly height: number
}

export function isShowroomMediaKind(value: unknown): value is ShowroomMediaKind {
  return typeof value === 'string' && SHOWROOM_MEDIA_KINDS.includes(value as ShowroomMediaKind)
}

function safeFolder(folder: string): string {
  const cleaned = folder
    .split('/')
    .map((segment) => segment.replace(/[^a-zA-Z0-9._-]/g, '-'))
    .filter((segment) => segment.length > 0 && segment !== '.' && segment !== '..')
    .join('/')

  return cleaned || SHOWROOM_MEDIA_FOLDER
}

function assetPublicId(
  folder: string,
  tenantId: string,
  kind: ShowroomMediaKind,
  bytes: Uint8Array,
): string {
  const digest = createHash('sha256').update(bytes).digest('hex')
  return `${safeFolder(folder)}/${tenantId}/settings/${kind}/${digest}`
}

/**
 * Validate and upload one showroom media asset.
 *
 * The caller must have already authorized the request with `manage_settings`.
 * The actor tenant is part of the deterministic provider id, so two tenants can
 * never overwrite each other's logo or hero even when they upload identical
 * bytes. Content inspection happens before any provider call.
 */
export async function uploadShowroomMedia(
  actor: SettingsActor,
  kind: ShowroomMediaKind,
  input: UploadShowroomMediaInput,
  provider: MediaProvider,
  options: UploadShowroomMediaOptions = {},
): Promise<ShowroomMediaResult<UploadedShowroomMedia>> {
  if (!isShowroomMediaKind(kind)) {
    return {
      ok: false,
      error: 'invalid',
      message: 'Jenis media tidak valid.',
      fieldErrors: { kind: ['Pilih logo atau gambar hero.'] },
    }
  }

  const tenantId = requireTenantId(actor.tenantId)
  const inspection = inspectImage(input.bytes)
  if (!inspection.ok) {
    return {
      ok: false,
      error: 'invalid',
      message: inspection.message,
      fieldErrors: { file: [inspection.message] },
    }
  }

  const publicId = assetPublicId(
    options.folder ?? SHOWROOM_MEDIA_FOLDER,
    tenantId,
    kind,
    input.bytes,
  )

  try {
    const uploaded = await uploadWithRetry(
      provider,
      {
        bytes: input.bytes,
        filename: input.filename,
        contentType: inspection.image.contentType,
        publicId,
        width: inspection.image.width,
        height: inspection.image.height,
      },
      options.retry,
    )

    return {
      ok: true,
      data: {
        url: uploaded.url,
        provider: uploaded.provider,
        assetId: uploaded.assetId,
        width: uploaded.width,
        height: uploaded.height,
      },
    }
  } catch {
    return {
      ok: false,
      error: 'provider',
      message: 'Gagal mengunggah media. Coba lagi.',
    }
  }
}
