import type { AcceptedImageType } from './limits'

export type MediaProviderKey = 'cloudinary' | 'r2' | 'fake'

export interface MediaUploadInput {
  readonly bytes: Uint8Array
  readonly filename: string
  readonly contentType: AcceptedImageType
  /** Provider public id, derived deterministically from tenant, vehicle, and content. */
  readonly publicId: string
  readonly width: number
  readonly height: number
}

export interface MediaUploadResult {
  readonly provider: MediaProviderKey
  readonly assetId: string
  readonly url: string
  readonly width: number
  readonly height: number
}

export interface MediaProvider {
  readonly key: MediaProviderKey
  upload(input: MediaUploadInput): Promise<MediaUploadResult>
  destroy(assetId: string): Promise<void>
}

export type MediaErrorCode = 'transient' | 'permanent'

/** A provider failure the caller can classify for retry decisions. */
export class MediaProviderError extends Error {
  constructor(
    readonly code: MediaErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'MediaProviderError'
  }
}

export function isMediaProviderError(error: unknown): error is MediaProviderError {
  return error instanceof MediaProviderError
}
