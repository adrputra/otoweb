import {
  MAX_IMAGE_BYTES,
  MIN_IMAGE_HEIGHT,
  MIN_IMAGE_WIDTH,
  type AcceptedImageType,
} from './limits'

export type ImageValidationCode = 'unsupported_type' | 'corrupt' | 'too_large' | 'too_small'

export interface InspectedImage {
  readonly contentType: AcceptedImageType
  readonly extension: 'jpg' | 'png' | 'webp'
  readonly width: number
  readonly height: number
}

export type ImageInspection =
  | { readonly ok: true; readonly image: InspectedImage }
  | { readonly ok: false; readonly code: ImageValidationCode; readonly message: string }

export interface ImageInspectionOptions {
  readonly maxBytes?: number
  readonly minWidth?: number
  readonly minHeight?: number
}

const MESSAGES = {
  unsupported_type: 'Format foto harus JPEG, PNG, atau WebP.',
  corrupt: 'Berkas foto tidak dapat dibaca.',
  too_large: 'Ukuran foto maksimal 10 MB.',
  too_small: 'Resolusi foto minimal 640 × 480 piksel.',
} as const

function fail(code: ImageValidationCode): ImageInspection {
  return { ok: false, code, message: MESSAGES[code] }
}

function startsWith(bytes: Uint8Array, signature: readonly number[]): boolean {
  if (bytes.length < signature.length) return false
  return signature.every((value, index) => bytes[index] === value)
}

function readUint16BE(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] ?? 0) << 8) | (bytes[offset + 1] ?? 0)
}

function readUint16LE(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] ?? 0) | ((bytes[offset + 1] ?? 0) << 8)
}

function readUint32BE(bytes: Uint8Array, offset: number): number {
  return (
    (((bytes[offset] ?? 0) << 24) |
      ((bytes[offset + 1] ?? 0) << 16) |
      ((bytes[offset + 2] ?? 0) << 8) |
      (bytes[offset + 3] ?? 0)) >>>
    0
  )
}

function pngDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 24) return null
  // The IHDR chunk is required to be first: 8-byte signature + 8-byte
  // length/type header, so width starts at byte 16.
  if (bytes[12] !== 0x49 || bytes[13] !== 0x48 || bytes[14] !== 0x44 || bytes[15] !== 0x52) {
    return null
  }
  const width = readUint32BE(bytes, 16)
  const height = readUint32BE(bytes, 20)
  if (width <= 0 || height <= 0) return null
  return { width, height }
}

function jpegDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  let offset = 2

  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1
      continue
    }

    let marker = bytes[offset + 1] ?? 0
    while (marker === 0xff) {
      offset += 1
      marker = bytes[offset + 1] ?? 0
    }

    // Standalone markers carry no length.
    if (marker === 0xd8 || marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2
      continue
    }

    const segmentLength = readUint16BE(bytes, offset + 2)
    if (segmentLength < 2) return null

    const isStartOfFrame =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf)

    if (isStartOfFrame) {
      if (offset + 9 > bytes.length) return null
      const height = readUint16BE(bytes, offset + 5)
      const width = readUint16BE(bytes, offset + 7)
      if (width <= 0 || height <= 0) return null
      return { width, height }
    }

    offset += 2 + segmentLength
  }

  return null
}

function webpDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 16) return null

  const chunk = String.fromCharCode(bytes[12] ?? 0, bytes[13] ?? 0, bytes[14] ?? 0, bytes[15] ?? 0)

  if (chunk === 'VP8 ') {
    if (bytes.length < 30) return null
    // Lossy: frame tag at 20..22, start code 9d 01 2a at 23..25, dimensions at 26..29.
    if (bytes[23] !== 0x9d || bytes[24] !== 0x01 || bytes[25] !== 0x2a) return null
    const width = readUint16LE(bytes, 26) & 0x3fff
    const height = readUint16LE(bytes, 28) & 0x3fff
    if (width <= 0 || height <= 0) return null
    return { width, height }
  }

  if (chunk === 'VP8L') {
    if (bytes.length < 25 || bytes[20] !== 0x2f) return null
    const b0 = bytes[21] ?? 0
    const b1 = bytes[22] ?? 0
    const b2 = bytes[23] ?? 0
    const b3 = bytes[24] ?? 0
    const width = 1 + (((b1 & 0x3f) << 8) | b0)
    const height = 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6))
    if (width <= 0 || height <= 0) return null
    return { width, height }
  }

  if (chunk === 'VP8X') {
    if (bytes.length < 30) return null
    const width = 1 + readUint16LE(bytes, 24) + ((bytes[26] ?? 0) << 16)
    const height = 1 + readUint16LE(bytes, 27) + ((bytes[29] ?? 0) << 16)
    if (width <= 0 || height <= 0) return null
    return { width, height }
  }

  return null
}

/**
 * Inspect image content without trusting the client-supplied MIME type.
 * Returns dimensions parsed from the file header.
 */
export function inspectImage(
  bytes: Uint8Array,
  options: ImageInspectionOptions = {},
): ImageInspection {
  const maxBytes = options.maxBytes ?? MAX_IMAGE_BYTES
  const minWidth = options.minWidth ?? MIN_IMAGE_WIDTH
  const minHeight = options.minHeight ?? MIN_IMAGE_HEIGHT

  if (bytes.length === 0) return fail('corrupt')
  if (bytes.length > maxBytes) return fail('too_large')

  let contentType: AcceptedImageType
  let extension: InspectedImage['extension']
  let dimensions: { width: number; height: number } | null

  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    contentType = 'image/png'
    extension = 'png'
    dimensions = pngDimensions(bytes)
  } else if (startsWith(bytes, [0xff, 0xd8, 0xff])) {
    contentType = 'image/jpeg'
    extension = 'jpg'
    dimensions = jpegDimensions(bytes)
  } else if (
    startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    startsWith(bytes.slice(8, 12), [0x57, 0x45, 0x42, 0x50])
  ) {
    contentType = 'image/webp'
    extension = 'webp'
    dimensions = webpDimensions(bytes)
  } else {
    return fail('unsupported_type')
  }

  if (!dimensions) return fail('corrupt')
  if (dimensions.width < minWidth || dimensions.height < minHeight) return fail('too_small')

  return { ok: true, image: { contentType, extension, width: dimensions.width, height: dimensions.height } }
}
