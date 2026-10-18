import { eq } from 'drizzle-orm'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'

import { showroomSettings } from '@/db/schema'
import type * as schema from '@/db/schema'
import {
  getShowroomSettings as getScopedShowroomSettings,
  requireTenantId,
} from '@/lib/tenant/scoped-queries'
import { withTenantSession } from '@/lib/tenant/session'
import {
  DEFAULT_PRIMARY_COLOR,
  DEFAULT_SECONDARY_COLOR,
  emptyToNull,
  normalizeShowroomSettings,
  nullToEmpty,
  showroomSettingsInputSchema,
  type ShowroomSettingsInput,
} from '@/lib/validation/showroom-settings'

type Database = PgDatabase<PgQueryResultHKT, typeof schema>
type ShowroomSettingsRow = typeof showroomSettings.$inferSelect

export interface SettingsActor {
  tenantId: string
  userId: string
  isPlatformAdmin: boolean
}

export type ShowroomSettingsServiceError = 'invalid' | 'not_found'

export type ShowroomSettingsServiceResult<T> =
  | { ok: true; data: T }
  | {
      ok: false
      error: ShowroomSettingsServiceError
      fieldErrors?: Record<string, string[]>
      message?: string
    }

export interface ShowroomSettingsSnapshot {
  /** Form-shaped values, including empty strings for unset optional fields. */
  values: ShowroomSettingsInput
  /** Whether the tenant already had a persisted row before this read. */
  exists: boolean
  /** Null when the tenant has never saved settings. */
  updatedAt: string | null
}

function defaultValues(displayName: string): ShowroomSettingsInput {
  return {
    displayName,
    tagline: '',
    description: '',
    logoUrl: '',
    heroImageUrl: '',
    primaryColor: DEFAULT_PRIMARY_COLOR,
    secondaryColor: DEFAULT_SECONDARY_COLOR,
    phone: '',
    whatsapp: '',
    email: '',
    address: '',
    city: '',
    province: '',
    postalCode: '',
    googleMapsUrl: '',
    instagramUrl: '',
    tiktokUrl: '',
    facebookUrl: '',
    openingHours: '',
    seoTitle: '',
    seoDescription: '',
  }
}

function toValues(row: ShowroomSettingsRow): ShowroomSettingsInput {
  return {
    displayName: row.displayName,
    tagline: nullToEmpty(row.tagline),
    description: nullToEmpty(row.description),
    logoUrl: nullToEmpty(row.logoUrl),
    heroImageUrl: nullToEmpty(row.heroImageUrl),
    primaryColor: row.primaryColor ?? DEFAULT_PRIMARY_COLOR,
    secondaryColor: row.secondaryColor ?? DEFAULT_SECONDARY_COLOR,
    phone: nullToEmpty(row.phone),
    whatsapp: nullToEmpty(row.whatsapp),
    email: nullToEmpty(row.email),
    address: nullToEmpty(row.address),
    city: nullToEmpty(row.city),
    province: nullToEmpty(row.province),
    postalCode: nullToEmpty(row.postalCode),
    googleMapsUrl: nullToEmpty(row.googleMapsUrl),
    instagramUrl: nullToEmpty(row.instagramUrl),
    tiktokUrl: nullToEmpty(row.tiktokUrl),
    facebookUrl: nullToEmpty(row.facebookUrl),
    openingHours: nullToEmpty(row.openingHours),
    seoTitle: nullToEmpty(row.seoTitle),
    seoDescription: nullToEmpty(row.seoDescription),
  }
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

function parseInput(input: unknown): ShowroomSettingsServiceResult<ShowroomSettingsInput> {
  const parsed = showroomSettingsInputSchema.safeParse(input)

  if (!parsed.success) {
    return {
      ok: false,
      error: 'invalid',
      fieldErrors: toFieldErrors(parsed.error.issues),
      message: 'Periksa kembali profil showroom.',
    }
  }

  return { ok: true, data: normalizeShowroomSettings(parsed.data) }
}

function valuesForWrite(input: ShowroomSettingsInput) {
  return {
    displayName: input.displayName,
    tagline: emptyToNull(input.tagline),
    description: emptyToNull(input.description),
    logoUrl: emptyToNull(input.logoUrl),
    heroImageUrl: emptyToNull(input.heroImageUrl),
    primaryColor: input.primaryColor,
    secondaryColor: input.secondaryColor,
    phone: emptyToNull(input.phone),
    whatsapp: emptyToNull(input.whatsapp),
    email: emptyToNull(input.email),
    address: emptyToNull(input.address),
    city: emptyToNull(input.city),
    province: emptyToNull(input.province),
    postalCode: emptyToNull(input.postalCode),
    googleMapsUrl: emptyToNull(input.googleMapsUrl),
    instagramUrl: emptyToNull(input.instagramUrl),
    tiktokUrl: emptyToNull(input.tiktokUrl),
    facebookUrl: emptyToNull(input.facebookUrl),
    openingHours: emptyToNull(input.openingHours),
    seoTitle: emptyToNull(input.seoTitle),
    seoDescription: emptyToNull(input.seoDescription),
  }
}

/**
 * Read the tenant's settings for the admin editor. A tenant without a row gets
 * safe defaults based on its own name; no other tenant is consulted.
 */
export async function getAdminShowroomSettings(
  db: Database,
  tenantId: string,
  fallbackDisplayName: string,
): Promise<ShowroomSettingsSnapshot> {
  const id = requireTenantId(tenantId)
  const row = await getScopedShowroomSettings(db, id)

  if (!row) {
    return {
      values: defaultValues(fallbackDisplayName.trim() || 'Showroom'),
      exists: false,
      updatedAt: null,
    }
  }

  return {
    values: toValues(row),
    exists: true,
    updatedAt: row.updatedAt.toISOString(),
  }
}

/**
 * Persist the complete settings form for the actor's tenant.
 *
 * The payload never carries a tenant or settings id; the actor context is the
 * only write target and the transaction runs with tenant-local RLS settings.
 */
export async function updateAdminShowroomSettings(
  db: Database,
  actor: SettingsActor,
  input: unknown,
): Promise<ShowroomSettingsServiceResult<ShowroomSettingsSnapshot>> {
  const parsed = parseInput(input)
  if (!parsed.ok) return parsed

  const tenantId = requireTenantId(actor.tenantId)
  const now = new Date()

  return withTenantSession(db, actor, async (tx) => {
    const existing = await getScopedShowroomSettings(tx, tenantId)
    const values = valuesForWrite(parsed.data)

    const rows = existing
      ? await tx
          .update(showroomSettings)
          .set({ ...values, updatedAt: now })
          .where(eq(showroomSettings.tenantId, tenantId))
          .returning()
      : await tx
          .insert(showroomSettings)
          .values({ tenantId, ...values, createdAt: now, updatedAt: now })
          .returning()

    const row = rows[0]
    if (!row) {
      return {
        ok: false as const,
        error: 'not_found' as const,
        message: 'Profil showroom tidak ditemukan.',
      }
    }

    return {
      ok: true as const,
      data: {
        values: toValues(row),
        exists: true,
        updatedAt: row.updatedAt.toISOString(),
      },
    }
  })
}
