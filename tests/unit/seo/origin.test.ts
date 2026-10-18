// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { absoluteUrl, resolveRequestOrigin } from '@/lib/seo/origin'

describe('resolveRequestOrigin', () => {
  it('uses the request host and the default http protocol', () => {
    expect(resolveRequestOrigin({ host: 'prima.otoweb.id:3000' })).toBe(
      'http://prima.otoweb.id:3000',
    )
  })

  it('prefers the first forwarded host and forwarded protocol', () => {
    expect(
      resolveRequestOrigin({
        host: 'internal.local',
        forwardedHost: 'prima.otoweb.id, proxy.local',
        forwardedProto: 'https, http',
      }),
    ).toBe('https://prima.otoweb.id')
  })

  it('rejects malformed or path-like host values', () => {
    expect(resolveRequestOrigin({ host: 'prima.otoweb.id/evil' })).toBe(
      'http://localhost:3000',
    )
    expect(resolveRequestOrigin({ host: 'user@prima.otoweb.id' })).toBe(
      'http://localhost:3000',
    )
    expect(resolveRequestOrigin({ host: 'prima otoweb id' })).toBe(
      'http://localhost:3000',
    )
  })

  it('falls back to the configured site URL only when no host is present', () => {
    expect(
      resolveRequestOrigin({ fallback: 'https://showroom.example.com/path' }),
    ).toBe('https://showroom.example.com')
    expect(resolveRequestOrigin({ fallback: 'not a url' })).toBe(
      'http://localhost:3000',
    )
  })

  it('normalizes a https forwarded protocol', () => {
    expect(
      resolveRequestOrigin({ host: 'prima.otoweb.id', forwardedProto: 'HTTPS' }),
    ).toBe('https://prima.otoweb.id')
  })
})

describe('absoluteUrl', () => {
  const origin = 'https://prima.otoweb.id'

  it('resolves relative paths and leaves absolute http URLs intact', () => {
    expect(absoluteUrl('/placeholder.jpg', origin)).toBe(
      'https://prima.otoweb.id/placeholder.jpg',
    )
    expect(absoluteUrl('https://images.example.com/car.jpg', origin)).toBe(
      'https://images.example.com/car.jpg',
    )
  })

  it('falls back to the local placeholder for empty or non-http values', () => {
    expect(absoluteUrl('', origin)).toBe('https://prima.otoweb.id/placeholder.jpg')
    expect(absoluteUrl('data:image/png;base64,abc', origin)).toBe(
      'https://prima.otoweb.id/placeholder.jpg',
    )
  })
})
