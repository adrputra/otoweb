'use client'

import { useEffect, useRef } from 'react'

import { trackAnalytics } from '@/lib/analytics/client'
import {
  filtersFromSearchParams,
  hasFilterUse,
  hasInventorySearch,
  type AnalyticsSearchParams,
} from '@/lib/analytics/events'

/**
 * Records one vehicle view per detail-page mount and per vehicle change.
 *
 * A ref keeps React Strict Mode's double effect from sending twice; a changed
 * slug on a soft navigation is treated as a new view.
 */
export function VehicleViewTracker({ vehicleSlug }: { vehicleSlug: string }) {
  const lastSlug = useRef<string | null>(null)

  useEffect(() => {
    if (lastSlug.current === vehicleSlug) return
    lastSlug.current = vehicleSlug

    trackAnalytics({
      event: 'vehicle_view',
      vehicleSlug,
      path: `/cars/${vehicleSlug}`,
    })
  }, [vehicleSlug])

  return null
}

/**
 * Records inventory searches and filter use once per distinct query state.
 * Loading the inventory without any recognized query parameter records nothing.
 */
export function InventoryTracker({
  searchParams = {},
}: {
  searchParams?: AnalyticsSearchParams
}) {
  const filters = filtersFromSearchParams(searchParams)
  const signature = JSON.stringify(filters)
  const lastSignature = useRef<string | null>(null)

  useEffect(() => {
    if (lastSignature.current === signature) return
    lastSignature.current = signature

    if (hasInventorySearch(searchParams)) {
      trackAnalytics({
        event: 'inventory_search',
        path: '/cars',
        filters: Object.keys(filters).length > 0 ? filters : undefined,
      })
    }

    if (hasFilterUse(searchParams)) {
      trackAnalytics({
        event: 'filter_use',
        path: '/cars',
        filters: Object.keys(filters).length > 0 ? filters : undefined,
      })
    }
  }, [filters, searchParams, signature])

  return null
}
