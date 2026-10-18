// @vitest-environment node
import { NextRequest } from 'next/server'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { prima } from '../tenant/fixtures'

const mocks = vi.hoisted(() => ({
  resolvePublicTenant: vi.fn(),
  getAppDatabase: vi.fn(),
  createWhatsappLead: vi.fn(),
  getShowroomSettings: vi.fn(),
  recordAnalyticsEvent: vi.fn(),
}))

vi.mock('@/lib/public/tenant', () => ({
  resolvePublicTenant: mocks.resolvePublicTenant,
}))

vi.mock('@/lib/db/runtime', () => ({
  getAppDatabase: mocks.getAppDatabase,
}))

vi.mock('@/lib/public/lead-service', () => ({
  createWhatsappLead: mocks.createWhatsappLead,
}))

vi.mock('@/lib/tenant/scoped-queries', () => ({
  getShowroomSettings: mocks.getShowroomSettings,
}))

vi.mock('@/lib/analytics/record', () => ({
  recordAnalyticsEvent: mocks.recordAnalyticsEvent,
}))

let GET: (request: NextRequest) => Promise<Response>

beforeAll(async () => {
  ;({ GET } = await import('@/app/api/public/whatsapp/route'))
})

function request(query = '') {
  return new NextRequest(`http://prima.otoweb.id/api/public/whatsapp${query}`)
}

const tenant = {
  id: prima.tenantId,
  name: 'Prima Auto Gallery',
  slug: 'prima-auto-gallery',
  status: 'active',
  plan: 'starter',
}

const lead = {
  id: '66666666-6666-4666-8666-666666666601',
  name: '',
  phone: '',
  email: '',
  source: 'whatsapp' as const,
  message: 'Halo Prima Auto Gallery, saya tertarik dengan Toyota Fortuner.',
  status: 'new' as const,
  createdAt: '2026-10-19T00:00:00.000Z',
  updatedAt: '2026-10-19T00:00:00.000Z',
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.resolvePublicTenant.mockResolvedValue(tenant)
  mocks.getAppDatabase.mockResolvedValue({})
  mocks.getShowroomSettings.mockResolvedValue({
    displayName: 'Prima Auto Gallery',
    whatsapp: '6281299001122',
  })
  mocks.createWhatsappLead.mockResolvedValue({ ok: true, data: lead })
  mocks.recordAnalyticsEvent.mockResolvedValue(true)
})

describe('GET /api/public/whatsapp', () => {
  it('returns 404 and writes nothing when no tenant resolves', async () => {
    mocks.resolvePublicTenant.mockResolvedValue(null)

    const response = await GET(request())

    expect(response.status).toBe(404)
    expect(mocks.createWhatsappLead).not.toHaveBeenCalled()
  })

  it('records the tenant lead before redirecting to the configured number', async () => {
    const response = await GET(request('?vehicle=toyota-fortuner-2021-1'))

    expect(mocks.createWhatsappLead).toHaveBeenCalledWith(
      {},
      prima.tenantId,
      {
        vehicleSlug: 'toyota-fortuner-2021-1',
        showroomName: 'Prima Auto Gallery',
      },
    )
    expect(mocks.recordAnalyticsEvent).toHaveBeenCalledWith({}, prima.tenantId, {
      eventType: 'whatsapp_click',
      vehicleId: undefined,
      vehicleSlug: 'toyota-fortuner-2021-1',
    })
    expect(response.status).toBe(307)

    const location = new URL(response.headers.get('location') ?? '')
    expect(location.origin).toBe('https://wa.me')
    expect(location.pathname).toBe('/6281299001122')
    expect(location.searchParams.get('text')).toBe(lead.message)
  })

  it('does not invent a number when the showroom has none', async () => {
    mocks.getShowroomSettings.mockResolvedValue({
      displayName: 'Prima Auto Gallery',
      whatsapp: '',
    })

    const response = await GET(request())

    expect(mocks.createWhatsappLead).toHaveBeenCalled()
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://prima.otoweb.id/#contact')
  })

  it('does not redirect externally when tracking fails', async () => {
    mocks.createWhatsappLead.mockResolvedValue({ ok: false, error: 'unavailable' })

    const response = await GET(request())

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(
      'http://prima.otoweb.id/?inquiry=failed#contact',
    )
    expect(mocks.recordAnalyticsEvent).not.toHaveBeenCalled()
  })

  it('still redirects when the analytics write rejects', async () => {
    mocks.recordAnalyticsEvent.mockRejectedValue(new Error('analytics unavailable'))

    const response = await GET(request('?vehicle=toyota-fortuner-2021-1'))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain('https://wa.me/')
  })
})
