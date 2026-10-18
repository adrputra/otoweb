import { z } from 'zod'

/**
 * Shared vehicle input contract.
 *
 * The admin form validates against this schema for immediate feedback and the
 * server re-parses the same shape before writing. The schema is intentionally
 * free of database and Node imports so it can run in the browser.
 */

export const VEHICLE_TRANSMISSIONS = ['AT', 'MT', 'CVT'] as const
export const VEHICLE_FUELS = ['bensin', 'diesel', 'hybrid', 'listrik'] as const
export const VEHICLE_PUBLICATIONS = ['draft', 'published', 'archived'] as const
export const VEHICLE_ACTIONS = ['publish', 'reserve', 'sell', 'archive'] as const

const taxExpirySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Tanggal pajak tidak valid')
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`)
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value)
  }, 'Tanggal pajak tidak valid')

const featureSchema = z.string().trim().min(1).max(60)

export const vehicleInputSchema = z.object({
  brand: z.string().trim().min(1, 'Pilih brand').max(80),
  model: z.string().trim().min(1, 'Pilih model').max(80),
  variant: z.string().trim().min(1, 'Isi varian').max(80),
  year: z.number().int().min(1980, 'Tahun minimal 1980').max(2030, 'Tahun maksimal 2030'),
  transmission: z.enum(VEHICLE_TRANSMISSIONS),
  fuel: z.enum(VEHICLE_FUELS),
  bodyType: z.string().trim().min(1, 'Isi tipe bodi').max(40),
  engineCc: z.number().int().min(1, 'Isi kapasitas mesin').max(20_000),
  mileageKm: z.number().int().min(0).max(2_000_000),
  color: z.string().trim().min(1, 'Isi warna').max(40),
  price: z.number().int().positive('Harga wajib diisi').max(100_000_000_000),
  plateRegion: z.string().trim().min(1, 'Isi plat nomor').max(20),
  taxExpiry: taxExpirySchema,
  description: z.string().trim().min(10, 'Minimal 10 karakter').max(5000),
  featured: z.boolean(),
  location: z.string().trim().min(1, 'Isi lokasi').max(100),
  features: z.array(featureSchema).max(50).default([]),
  ownerCount: z.number().int().min(0).max(99).default(0),
  documents: z
    .object({
      stnk: z.boolean(),
      bpkb: z.boolean(),
    })
    .default({ stnk: false, bpkb: false }),
  publication: z.enum(VEHICLE_PUBLICATIONS).default('draft'),
})

export type VehicleInput = z.output<typeof vehicleInputSchema>
export type VehicleFormValues = z.input<typeof vehicleInputSchema>

export const vehicleIdSchema = z.string().uuid('ID kendaraan tidak valid')
export const vehicleActionSchema = z.enum(VEHICLE_ACTIONS)

/** Deterministic slug base used when creating or duplicating a vehicle. */
export function slugifyVehicle(...parts: (string | number)[]): string {
  const slug = parts
    .join(' ')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')

  return (slug || 'kendaraan').slice(0, 120).replace(/-+$/g, '')
}
