// @vitest-environment node
import { NextRequest } from 'next/server'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { prima } from '../tenant/fixtures'

const mocks = vi.hoisted(() => ({
  resolvePublicTenant: vi.fn(),
  getAppDatabase: vi.fn(),
  recordAnalyticsEvent: vi.fn(),
}))

vi.mock('@/lib/public/tenant', () => ({
  resolvePublicTenant: mocks.resolvePublicTenant,
}))

vi.mock('@/lib/db/runtime', () => ({
  getAppDatabase: mocks.getAppDatabase,
}))

vi.mock('@/lib/analytics/record', () => ({
  recordAnalyticsEvent: mocks.recordAnalyticsEvent,
}))

let POST: (request: NextRequest) => Promise<Response>
let GET: () => Response

beforeAll(async () => {
  ;({ POST, GET } = await import('@/app/api/public/analytics/route'))
})

const tenant = {
  id: prima.tenantId,
  name: 'Prima Auto Gallery',
  slug: 'prima-auto-gallery',
  status: 'active',
  plan: 'starter',
}

function request(body: string, method = 'POST') {
  return new NextRequest('http://prima.otoweb.id/api/public/analytics', {
    method,
    body: method === 'GET' ? undefined : body,
    headers: { 'content-type': 'application/json' },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.resolvePublicTenant.mockResolvedValue(tenant)
  mocks.getAppDatabase.mockResolvedValue({})
  mocks.recordAnalyticsEvent.mockResolvedValue(true)
})

describe('POST /api/public/analytics', () => {
  it('records a valid public event for the resolved tenant', async () => {
    const response = await POST(
      request(
        JSON.stringify({
          event: 'vehicle_view',
          vehicleSlug: 'toyota-fortuner-2021-1',
          path: '/cars/toyota-fortuner-2021-1?utm=1',
        }),
      ),
    )

    expect(response.status).toBe(204)
    expect(mocks.recordAnalyticsEvent).toHaveBeenCalledWith({}, prima.tenantId, {
      eventType: 'vehicle_view',
      vehicleSlug: 'toyota-fortuner-2021-1',
      path: '/cars/toyota-fortuner-2021-1',
      metadata: {},
    })
  })

  it('records a filtered search as search and filter use', async () => {
    const search = await POST(
      request(
        JSON.stringify({
          event: 'inventory_search',
          path: '/cars',
          filters: { brand: 'Toyota', sort: 'terbaru', secret: 'drop' },
        }),
      ),
    )
    const filter = await POST(
      request(
        JSON.stringify({
          event: 'filter_use',
          path: '/cars',
          filters: { brand: 'Toyota' },
        }),
      ),
    )

    expect(search.status).toBe(204)
    expect(filter.status).toBe(204)
    expect(mocks.recordAnalyticsEvent).toHaveBeenNthCalledWith(1, {}, prima.tenantId, {
      eventType: 'inventory_search',
      vehicleSlug: undefined,
      path: '/cars',
      metadata: { filters: { brand: 'Toyota', sort: 'terbaru' } },
    })
    expect(mocks.recordAnalyticsEvent).toHaveBeenNthCalledWith(2, {}, prima.tenantId, {
      eventType: 'filter_use',
      vehicleSlug: undefined,
      path: '/cars',
      metadata: { filters: { brand: 'Toyota' } },
    })
  })

  it('drops an event when no tenant resolves', async () => {
    mocks.resolvePublicTenant.mockResolvedValue(null)

    const response = await POST(
      request(JSON.stringify({ event: 'vehicle_view', vehicleSlug: 'x' })),
    )

    expect(response.status).toBe(204)
    expect(mocks.recordAnalyticsEvent).not.toHaveBeenCalled()
  })

  it('drops server-only events and invalid payloads quietly', async () => {
    for (const body of [
      'not-json',
      JSON.stringify({ event: 'whatsapp_click' }),
      JSON.stringify({ event: 'contact_submit' }),
      JSON.stringify({ event: 'page_view' }),
      JSON.stringify(null),
    ]) {
      const response = await POST(request(body))
      expect(response.status).toBe(204)
    }

    expect(mocks.recordAnalyticsEvent).not.toHaveBeenCalled()
  })

  it('drops an oversized payload', async () => {
    const response = await POST(
      request(JSON.stringify({ event: 'vehicle_view', vehicleSlug: 'x'.repeat(5_000) })),
    )

    expect(response.status).toBe(204)
    expect(mocks.recordAnalyticsEvent).not.toHaveBeenCalled()
  })

  it('stays quiet when analytics recording fails or rejects', async () => {
    mocks.recordAnalyticsEvent.mockResolvedValueOnce(false)
    mocks.recordAnalyticsEvent.mockRejectedValueOnce(new Error('store down'))

    await expect(
      POST(request(JSON.stringify({ event: 'vehicle_view', vehicleSlug: 'x' }))),
    ).resolves.toMatchObject({ status: 204 })
    await expect(
      POST(request(JSON.stringify({ event: 'vehicle_view', vehicleSlug: 'x' }))),
    ).resolves.toMatchObject({ status: 204 })
  })

  it('rejects non-POST methods', () => {
    expect(GET().status).toBe(405)
  })
})
