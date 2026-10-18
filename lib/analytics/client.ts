'use client'

import type { PublicAnalyticsEventType } from './events'

const ENDPOINT = '/api/public/analytics'

export interface PublicAnalyticsPayload {
  event: PublicAnalyticsEventType
  vehicleSlug?: string
  path?: string
  filters?: Record<string, string>
  method?: 'native' | 'clipboard'
}

/**
 * Send one best-effort analytics beacon.
 *
 * Analytics is never allowed to break the interaction: beacon refusal, network
 * errors, and missing browser APIs all resolve silently.
 */
export function trackAnalytics(payload: PublicAnalyticsPayload): void {
  let body: string
  try {
    body = JSON.stringify(payload)
  } catch {
    return
  }

  try {
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([body], { type: 'application/json' })
      if (navigator.sendBeacon(ENDPOINT, blob)) return
    }
  } catch {
    // Fall through to fetch when the beacon API is blocked.
  }

  try {
    if (typeof fetch === 'function') {
      void fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
        keepalive: true,
      }).catch(() => {})
    }
  } catch {
    // Swallow every failure: public behavior must not depend on analytics.
  }
}
