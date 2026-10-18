// @vitest-environment node
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { prima } from '../tenant/fixtures'

const mocks = vi.hoisted(() => ({
  getPublicTenant: vi.fn(),
  getAppDatabase: vi.fn(),
  createContactLead: vi.fn(),
  recordAnalyticsEvent: vi.fn(),
}))

vi.mock('@/lib/public/tenant', () => ({
  getPublicTenant: mocks.getPublicTenant,
}))

vi.mock('@/lib/db/runtime', () => ({
  getAppDatabase: mocks.getAppDatabase,
}))

vi.mock('@/lib/public/lead-service', () => ({
  createContactLead: mocks.createContactLead,
}))

vi.mock('@/lib/analytics/record', () => ({
  recordAnalyticsEvent: mocks.recordAnalyticsEvent,
}))

let submitContactLeadAction: (input: unknown) => Promise<{
  ok: boolean
  error?: string
}>

beforeAll(async () => {
  ;({ submitContactLeadAction } = await import('@/lib/public/lead-actions'))
})

const tenant = {
  id: prima.tenantId,
  name: 'Prima Auto Gallery',
  slug: 'prima-auto-gallery',
  status: 'active',
  plan: 'starter',
}

const lead = {
  id: '66666666-6666-4666-8666-666666666601',
  name: 'Rizky',
  phone: '081299001122',
  email: '',
  source: 'contact_form' as const,
  message: 'Halo',
  status: 'new' as const,
  createdAt: '2026-10-19T00:00:00.000Z',
  updatedAt: '2026-10-19T00:00:00.000Z',
}

const input = {
  name: 'Rizky',
  phone: '081299001122',
  email: '',
  message: 'Halo',
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getPublicTenant.mockResolvedValue(tenant)
  mocks.getAppDatabase.mockResolvedValue({})
  mocks.createContactLead.mockResolvedValue({ ok: true, data: lead })
  mocks.recordAnalyticsEvent.mockResolvedValue(true)
})

describe('contact_submit analytics', () => {
  it('records the event after a successful lead write', async () => {
    const result = await submitContactLeadAction(input)

    expect(mocks.createContactLead).toHaveBeenCalledWith({}, prima.tenantId, input)
    expect(mocks.recordAnalyticsEvent).toHaveBeenCalledWith({}, prima.tenantId, {
      eventType: 'contact_submit',
    })
    expect(result).toMatchObject({ ok: true, data: lead })
  })

  it('does not record an event when the lead write fails', async () => {
    mocks.createContactLead.mockResolvedValue({
      ok: false,
      error: 'invalid',
      fieldErrors: { name: ['Nama wajib diisi.'] },
    })

    const result = await submitContactLeadAction(input)

    expect(result).toMatchObject({ ok: false, error: 'invalid' })
    expect(mocks.recordAnalyticsEvent).not.toHaveBeenCalled()
  })

  it('returns the successful lead when analytics rejects', async () => {
    mocks.recordAnalyticsEvent.mockRejectedValue(new Error('analytics unavailable'))

    await expect(submitContactLeadAction(input)).resolves.toMatchObject({ ok: true })
  })

  it('does not record when the showroom tenant cannot be resolved', async () => {
    mocks.getPublicTenant.mockResolvedValue(null)

    const result = await submitContactLeadAction(input)

    expect(result).toMatchObject({ ok: false, error: 'unavailable' })
    expect(mocks.createContactLead).not.toHaveBeenCalled()
    expect(mocks.recordAnalyticsEvent).not.toHaveBeenCalled()
  })
})
