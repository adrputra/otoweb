import { afterEach, describe, expect, it, vi } from 'vitest'

import { trackAnalytics } from '@/lib/analytics/client'

function setBeacon(value: unknown) {
  Object.defineProperty(navigator, 'sendBeacon', {
    value,
    configurable: true,
    writable: true,
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
  setBeacon(undefined)
})

describe('trackAnalytics', () => {
  it('uses sendBeacon when the browser accepts the payload', async () => {
    const beacon = vi.fn().mockReturnValue(true)
    const fetchMock = vi.fn()
    setBeacon(beacon)
    vi.stubGlobal('fetch', fetchMock)

    trackAnalytics({
      event: 'vehicle_view',
      vehicleSlug: 'toyota-fortuner-2021-1',
      path: '/cars/toyota-fortuner-2021-1',
    })

    expect(beacon).toHaveBeenCalledTimes(1)
    expect(fetchMock).not.toHaveBeenCalled()

    const [url, blob] = beacon.mock.calls[0] as [string, Blob]
    expect(url).toBe('/api/public/analytics')
    expect(blob).toBeInstanceOf(Blob)
    await expect(blob.text()).resolves.toBe(
      JSON.stringify({
        event: 'vehicle_view',
        vehicleSlug: 'toyota-fortuner-2021-1',
        path: '/cars/toyota-fortuner-2021-1',
      }),
    )
  })

  it('falls back to keepalive fetch when sendBeacon refuses', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    setBeacon(vi.fn().mockReturnValue(false))
    vi.stubGlobal('fetch', fetchMock)

    trackAnalytics({ event: 'filter_use', filters: { brand: 'Toyota' } })

    expect(fetchMock).toHaveBeenCalledWith('/api/public/analytics', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ event: 'filter_use', filters: { brand: 'Toyota' } }),
      keepalive: true,
    })
  })

  it('falls back when sendBeacon throws', () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    setBeacon(
      vi.fn(() => {
        throw new Error('beacon blocked')
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    expect(() => trackAnalytics({ event: 'vehicle_share' })).not.toThrow()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('swallows fetch failures', () => {
    setBeacon(undefined)
    const fetchMock = vi.fn().mockRejectedValue(new Error('offline'))
    vi.stubGlobal('fetch', fetchMock)

    expect(() => trackAnalytics({ event: 'vehicle_view' })).not.toThrow()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
