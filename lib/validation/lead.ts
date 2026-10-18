import { z } from 'zod'

/**
 * Shared lead contract.
 *
 * The public form validates against this schema for immediate feedback and the
 * server re-parses the same shape before writing. Keep this module free of
 * database and Node imports so it can run in the browser.
 */

export const LEAD_SOURCES = ['contact_form', 'whatsapp', 'phone', 'manual'] as const
export const LEAD_STATUSES = ['new', 'contacted', 'qualified', 'won', 'lost'] as const

export const LEAD_SOURCE_LABELS: Record<(typeof LEAD_SOURCES)[number], string> = {
  contact_form: 'Formulir kontak',
  whatsapp: 'WhatsApp',
  phone: 'Telepon',
  manual: 'Manual',
}

export const LEAD_STATUS_LABELS: Record<(typeof LEAD_STATUSES)[number], string> = {
  new: 'Baru',
  contacted: 'Dihubungi',
  qualified: 'Kualifikasi',
  won: 'Menang',
  lost: 'Kalah',
}

const phoneSchema = z
  .string()
  .trim()
  .min(1, 'Nomor telepon wajib diisi')
  .max(32, 'Nomor telepon terlalu panjang')
  .regex(/^[\d+\-().\s]+$/, 'Nomor telepon tidak valid')
  .refine(
    (value) => value.replace(/\D/g, '').length >= 6,
    'Nomor telepon minimal 6 digit',
  )

const optionalEmailSchema = z
  .string()
  .trim()
  .max(254, 'Email terlalu panjang')
  .refine(
    (value) => value === '' || z.string().email().safeParse(value).success,
    'Email tidak valid',
  )

export const contactLeadInputSchema = z.object({
  name: z.string().trim().min(1, 'Nama wajib diisi').max(120, 'Nama terlalu panjang'),
  phone: phoneSchema,
  email: optionalEmailSchema.default(''),
  message: z
    .string()
    .trim()
    .min(1, 'Pesan wajib diisi')
    .max(2_000, 'Pesan maksimal 2.000 karakter'),
})

export type ContactLeadInput = z.output<typeof contactLeadInputSchema>
export type ContactLeadFormValues = z.input<typeof contactLeadInputSchema>

export const leadSourceSchema = z.enum(LEAD_SOURCES)
export const leadStatusSchema = z.enum(LEAD_STATUSES)
export const leadIdSchema = z.string().uuid('ID lead tidak valid')

export const updateLeadStatusInputSchema = z.object({
  leadId: leadIdSchema,
  status: leadStatusSchema,
})

export type UpdateLeadStatusInput = z.output<typeof updateLeadStatusInputSchema>
