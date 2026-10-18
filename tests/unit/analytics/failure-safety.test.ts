// @vitest-environment node
import { NextRequest } from 'next/server'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { recordAnalyticsEvent } from '@/lib/analytics/record'
import type { AnalyticsEventType } from '@/lib/analytics/events'
import { prima } from '../tenant/fixtures'

const mocks = vi.hoisted(() => ({
  resolvePublicTenant: vi.fn(),
  getAppDatabase: vi.fn(),
}))

vi.mock('@/lib/public/tenant', () => ({
  resolvePublicTenant: mocks.resolvePublicTenant,
}))

vi.mock('@/lib/db/runtime', () => ({
  getAppDatabase: mocks.getAppDatabase,
}))

let POST: (request: NextRequest) => Promise<Response>

beforeAll(async () => {
  ;({ POST } = await import('@/app/api/public/analytics/route'))
})

function request() {
  return new NextRequest('http://prima.otoweb.id/api/public/analytics', {
    method: 'POST',
    body: JSON.stringify({ event: 'vehicle_view', vehicleSlug: 'x' }),
    headers: { 'content-type': 'application/json' },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('analytics failure safety', () => {
  it('recorder swallows a rejected insert', async () => {
    const failingDatabase = {
      insert: () => ({
        values: () => Promise.reject(new Error('insert unavailable')),
      }),
    } as unknown as Parameters<typeof recordAnalyticsEvent>[0]

    await expect(
      recordAnalyticsEvent(failingDatabase, prima.tenantId, {
        eventType: 'vehicle_view' as AnalyticsEventType,
      }),
    ).resolves.toBe(false)
  })

  it('recorder swallows a failing vehicle lookup', async () => {
    const failingDatabase = {
      select: () => {
        throw new Error('select unavailable')
      },
    } as unknown as Parameters<typeof recordAnalyticsEvent>[0]

    await expect(
      recordAnalyticsEvent(failingDatabase, prima.tenantId, {
        eventType: 'vehicle_view',
        vehicleSlug: 'toyota-fortuner-2021-1',
      }),
    ).resolves.toBe(false)
  })

  it('beacon returns 204 when tenant resolution throws', async () => {
    mocks.resolvePublicTenant.mockRejectedValue(new Error('host resolution failed'))

    await expect(POST(request())).resolves.toMatchObject({ status: 204 })
  })

  it('beacon returns 204 when the database is unavailable', async () => {
    mocks.resolvePublicTenant.mockResolvedValue({
      id: prima.tenantId,
      name: 'Prima Auto Gallery',
      slug: 'prima-auto-gallery',
      status: 'active',
      plan: 'starter',
    })
    mocks.getAppDatabase.mockRejectedValue(new Error('database unavailable'))

    await expect(POST(request())).resolves.toMatchObject({ status: 204 })
  })
})
