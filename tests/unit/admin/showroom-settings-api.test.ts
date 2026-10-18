// @vitest-environment node
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { createFakeMediaProvider, type FakeMediaProvider } from '@/lib/media/fake'

import { createPngFixture } from '../../helpers/image-fixtures'
import { prima, tenantB } from '../tenant/fixtures'

const mocks = vi.hoisted(() => ({
  requireAdminApiContext: vi.fn(),
  resolveMediaProvider: vi.fn(),
}))

vi.mock('@/lib/admin/context', () => ({
  requireAdminApiContext: mocks.requireAdminApiContext,
}))

vi.mock('@/lib/media/provider', () => ({
  resolveMediaProvider: mocks.resolveMediaProvider,
}))

let POST: (request: Request) => Promise<Response>

beforeAll(async () => {
  ;({ POST } = await import('@/app/api/admin/settings/media/route'))
})

const directories: string[] = []
const image = createPngFixture({ width: 1200, height: 630 })

async function provider(): Promise<FakeMediaProvider> {
  const baseDir = await mkdtemp(join(tmpdir(), 'otoweb-showroom-api-'))
  directories.push(baseDir)
  return createFakeMediaProvider({ baseDir, urlPrefix: '/uploads' })
}

function authResult(tenantId = prima.tenantId) {
  return {
    ok: true as const,
    user: { id: prima.profileId, email: 'owner@primaauto.test', displayName: 'Owner' },
    context: {
      userId: prima.profileId,
      tenant: {
        id: tenantId,
        name: 'Showroom',
        slug: 'showroom',
        status: 'active' as const,
        plan: 'starter',
      },
      role: 'owner' as const,
      membershipId: '60000000-0000-4000-8000-000000000001',
      isPlatformAdmin: false,
    },
    db: {},
  }
}

function uploadRequest(kind = 'logo', file: File | null = new File([image], 'logo.png', { type: 'image/png' })) {
  const form = new FormData()
  form.append('kind', kind)
  if (file) form.append('file', file)

  return new Request('http://prima.otoweb.id/api/admin/settings/media', {
    method: 'POST',
    body: form,
  })
}

afterAll(async () => {
  await Promise.all(directories.map((directory) => rm(directory, { recursive: true, force: true })))
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/admin/settings/media', () => {
  it('returns 401 without a verified session and makes no provider call', async () => {
    mocks.requireAdminApiContext.mockResolvedValue({
      ok: false,
      status: 401,
      message: 'Sesi tidak valid.',
    })

    const response = await POST!(uploadRequest())

    expect(response.status).toBe(401)
    expect(mocks.resolveMediaProvider).not.toHaveBeenCalled()
  })

  it('returns 403 for a denied capability and makes no provider call', async () => {
    mocks.requireAdminApiContext.mockResolvedValue({
      ok: false,
      status: 403,
      message: 'Anda tidak memiliki izin.',
    })

    const response = await POST!(uploadRequest())

    expect(response.status).toBe(403)
    expect(mocks.requireAdminApiContext).toHaveBeenCalledWith('manage_settings')
    expect(mocks.resolveMediaProvider).not.toHaveBeenCalled()
  })

  it('rejects an invalid kind before resolving the provider', async () => {
    mocks.requireAdminApiContext.mockResolvedValue(authResult())

    const response = await POST!(uploadRequest('favicon'))

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ ok: false, error: 'invalid' })
    expect(mocks.resolveMediaProvider).not.toHaveBeenCalled()
  })

  it('rejects a missing file before resolving the provider', async () => {
    mocks.requireAdminApiContext.mockResolvedValue(authResult())

    const response = await POST!(uploadRequest('logo', null))

    expect(response.status).toBe(400)
    expect(mocks.resolveMediaProvider).not.toHaveBeenCalled()
  })

  it('uploads with the authorized tenant id and returns the stored URL', async () => {
    const media = await provider()
    mocks.requireAdminApiContext.mockResolvedValue(authResult())
    mocks.resolveMediaProvider.mockReturnValue(media)

    const response = await POST!(uploadRequest('hero'))

    expect(response.status).toBe(201)
    const body = (await response.json()) as {
      ok: boolean
      data: { url: string; assetId: string; width: number; height: number }
    }
    expect(body.ok).toBe(true)
    expect(body.data.url).toMatch(/^\/uploads\//)
    expect(body.data.assetId).toContain(`/${prima.tenantId}/settings/hero/`)
    expect(body.data.width).toBe(1200)
    expect(media.uploads).toHaveLength(1)
  })

  it('derives the asset namespace from the authorized tenant, not the request body', async () => {
    const media = await provider()
    mocks.requireAdminApiContext.mockResolvedValue(authResult(tenantB.tenantId))
    mocks.resolveMediaProvider.mockReturnValue(media)

    const response = await POST!(uploadRequest('logo'))
    const body = (await response.json()) as { ok: boolean; data: { assetId: string } }

    expect(body.ok).toBe(true)
    expect(body.data.assetId).toContain(`/${tenantB.tenantId}/settings/logo/`)
    expect(body.data.assetId).not.toContain(`/${prima.tenantId}/`)
  })
})
