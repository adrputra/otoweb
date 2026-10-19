// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

import { createR2MediaProvider, readR2Config, type R2Config } from '@/lib/media/r2'

const config: R2Config = {
  accountId: 'account',
  accessKeyId: 'access-key',
  secretAccessKey: 'secret-key',
  bucket: 'otoweb-media',
  publicBaseUrl: 'https://media.example.com',
  endpoint: 'https://account.r2.cloudflarestorage.com',
  region: 'auto',
}

const input = {
  bytes: new Uint8Array([1, 2, 3, 4]),
  filename: 'foto.png',
  contentType: 'image/png' as const,
  publicId: 'otoweb/vehicles/tenant/vehicle/hash',
  width: 800,
  height: 600,
}

function configured(overrides: Record<string, string> = {}) {
  return {
    R2_ACCOUNT_ID: 'account',
    R2_ACCESS_KEY_ID: 'access-key',
    R2_SECRET_ACCESS_KEY: 'secret-key',
    R2_BUCKET: 'otoweb-media',
    R2_PUBLIC_BASE_URL: 'https://media.example.com',
    ...overrides,
  }
}

describe('readR2Config', () => {
  it('returns null when nothing is configured', () => {
    expect(readR2Config({})).toBeNull()
  })

  it('rejects a partial configuration', () => {
    expect(() => readR2Config({ R2_BUCKET: 'otoweb-media' })).toThrow(/partially configured/i)
  })

  it('applies the R2 defaults', () => {
    expect(readR2Config(configured())).toMatchObject({
      accountId: 'account',
      bucket: 'otoweb-media',
      publicBaseUrl: 'https://media.example.com',
      endpoint: 'https://account.r2.cloudflarestorage.com',
      region: 'auto',
    })
  })

  it('accepts an explicit endpoint instead of an account id', () => {
    expect(
      readR2Config({
        ...configured({ R2_ACCOUNT_ID: '' }),
        R2_ENDPOINT: 'http://127.0.0.1:9000',
      }),
    ).toMatchObject({ endpoint: 'http://127.0.0.1:9000' })
  })
})

describe('createR2MediaProvider', () => {
  it('uploads with a signed PUT and returns the public URL', async () => {
    let captured: Request | undefined
    const fetchMock = vi.fn(async (request: Request) => {
      captured = request
      return new Response(null, { status: 200 })
    })

    const provider = createR2MediaProvider(config, { fetch: fetchMock })
    const result = await provider.upload(input)

    expect(result).toEqual({
      provider: 'r2',
      assetId: input.publicId,
      url: 'https://media.example.com/otoweb/vehicles/tenant/vehicle/hash',
      width: 800,
      height: 600,
    })

    expect(captured?.method).toBe('PUT')
    expect(captured?.url).toBe(
      'https://account.r2.cloudflarestorage.com/otoweb-media/otoweb/vehicles/tenant/vehicle/hash',
    )
    expect(captured?.headers.get('authorization')).toContain('AWS4-HMAC-SHA256')
    expect(captured?.headers.get('content-type')).toBe('image/png')
    expect(captured?.headers.get('cache-control')).toContain('immutable')

    const body = new Uint8Array(await captured!.arrayBuffer())
    expect(Array.from(body)).toEqual(Array.from(input.bytes))
  })

  it('deletes with a signed DELETE and treats 404 as success', async () => {
    let captured: Request | undefined
    const fetchMock = vi.fn(async (request: Request) => {
      captured = request
      return new Response(null, { status: 404 })
    })

    const provider = createR2MediaProvider(config, { fetch: fetchMock })
    await expect(provider.destroy(input.publicId)).resolves.toBeUndefined()

    expect(captured?.method).toBe('DELETE')
    expect(captured?.url).toBe(
      'https://account.r2.cloudflarestorage.com/otoweb-media/otoweb/vehicles/tenant/vehicle/hash',
    )
    expect(captured?.headers.get('authorization')).toContain('AWS4-HMAC-SHA256')
  })

  it('classifies 5xx as transient and 4xx as permanent', async () => {
    const serverError = createR2MediaProvider(config, {
      fetch: async () => new Response('unavailable', { status: 503 }),
    })
    await expect(serverError.upload(input)).rejects.toMatchObject({ code: 'transient' })

    const forbidden = createR2MediaProvider(config, {
      fetch: async () => new Response('denied', { status: 403 }),
    })
    await expect(forbidden.upload(input)).rejects.toMatchObject({ code: 'permanent' })
  })

  it('rejects path traversal in an object key', async () => {
    const provider = createR2MediaProvider(config, {
      fetch: async () => new Response(null, { status: 200 }),
    })

    await expect(provider.upload({ ...input, publicId: '../escape' })).rejects.toMatchObject({
      code: 'permanent',
    })
  })
})
