// @vitest-environment node
import { createHash } from 'node:crypto'

import { describe, expect, it, vi } from 'vitest'

import {
  cloudinarySignature,
  cloudinaryUploadUrl,
  createCloudinaryMediaProvider,
  readCloudinaryConfig,
  type CloudinaryConfig,
} from '@/lib/media/cloudinary'
import { MediaProviderError } from '@/lib/media/types'

const config: CloudinaryConfig = {
  cloudName: 'demo',
  apiKey: 'key',
  apiSecret: 'secret',
  folder: 'otoweb/vehicles',
}

const input = {
  bytes: new Uint8Array([1, 2, 3, 4]),
  filename: 'foto.png',
  contentType: 'image/png' as const,
  publicId: 'otoweb/vehicles/tenant/vehicle/hash',
  width: 3000,
  height: 2000,
}

function expectedSignature(params: Record<string, string | number>): string {
  const payload = Object.entries(params)
    .map(([key, value]) => [key, String(value)] as const)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('&')
  return createHash('sha1').update(`${payload}secret`).digest('hex')
}

describe('readCloudinaryConfig', () => {
  it('returns null when nothing is configured', () => {
    expect(readCloudinaryConfig({})).toBeNull()
  })

  it('throws when credentials are partially configured', () => {
    expect(() => readCloudinaryConfig({ CLOUDINARY_CLOUD_NAME: 'demo' })).toThrow(
      /partially configured/i,
    )
  })

  it('applies the default folder when all credentials are present', () => {
    expect(
      readCloudinaryConfig({
        CLOUDINARY_CLOUD_NAME: 'demo',
        CLOUDINARY_API_KEY: 'key',
        CLOUDINARY_API_SECRET: 'secret',
      }),
    ).toEqual({
      cloudName: 'demo',
      apiKey: 'key',
      apiSecret: 'secret',
      folder: 'otoweb/vehicles',
    })
  })
})

describe('cloudinarySignature', () => {
  it('signs sorted non-empty parameters', () => {
    const params = { public_id: input.publicId, timestamp: 1_700_000_000, invalidate: 'true' }
    expect(cloudinarySignature(params, 'secret')).toBe(expectedSignature(params))
  })
})

describe('createCloudinaryMediaProvider', () => {
  it('uploads with a signed multipart request and returns the provider asset', async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          secure_url: 'https://res.cloudinary.com/demo/image/upload/v1/otoweb/vehicles/a.jpg',
          public_id: input.publicId,
          width: 3000,
          height: 2000,
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      )
    })

    const provider = createCloudinaryMediaProvider(config, {
      fetch: fetchMock as never,
      now: () => 1_700_000_000_000,
    })

    const result = await provider.upload(input)
    expect(result).toEqual({
      provider: 'cloudinary',
      assetId: input.publicId,
      url: 'https://res.cloudinary.com/demo/image/upload/v1/otoweb/vehicles/a.jpg',
      width: 3000,
      height: 2000,
    })

    expect(cloudinaryUploadUrl('demo')).toBe('https://api.cloudinary.com/v1_1/demo/image/upload')
    expect(fetchMock).toHaveBeenCalledTimes(1)

    const [url, init] = (fetchMock.mock.calls[0] ?? []) as unknown as [string, RequestInit]
    expect(url).toBe(cloudinaryUploadUrl('demo'))
    expect(init.method).toBe('POST')
    expect(init.body).toBeInstanceOf(FormData)

    const form = init.body as FormData
    expect(form.get('api_key')).toBe('key')
    expect(form.get('public_id')).toBe(input.publicId)
    expect(form.get('timestamp')).toBe('1700000000')
    expect(form.get('overwrite')).toBe('true')
    expect(form.get('invalidate')).toBe('true')
    expect(form.get('signature')).toBe(
      expectedSignature({
        public_id: input.publicId,
        timestamp: 1_700_000_000,
        overwrite: 'true',
        invalidate: 'true',
      }),
    )
    expect(form.get('file')).toBeInstanceOf(Blob)
  })

  it('classifies 5xx responses as transient and other failures as permanent', async () => {
    const transient = createCloudinaryMediaProvider(config, {
      fetch: (async () => new Response(JSON.stringify({ error: 'down' }), { status: 503 })) as never,
    })
    await expect(transient.upload(input)).rejects.toMatchObject({
      name: 'MediaProviderError',
      code: 'transient',
    })

    const permanent = createCloudinaryMediaProvider(config, {
      fetch: (async () => new Response(JSON.stringify({ error: 'bad' }), { status: 400 })) as never,
    })
    await expect(permanent.upload(input)).rejects.toMatchObject({
      name: 'MediaProviderError',
      code: 'permanent',
    })
  })

  it('classifies network errors as transient', async () => {
    const provider = createCloudinaryMediaProvider(config, {
      fetch: (async () => {
        throw new TypeError('network down')
      }) as never,
    })

    await expect(provider.upload(input)).rejects.toBeInstanceOf(MediaProviderError)
    await expect(provider.upload(input)).rejects.toMatchObject({ code: 'transient' })
  })

  it('destroys by public id and accepts "not found" as success', async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify({ result: 'not found' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    })

    const provider = createCloudinaryMediaProvider(config, {
      fetch: fetchMock as never,
      now: () => 1_700_000_000_000,
    })

    await expect(provider.destroy(input.publicId)).resolves.toBeUndefined()

    const [url, init] = (fetchMock.mock.calls[0] ?? []) as unknown as [string, RequestInit]
    expect(url).toBe('https://api.cloudinary.com/v1_1/demo/image/destroy')
    const form = init.body as FormData
    expect(form.get('public_id')).toBe(input.publicId)
    expect(form.get('timestamp')).toBe('1700000000')
    expect(form.get('signature')).toBe(
      expectedSignature({
        public_id: input.publicId,
        timestamp: 1_700_000_000,
        invalidate: 'true',
      }),
    )
  })
})
