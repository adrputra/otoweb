// @vitest-environment node
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { createFakeMediaProvider } from '@/lib/media/fake'
import { resolveMediaFolder, resolveMediaProvider, resolveMediaProviderOrNull } from '@/lib/media/provider'

import { createPngFixture } from '../../helpers/image-fixtures'

const directories: string[] = []

async function tempDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'otoweb-media-'))
  directories.push(directory)
  return directory
}

const input = () => ({
  bytes: createPngFixture({ width: 800, height: 600 }),
  filename: 'foto.png',
  contentType: 'image/png' as const,
  publicId: 'otoweb/vehicles/tenant/vehicle/hash',
  width: 800,
  height: 600,
})

afterEach(async () => {
  for (const directory of directories.splice(0)) {
    await rm(directory, { recursive: true, force: true })
  }
})

describe('resolveMediaProvider', () => {
  it('selects the fake provider outside production when Cloudinary is unset', () => {
    expect(resolveMediaProvider({ NODE_ENV: 'test' }).key).toBe('fake')
  })

  it('selects the fake provider when explicitly requested in development', async () => {
    const baseDir = await tempDirectory()
    const provider = resolveMediaProvider({
      NODE_ENV: 'development',
      MEDIA_PROVIDER: 'fake',
      MEDIA_LOCAL_DIR: baseDir,
      MEDIA_PUBLIC_PREFIX: '/media',
    })

    expect(provider.key).toBe('fake')
    const result = await provider.upload(input())
    expect(result.url).toBe('/media/otoweb/vehicles/tenant/vehicle/hash.png')
    await expect(stat(join(baseDir, 'otoweb/vehicles/tenant/vehicle/hash.png'))).resolves.toBeTruthy()
  })

  it('selects Cloudflare R2 when all credentials are complete', () => {
    const provider = resolveMediaProvider({
      NODE_ENV: 'production',
      MEDIA_PROVIDER: 'r2',
      R2_ACCOUNT_ID: 'account',
      R2_ACCESS_KEY_ID: 'access-key',
      R2_SECRET_ACCESS_KEY: 'secret-key',
      R2_BUCKET: 'otoweb-media',
      R2_PUBLIC_BASE_URL: 'https://media.example.com',
    })
    expect(provider.key).toBe('r2')
    expect(resolveMediaProviderOrNull({
      NODE_ENV: 'production',
      R2_ACCOUNT_ID: 'account',
      R2_ACCESS_KEY_ID: 'access-key',
      R2_SECRET_ACCESS_KEY: 'secret-key',
      R2_BUCKET: 'otoweb-media',
      R2_PUBLIC_BASE_URL: 'https://media.example.com',
    })?.key).toBe('r2')
  })

  it('selects Cloudinary when all credentials are complete', () => {
    const provider = resolveMediaProvider({
      NODE_ENV: 'production',
      CLOUDINARY_CLOUD_NAME: 'demo',
      CLOUDINARY_API_KEY: 'key',
      CLOUDINARY_API_SECRET: 'secret',
    })
    expect(provider.key).toBe('cloudinary')
    expect(resolveMediaFolder({ CLOUDINARY_UPLOAD_FOLDER: 'custom/folder' })).toBe('custom/folder')
    expect(resolveMediaFolder({ MEDIA_UPLOAD_FOLDER: 'custom/media' })).toBe('custom/media')
    expect(resolveMediaFolder({})).toBe('otoweb/vehicles')
  })

  it('fails loudly in production without media configuration', () => {
    expect(() => resolveMediaProvider({ NODE_ENV: 'production' })).toThrow(/not configured/i)
    expect(resolveMediaProviderOrNull({ NODE_ENV: 'production' })).toBeNull()
  })

  it('rejects the fake provider in production and invalid provider names', () => {
    expect(() =>
      resolveMediaProvider({ NODE_ENV: 'production', MEDIA_PROVIDER: 'fake' }),
    ).toThrow(/not allowed in production/i)
    expect(() => resolveMediaProvider({ NODE_ENV: 'test', MEDIA_PROVIDER: 's3' })).toThrow(
      /MEDIA_PROVIDER must be/i,
    )
  })

  it('rejects partial Cloudinary configuration', () => {
    expect(() => resolveMediaProvider({ NODE_ENV: 'test', CLOUDINARY_CLOUD_NAME: 'demo' })).toThrow(
      /partially configured/i,
    )
  })
})

describe('createFakeMediaProvider', () => {
  it('writes deterministic files and destroys them', async () => {
    const baseDir = await tempDirectory()
    const provider = createFakeMediaProvider({ baseDir })
    const payload = input()

    const result = await provider.upload(payload)
    expect(result).toMatchObject({
      provider: 'fake',
      assetId: payload.publicId,
      width: 800,
      height: 600,
    })

    const stored = await readFile(join(baseDir, `${payload.publicId}.png`))
    expect(new Uint8Array(stored)).toEqual(payload.bytes)

    await provider.destroy(payload.publicId)
    await expect(stat(join(baseDir, `${payload.publicId}.png`))).rejects.toThrow()
    expect(provider.destroys).toEqual([payload.publicId])
  })

  it('injects a bounded number of transient failures', async () => {
    const baseDir = await tempDirectory()
    const provider = createFakeMediaProvider({ baseDir, failUploads: 1 })

    await expect(provider.upload(input())).rejects.toMatchObject({ code: 'transient' })
    await expect(provider.upload(input())).resolves.toMatchObject({ provider: 'fake' })
  })

  it('rejects path traversal in a provider asset id', async () => {
    const baseDir = await tempDirectory()
    const provider = createFakeMediaProvider({ baseDir })
    const escaped = { ...input(), publicId: '../../escape' }

    await expect(provider.upload(escaped)).rejects.toMatchObject({ code: 'permanent' })
  })
})
