'use server'

import { recordAnalyticsEvent } from '@/lib/analytics/record'
import { getAppDatabase } from '@/lib/db/runtime'
import { createContactLead, type LeadCreationResult } from '@/lib/public/lead-service'
import { getPublicTenant } from '@/lib/public/tenant'

/**
 * Public contact-form action.
 *
 * The tenant comes from the verified request hostname, never from the browser
 * payload. A missing tenant is a generic failure rather than a fallback to
 * another showroom.
 */
export async function submitContactLeadAction(
  input: unknown,
): Promise<LeadCreationResult> {
  const tenant = await getPublicTenant()
  if (!tenant) {
    return {
      ok: false,
      error: 'unavailable',
      message: 'Showroom tidak ditemukan. Muat ulang halaman lalu coba lagi.',
    }
  }

  const db = await getAppDatabase()
  const result = await createContactLead(db, tenant.id, input)

  if (result.ok) {
    // Best-effort and non-throwing: lead capture must never depend on analytics.
    await recordAnalyticsEvent(db, tenant.id, { eventType: 'contact_submit' }).catch(
      () => {},
    )
  }

  return result
}
