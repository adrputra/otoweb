/** Shared, client-safe image limits. Imported by both browser and server code. */

export const MAX_VEHICLE_IMAGES = 20
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024
export const MIN_IMAGE_WIDTH = 640
export const MIN_IMAGE_HEIGHT = 480
export const MAX_ALT_LENGTH = 160

export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

export type AcceptedImageType = (typeof ACCEPTED_IMAGE_TYPES)[number]

/** Value for an `<input type="file" accept="...">`. */
export const ACCEPTED_IMAGE_ACCEPT = ACCEPTED_IMAGE_TYPES.join(',')

export function isAcceptedImageType(value: string | undefined): value is AcceptedImageType {
  return ACCEPTED_IMAGE_TYPES.includes(value as AcceptedImageType)
}
