import { describe, expect, it } from 'vitest'

import {
  ANALYTICS_EVENT_TYPES,
  FILTER_QUERY_KEYS,
  INVENTORY_QUERY_KEYS,
  MAX_ANALYTICS_FILTERS,
  MAX_ANALYTICS_PATH_LENGTH,
  MAX_ANALYTICS_SLUG_LENGTH,
  filtersFromSearchParams,
  hasFilterUse,
  hasInventorySearch,
  isAnalyticsEventType,
  isPublicAnalyticsEventType,
  normalizeAnalyticsEvent,
  normalizeAnalyticsFilters,
  normalizeAnalyticsPath,
  normalizeVehicleSlug,
} from '@/lib/analytics/events'

describe('analytics event contract', () => {
  it('recognizes exactly the six roadmap events', () => {
    expect(ANALYTICS_EVENT_TYPES).toEqual([
      'vehicle_view',
      'inventory_search',
      'filter_use',
      'whatsapp_click',
      'contact_submit',
      'vehicle_share',
    ])

    for (const event of ANALYTICS_EVENT_TYPES) {
      expect(isAnalyticsEventType(event)).toBe(true)
    }
    expect(isAnalyticsEventType('page_view')).toBe(false)
    expect(isAnalyticsEventType(undefined)).toBe(false)
  })

  it('separates public beacon events from server-only events', () => {
    expect(isPublicAnalyticsEventType('vehicle_view')).toBe(true)
    expect(isPublicAnalyticsEventType('inventory_search')).toBe(true)
    expect(isPublicAnalyticsEventType('filter_use')).toBe(true)
    expect(isPublicAnalyticsEventType('vehicle_share')).toBe(true)
    expect(isPublicAnalyticsEventType('whatsapp_click')).toBe(false)
    expect(isPublicAnalyticsEventType('contact_submit')).toBe(false)
  })

  it('normalizes a vehicle view and drops unrelated fields', () => {
    const event = normalizeAnalyticsEvent(
      {
        event: 'vehicle_view',
        vehicleSlug: '  toyota-fortuner-2021-1  ',
        path: '/cars/toyota-fortuner-2021-1?utm=1#photos',
        filters: { brand: 'Toyota' },
        method: 'native',
      },
      { publicOnly: true },
    )

    expect(event).toEqual({
      eventType: 'vehicle_view',
      vehicleSlug: 'toyota-fortuner-2021-1',
      path: '/cars/toyota-fortuner-2021-1',
      metadata: {},
    })
  })

  it('keeps only recognized, bounded filters', () => {
    const event = normalizeAnalyticsEvent(
      {
        event: 'filter_use',
        filters: {
          brand: 'Toyota',
          maxPrice: 500000000,
          transmission: 'AT',
          secret: 'should-drop',
          fuel: 'x'.repeat(65),
        },
      },
      { publicOnly: true },
    )

    expect(event?.metadata.filters).toEqual({
      brand: 'Toyota',
      maxPrice: '500000000',
      transmission: 'AT',
    })
  })

  it(`caps filter entries at ${MAX_ANALYTICS_FILTERS}`, () => {
    const filters = Object.fromEntries(
      Array.from({ length: MAX_ANALYTICS_FILTERS + 4 }, (_, index) => [
        `unknown${index}`,
        'value',
      ]),
    )
    filters.brand = 'Toyota'

    expect(normalizeAnalyticsFilters(filters)).toEqual({ brand: 'Toyota' })
  })

  it('rejects malformed payloads quietly', () => {
    expect(normalizeAnalyticsEvent(null)).toBeNull()
    expect(normalizeAnalyticsEvent('vehicle_view')).toBeNull()
    expect(normalizeAnalyticsEvent({ event: 'page_view' })).toBeNull()
    expect(normalizeAnalyticsEvent({ event: 'whatsapp_click' }, { publicOnly: true })).toBeNull()
  })

  it('normalizes paths and slugs within bounds', () => {
    expect(normalizeAnalyticsPath('/cars?brand=Toyota')).toBe('/cars')
    expect(normalizeAnalyticsPath('cars')).toBeUndefined()
    expect(normalizeAnalyticsPath(`/${'a'.repeat(MAX_ANALYTICS_PATH_LENGTH)}`)).toBeUndefined()

    expect(normalizeVehicleSlug('  abc  ')).toBe('abc')
    expect(normalizeVehicleSlug('')).toBeUndefined()
    expect(normalizeVehicleSlug('a'.repeat(MAX_ANALYTICS_SLUG_LENGTH + 1))).toBeUndefined()
  })

  it('records the share method only for share events', () => {
    const share = normalizeAnalyticsEvent({ event: 'vehicle_share', method: 'clipboard' })
    expect(share?.metadata.method).toBe('clipboard')

    const view = normalizeAnalyticsEvent({ event: 'vehicle_view', method: 'native' })
    expect(view?.metadata.method).toBeUndefined()
  })

  it('keeps the WhatsApp slug as metadata for the server event', () => {
    const event = normalizeAnalyticsEvent({
      event: 'whatsapp_click',
      vehicleSlug: 'toyota-fortuner-2021-1',
    })

    expect(event).toEqual({
      eventType: 'whatsapp_click',
      vehicleSlug: 'toyota-fortuner-2021-1',
      path: undefined,
      metadata: { vehicleSlug: 'toyota-fortuner-2021-1' },
    })
  })
})

describe('inventory search classification', () => {
  it('treats every supported query key as an inventory search', () => {
    for (const key of INVENTORY_QUERY_KEYS) {
      expect(hasInventorySearch({ [key]: 'value' })).toBe(true)
    }
    expect(hasInventorySearch({})).toBe(false)
    expect(hasInventorySearch({ utm: 'campaign' })).toBe(false)
  })

  it('treats filters as filter use but not a sort-only change', () => {
    for (const key of FILTER_QUERY_KEYS) {
      expect(hasFilterUse({ [key]: 'value' })).toBe(true)
    }
    expect(hasFilterUse({ sort: 'harga-terendah' })).toBe(false)
    expect(hasInventorySearch({ sort: 'harga-terendah' })).toBe(true)
  })

  it('reads the first value of repeated params and ignores empties', () => {
    expect(
      filtersFromSearchParams({
        brand: ['Toyota', 'Honda'],
        fuel: '  ',
        maxPrice: '500000000',
      }),
    ).toEqual({ brand: 'Toyota', maxPrice: '500000000' })
  })
})
