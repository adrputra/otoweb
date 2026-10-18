import { NextResponse, type NextRequest } from 'next/server'

import { recordAnalyticsEvent } from '@/lib/analytics/record'
import { getAppDatabase } from '@/lib/db/runtime'
import { whatsappLink } from '@/lib/format'
import { createWhatsappLead } from '@/lib/public/lead-service'
import { resolvePublicTenant } from '@/lib/public/tenant'
import { getShowroomSettings } from '@/lib/tenant/scoped-queries'

export const dynamic = 'force-dynamic'

/**
 * Durable WhatsApp click tracking.
 *
 * The tenant is resolved from the verified request hostname. The lead is
 * written before the redirect, and the destination is built from the tenant's
 * stored number so the query string cannot redirect elsewhere.
 */
export async function GET(request: NextRequest) {
  const tenant = await resolvePublicTenant()
  if (!tenant) {
    return NextResponse.json({ error: 'Showroom not found' }, { status: 404 })
  }

  const db = await getAppDatabase()
  const settings = await getShowroomSettings(db, tenant.id)
  const showroomName = settings?.displayName?.trim() || tenant.name
  const vehicleSlug = request.nextUrl.searchParams.get('vehicle')

  const result = await createWhatsappLead(db, tenant.id, {
    vehicleSlug,
    showroomName,
  })

  if (!result.ok) {
    return NextResponse.redirect(new URL('/?inquiry=failed#contact', request.url))
  }

  // Reuse the lead write as the WhatsApp click signal instead of adding a
  // second client-side beacon that would double-count the same click.
  await recordAnalyticsEvent(db, tenant.id, {
    eventType: 'whatsapp_click',
    vehicleId: result.data.vehicleId,
    vehicleSlug,
  }).catch(() => {})

  const number = settings?.whatsapp?.trim()
  if (!number) {
    return NextResponse.redirect(new URL('/#contact', request.url))
  }

  return NextResponse.redirect(whatsappLink(number, result.data.message))
}
