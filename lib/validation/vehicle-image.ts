import { z } from 'zod'

import { MAX_ALT_LENGTH, MAX_VEHICLE_IMAGES } from '@/lib/media/limits'

/** Optional caption for an uploaded photo. */
export const imageAltSchema = z
  .string()
  .trim()
  .max(MAX_ALT_LENGTH, `Keterangan foto maksimal ${MAX_ALT_LENGTH} karakter.`)
  .optional()

const imageIdSchema = z.string().uuid('ID foto tidak valid')

export const reorderVehicleImagesSchema = z.object({
  action: z.literal('reorder'),
  imageIds: z
    .array(imageIdSchema)
    .min(1, 'Tidak ada foto untuk diurutkan.')
    .max(MAX_VEHICLE_IMAGES),
})

export const coverVehicleImageSchema = z.object({
  action: z.literal('cover'),
  imageId: imageIdSchema,
})

export const vehicleImageActionSchema = z.discriminatedUnion('action', [
  reorderVehicleImagesSchema,
  coverVehicleImageSchema,
])

export type VehicleImageAction = z.output<typeof vehicleImageActionSchema>
