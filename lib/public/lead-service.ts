import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'

import { leads } from '@/db/schema'
import type * as schema from '@/db/schema'
import { leadVehicleLabel, toLead } from '@/lib/lead-mapper'
import { getTenantVehicleBySlug, requireTenantId } from '@/lib/tenant/scoped-queries'
import type { Lead } from '@/lib/types'
import { contactLeadInputSchema } from '@/lib/validation/lead'

type Database = PgDatabase<PgQueryResultHKT, typeof schema>

export type LeadCreationResult =
  | { ok: true; data: Lead }
  | {
      ok: false
      error: 'invalid' | 'unavailable'
      fieldErrors?: Record<string, string[]>
      message?: string
    }

function invalid(fieldErrors: Record<string, string[]>): LeadCreationResult {
  return {
    ok: false,
    error: 'invalid',
    fieldErrors,
    message: 'Periksa kembali data Anda.',
  }
}

function unavailable(message = 'Permintaan tidak dapat diproses.'): LeadCreationResult {
  return { ok: false, error: 'unavailable', message }
}

function toFieldErrors(issues: { path: PropertyKey[]; message: string }[]) {
  const fieldErrors: Record<string, string[]> = {}

  for (const issue of issues) {
    const key = String(issue.path[0] ?? 'form')
    const messages = fieldErrors[key] ?? []
    if (!messages.includes(issue.message)) messages.push(issue.message)
    fieldErrors[key] = messages
  }

  return fieldErrors
}

/**
 * Record a public contact-form inquiry for the resolved tenant.
 *
 * The caller supplies the tenant captured from the verified hostname; the
 * browser never sends one. Source and status are not caller-controlled.
 */
export async function createContactLead(
  db: Database,
  tenantId: string,
  input: unknown,
): Promise<LeadCreationResult> {
  const id = requireTenantId(tenantId)
  const parsed = contactLeadInputSchema.safeParse(input)
  if (!parsed.success) return invalid(toFieldErrors(parsed.error.issues))

  try {
    const [row] = await db
      .insert(leads)
      .values({
        tenantId: id,
        name: parsed.data.name,
        phone: parsed.data.phone,
        email: parsed.data.email || null,
        message: parsed.data.message,
        source: 'contact_form',
        status: 'new',
      })
      .returning()

    if (!row) return unavailable()
    return { ok: true, data: toLead(row) }
  } catch {
    return unavailable()
  }
}

/**
 * Record a WhatsApp call-to-action as a durable lead.
 *
 * The visitor has not supplied contact details, so the lead is intentionally
 * anonymous. A vehicle slug is resolved inside the tenant, so a missing or
 * foreign slug cannot attach another tenant's vehicle.
 */
export async function createWhatsappLead(
  db: Database,
  tenantId: string,
  options: { vehicleSlug?: string | null; showroomName: string },
): Promise<LeadCreationResult> {
  const id = requireTenantId(tenantId)
  const slug = options.vehicleSlug?.trim()
  const vehicle = slug ? await getTenantVehicleBySlug(db, id, slug) : null
  const label = leadVehicleLabel(vehicle)
  const message = label
    ? `Halo ${options.showroomName}, saya tertarik dengan ${label} yang saya lihat di website.`
    : `Halo ${options.showroomName}, saya ingin bertanya tentang mobil yang tersedia.`

  try {
    const [row] = await db
      .insert(leads)
      .values({
        tenantId: id,
        vehicleId: vehicle?.id ?? null,
        name: null,
        phone: null,
        email: null,
        message,
        source: 'whatsapp',
        status: 'new',
      })
      .returning()

    if (!row) return unavailable()
    return { ok: true, data: toLead(row, label) }
  } catch {
    return unavailable()
  }
}
