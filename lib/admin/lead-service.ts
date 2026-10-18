import { and, eq } from 'drizzle-orm'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'

import { leads } from '@/db/schema'
import type * as schema from '@/db/schema'
import { toLead } from '@/lib/admin/lead-mapper'
import { withTenantSession } from '@/lib/tenant/session'
import type { Lead } from '@/lib/types'
import { updateLeadStatusInputSchema } from '@/lib/validation/lead'

type Database = PgDatabase<PgQueryResultHKT, typeof schema>

export interface LeadActor {
  tenantId: string
  userId: string
  isPlatformAdmin: boolean
}

export type LeadServiceError = 'invalid' | 'not_found'

export type LeadServiceResult<T> =
  | { ok: true; data: T }
  | {
      ok: false
      error: LeadServiceError
      fieldErrors?: Record<string, string[]>
      message?: string
    }

function invalid(fieldErrors: Record<string, string[]>): LeadServiceResult<never> {
  return {
    ok: false,
    error: 'invalid',
    fieldErrors,
    message: 'Status lead tidak valid.',
  }
}

function notFound(): LeadServiceResult<never> {
  return { ok: false, error: 'not_found', message: 'Lead tidak ditemukan.' }
}

/**
 * Update a lead status inside the tenant session.
 *
 * The id is validated and the statement filters by both the id and the actor's
 * tenant, so a cross-tenant identifier updates zero rows even if it exists.
 */
export async function updateLeadStatus(
  db: Database,
  actor: LeadActor,
  input: unknown,
): Promise<LeadServiceResult<Lead>> {
  const parsed = updateLeadStatusInputSchema.safeParse(input)
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {}
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? 'form')
      fieldErrors[key] = [...(fieldErrors[key] ?? []), issue.message]
    }
    return invalid(fieldErrors)
  }

  const now = new Date()

  return withTenantSession(db, actor, async (tx) => {
    const [row] = await tx
      .update(leads)
      .set({ status: parsed.data.status, updatedAt: now })
      .where(
        and(eq(leads.tenantId, actor.tenantId), eq(leads.id, parsed.data.leadId)),
      )
      .returning()

    if (!row) return notFound()
    return { ok: true as const, data: toLead(row) }
  })
}
