import { NextResponse, type NextRequest } from 'next/server'

import { MAX_ANALYTICS_BODY_BYTES, normalizeAnalyticsEvent } from '@/lib/analytics/events'
import { recordAnalyticsEvent } from '@/lib/analytics/record'
import { getAppDatabase } from '@/lib/db/runtime'
import { resolvePublicTenant } from '@/lib/public/tenant'

export const dynamic = 'force-dynamic'

function noContent(): NextResponse {
  return new NextResponse(null, { status: 204 })
}

/**
 * Public, best-effort analytics beacon.
 *
 * Every outcome is a quiet 204 so a visitor never sees an analytics error and a
 * tracking failure never influences page behavior. The tenant always comes from
 * the verified request hostname, never from the payload.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    if (body.length > MAX_ANALYTICS_BODY_BYTES) return noContent()

    let parsed: unknown
    try {
      parsed = JSON.parse(body)
    } catch {
      return noContent()
    }

    const event = normalizeAnalyticsEvent(parsed, { publicOnly: true })
    if (!event) return noContent()

    const tenant = await resolvePublicTenant()
    if (!tenant) return noContent()

    const db = await getAppDatabase()
    await recordAnalyticsEvent(db, tenant.id, {
      eventType: event.eventType,
      vehicleSlug: event.vehicleSlug,
      path: event.path,
      metadata: event.metadata,
    })
  } catch {
    // Quiet by design: rendering and lead capture never depend on this route.
  }

  return noContent()
}

export function GET(): NextResponse {
  return new NextResponse(null, { status: 405 })
}
