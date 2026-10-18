// @vitest-environment node
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  resolveRequestTenantContext: vi.fn(),
  getAppDatabase: vi.fn(async () => ({ database: true })),
}))

vi.mock('@/lib/auth/server', () => ({ getCurrentUser: mocks.getCurrentUser }))
vi.mock('@/lib/tenant/server', () => ({
  assertServerOnly: () => {},
  resolveRequestTenantContext: mocks.resolveRequestTenantContext,
}))
vi.mock('@/lib/db/runtime', () => ({ getAppDatabase: mocks.getAppDatabase }))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))
vi.mock('next/server', () => ({ connection: vi.fn() }))

let requireAdminApiContext: typeof import('@/lib/admin/context')['requireAdminApiContext']

beforeAll(async () => {
  ;({ requireAdminApiContext } = await import('@/lib/admin/context'))
})

const userId = '50000000-0000-4000-8000-000000000001'
const tenantId = '11111111-1111-4111-8111-111111111111'

const tenant = {
  id: tenantId,
  name: 'Prima Auto Gallery',
  slug: 'prima-auto-gallery',
  status: 'active' as const,
  plan: 'starter',
}

function context(role: 'owner' | 'staff' = 'owner') {
  return {
    userId,
    tenant,
    role,
    membershipId: '60000000-0000-4000-8000-000000000001',
    isPlatformAdmin: false,
  }
}

describe('requireAdminApiContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when there is no verified user', async () => {
    mocks.getCurrentUser.mockResolvedValue(null)

    await expect(requireAdminApiContext!()).resolves.toMatchObject({
      ok: false,
      status: 401,
    })
    expect(mocks.resolveRequestTenantContext).not.toHaveBeenCalled()
  })

  it('returns 403 when the tenant context is denied', async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: userId })
    mocks.resolveRequestTenantContext.mockResolvedValue({ ok: false, error: 'no_membership' })

    await expect(requireAdminApiContext!()).resolves.toMatchObject({
      ok: false,
      status: 403,
    })
    expect(mocks.getAppDatabase).not.toHaveBeenCalled()
  })

  it('returns 403 when the role lacks the requested capability', async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: userId })
    mocks.resolveRequestTenantContext.mockResolvedValue({ ok: true, context: context('staff') })

    await expect(requireAdminApiContext!('manage_settings')).resolves.toMatchObject({
      ok: false,
      status: 403,
    })
  })

  it('returns the context and database for an authorized staff request', async () => {
    mocks.getCurrentUser.mockResolvedValue({ id: userId })
    mocks.resolveRequestTenantContext.mockResolvedValue({ ok: true, context: context('staff') })

    const result = await requireAdminApiContext!('manage_vehicles')
    expect(result).toEqual({
      ok: true,
      user: { id: userId },
      context: context('staff'),
      db: { database: true },
    })
  })
})
