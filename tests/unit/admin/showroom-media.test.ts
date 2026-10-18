// @vitest-environment node
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterAll, describe, expect, it } from 'vitest'

import {
  isShowroomMediaKind,
  uploadShowroomMedia,
  type ShowroomMediaKind,
} from '@/lib/admin/showroom-media-service'
import type { SettingsActor } from '@/lib/admin/showroom-settings-service'
import { createFakeMediaProvider, type FakeMediaProvider } from '@/lib/media/fake'

import { createPngFixture } from '../../helpers/image-fixtures'
import { prima, tenantB } from '../tenant/fixtures'

const directories: string[] = []

const image = createPngFixture({ width: 1200, height: 630, color: [20, 120, 90] })

function actor(tenantId = prima.tenantId, userId = prima.profileId): SettingsActor {
  return { tenantId, userId, isPlatformAdmin: false }
}

async function provider(): Promise<FakeMediaProvider> {
  const baseDir = await mkdtemp(join(tmpdir(), 'otoweb-showroom-media-'))
  directories.push(baseDir)
  return createFakeMediaProvider({ baseDir, urlPrefix: '/uploads' })
}

afterAll(async () => {
  await Promise.all(directories.map((directory) => rm(directory, { recursive: true, force: true })))
})

describe('showroom media kinds', () => {
  it('accepts only logo and hero', () => {
    expect(isShowroomMediaKind('logo')).toBe(true)
    expect(isShowroomMediaKind('hero')).toBe(true)
    expect(isShowroomMediaKind('favicon')).toBe(false)
    expect(isShowroomMediaKind(undefined)).toBe(false)
  })
})

describe('uploadShowroomMedia', () => {
  it('uploads a logo to a tenant-scoped deterministic public id', async () => {
    const media = await provider()
    const result = await uploadShowroomMedia(
      actor(),
      'logo',
      { bytes: image, filename: 'logo.png' },
      media,
      { retry: { attempts: 1, baseDelayMs: 0, sleep: async () => {} } },
    )

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.url).toMatch(/^\/uploads\/otoweb\/showrooms\//)
    expect(result.data.assetId).toBe(
      `otoweb/showrooms/${prima.tenantId}/settings/logo/${result.data.assetId.split('/').at(-1)}`,
    )
    expect(result.data.provider).toBe('fake')
    expect(result.data.width).toBe(1200)
    expect(result.data.height).toBe(630)
    expect(media.uploads).toHaveLength(1)
    expect(media.uploads[0]?.publicId).toBe(result.data.assetId)
  })

  it('uses a different asset path for hero and for another tenant', async () => {
    const media = await provider()
    const retry = { attempts: 1, baseDelayMs: 0, sleep: async () => {} }

    const hero = await uploadShowroomMedia(
      actor(),
      'hero',
      { bytes: image, filename: 'hero.png' },
      media,
      { retry },
    )
    const otherTenant = await uploadShowroomMedia(
      actor(tenantB.tenantId, tenantB.profileId),
      'logo',
      { bytes: image, filename: 'logo.png' },
      media,
      { retry },
    )

    expect(hero.ok).toBe(true)
    expect(otherTenant.ok).toBe(true)
    if (!hero.ok || !otherTenant.ok) return

    expect(hero.data.assetId).toContain(`/${prima.tenantId}/settings/hero/`)
    expect(otherTenant.data.assetId).toContain(`/${tenantB.tenantId}/settings/logo/`)
    expect(hero.data.assetId).not.toBe(otherTenant.data.assetId)
    expect(media.uploads).toHaveLength(2)
  })

  it('is deterministic: the same tenant, kind, and bytes resolve to the same id', async () => {
    const media = await provider()
    const retry = { attempts: 1, baseDelayMs: 0, sleep: async () => {} }

    const first = await uploadShowroomMedia(
      actor(),
      'logo',
      { bytes: image, filename: 'a.png' },
      media,
      { retry },
    )
    const second = await uploadShowroomMedia(
      actor(),
      'logo',
      { bytes: image, filename: 'b.png' },
      media,
      { retry },
    )

    expect(first.ok && second.ok).toBe(true)
    if (!first.ok || !second.ok) return
    expect(first.data.assetId).toBe(second.data.assetId)
  })

  it('rejects non-image content before calling the provider', async () => {
    const media = await provider()
    const result = await uploadShowroomMedia(
      actor(),
      'logo',
      { bytes: new TextEncoder().encode('not an image'), filename: 'fake.png' },
      media,
    )

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toBe('invalid')
    expect(result.fieldErrors?.file).toHaveLength(1)
    expect(media.uploads).toHaveLength(0)
  })

  it('rejects an image below the minimum dimensions', async () => {
    const media = await provider()
    const tiny = createPngFixture({ width: 100, height: 100 })
    const result = await uploadShowroomMedia(
      actor(),
      'hero',
      { bytes: tiny, filename: 'tiny.png' },
      media,
    )

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.message).toContain('640')
    expect(media.uploads).toHaveLength(0)
  })

  it('rejects a missing or malformed tenant before any provider call', async () => {
    const media = await provider()

    await expect(
      uploadShowroomMedia(
        actor('', prima.profileId),
        'logo',
        { bytes: image, filename: 'logo.png' },
        media,
      ),
    ).rejects.toThrow('missing_tenant_id')

    await expect(
      uploadShowroomMedia(
        actor('not-a-uuid', prima.profileId),
        'logo',
        { bytes: image, filename: 'logo.png' },
        media,
      ),
    ).rejects.toThrow('invalid_tenant_id')

    expect(media.uploads).toHaveLength(0)
  })

  it('rejects an unknown kind without touching the provider', async () => {
    const media = await provider()
    const result = await uploadShowroomMedia(
      actor(),
      'favicon' as ShowroomMediaKind,
      { bytes: image, filename: 'favicon.png' },
      media,
    )

    expect(result.ok).toBe(false)
    expect(media.uploads).toHaveLength(0)
  })
})
