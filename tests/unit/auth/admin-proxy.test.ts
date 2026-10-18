// @vitest-environment node
import { NextRequest } from 'next/server'
import { describe, expect, it } from 'vitest'

import { createAdminProxy } from '@/lib/auth/admin-proxy'
import { safeCallbackPath, safeNextPath } from '@/lib/auth/paths'
import { resolveSessionUser } from '@/lib/auth/session'
import type { AuthResolution } from '@/lib/auth/types'

import { FakeAuthBackend, testUser } from './fake-auth'

function adminRequest(path = '/admin'): NextRequest {
  return new NextRequest(`http://localhost:3000${path}`)
}

function resolveAs(resolution: AuthResolution) {
  return async () => resolution
}

describe('admin proxy', () => {
  it('redirects anonymous admin requests to sign-in', async () => {
    const proxy = createAdminProxy({ resolveAuth: resolveAs({ user: null }) })
    const response = await proxy(adminRequest('/admin'))

    expect(response.status).toBe(307)
    const location = response.headers.get('location')
    expect(location).not.toBeNull()

    const url = new URL(location as string)
    expect(url.pathname).toBe('/login')
    expect(url.searchParams.get('next')).toBe('/admin')
  })

  it('preserves a nested admin path and query string in next', async () => {
    const proxy = createAdminProxy({ resolveAuth: resolveAs({ user: null }) })
    const response = await proxy(adminRequest('/admin/vehicles?status=available&q=toyota'))

    const url = new URL(response.headers.get('location') as string)
    expect(url.pathname).toBe('/login')
    expect(url.searchParams.get('next')).toBe('/admin/vehicles?status=available&q=toyota')
  })

  it('allows an authenticated request through', async () => {
    const proxy = createAdminProxy({ resolveAuth: resolveAs({ user: testUser }) })
    const response = await proxy(adminRequest('/admin/vehicles'))

    expect(response.status).toBe(200)
    expect(response.headers.get('x-middleware-next')).toBe('1')
    expect(response.headers.get('location')).toBeNull()
  })

  it('redirects anonymous platform requests with a safe platform next path', async () => {
    const proxy = createAdminProxy({ resolveAuth: resolveAs({ user: null }) })
    const response = await proxy(adminRequest('/platform/tenants/11111111-1111-4111-8111-111111111111'))

    expect(response.status).toBe(307)
    const url = new URL(response.headers.get('location') as string)
    expect(url.pathname).toBe('/login')
    expect(url.searchParams.get('next')).toBe(
      '/platform/tenants/11111111-1111-4111-8111-111111111111',
    )
  })

  it('allows an authenticated platform request through', async () => {
    const proxy = createAdminProxy({ resolveAuth: resolveAs({ user: testUser }) })
    const response = await proxy(adminRequest('/platform'))

    expect(response.status).toBe(200)
    expect(response.headers.get('x-middleware-next')).toBe('1')
  })

  it('fails closed when the resolver throws', async () => {
    const proxy = createAdminProxy({
      resolveAuth: async () => {
        throw new Error('tampered session')
      },
    })
    const response = await proxy(adminRequest('/admin'))

    expect(response.status).toBe(307)
    expect(new URL(response.headers.get('location') as string).pathname).toBe('/login')
  })

  it('rejects an expired session', async () => {
    const auth = new FakeAuthBackend({
      startSignedInAs: 'owner@example.com',
      sessionExpiresAt: Date.now() - 1_000,
    })
    const proxy = createAdminProxy({
      resolveAuth: async () => ({ user: await resolveSessionUser(auth) }),
    })

    const response = await proxy(adminRequest('/admin'))
    expect(response.status).toBe(307)
  })

  it('rejects an invalidated session', async () => {
    const auth = new FakeAuthBackend({ startSignedInAs: 'owner@example.com' })
    auth.invalidateSession()

    const proxy = createAdminProxy({
      resolveAuth: async () => ({ user: await resolveSessionUser(auth) }),
    })

    const response = await proxy(adminRequest('/admin'))
    expect(response.status).toBe(307)
  })

  it('applies refreshed cookies and cache headers to an allowed response', async () => {
    const proxy = createAdminProxy({
      resolveAuth: resolveAs({
        user: testUser,
        cookies: [
          {
            name: 'sb-access-token',
            value: 'refreshed-token',
            options: { path: '/', httpOnly: true, sameSite: 'lax' },
          },
        ],
        headers: {
          'cache-control': 'private, no-cache, no-store, must-revalidate, max-age=0',
        },
      }),
    })

    const response = await proxy(adminRequest('/admin'))
    expect(response.headers.get('set-cookie')).toContain('sb-access-token=refreshed-token')
    expect(response.headers.get('cache-control')).toContain('no-store')
  })

  it('applies refreshed cookies to the redirect response too', async () => {
    const proxy = createAdminProxy({
      resolveAuth: resolveAs({
        user: null,
        cookies: [{ name: 'sb-refresh-token', value: 'cleared' }],
      }),
    })

    const response = await proxy(adminRequest('/admin'))
    expect(response.status).toBe(307)
    expect(response.headers.get('set-cookie')).toContain('sb-refresh-token=cleared')
  })
})

describe('safeNextPath', () => {
  it('accepts the admin home and nested admin paths', () => {
    expect(safeNextPath('/admin')).toBe('/admin')
    expect(safeNextPath('/admin/vehicles?status=available')).toBe(
      '/admin/vehicles?status=available',
    )
  })

  it('accepts the platform home and nested platform paths', () => {
    expect(safeNextPath('/platform')).toBe('/platform')
    expect(safeNextPath('/platform/tenants/new')).toBe('/platform/tenants/new')
    expect(
      safeNextPath('/platform/tenants/11111111-1111-4111-8111-111111111111'),
    ).toBe('/platform/tenants/11111111-1111-4111-8111-111111111111')
  })

  it('falls back for external, protocol-relative, and non-admin targets', () => {
    expect(safeNextPath('https://evil.example/admin')).toBe('/admin')
    expect(safeNextPath('//evil.example/admin')).toBe('/admin')
    expect(safeNextPath('/cars')).toBe('/admin')
    expect(safeNextPath('/administer')).toBe('/admin')
    expect(safeNextPath('/platformer')).toBe('/admin')
    expect(safeNextPath('/admin\\..\\cars')).toBe('/admin')
    expect(safeNextPath(null)).toBe('/admin')
  })
})

describe('safeCallbackPath', () => {
  it('accepts the password-reset form and admin destinations', () => {
    expect(safeCallbackPath('/reset-password')).toBe('/reset-password')
    expect(safeCallbackPath('/admin')).toBe('/admin')
    expect(safeCallbackPath('/admin/vehicles?status=available')).toBe(
      '/admin/vehicles?status=available',
    )
  })

  it('falls back for external, protocol-relative, and unrelated targets', () => {
    expect(safeCallbackPath('https://evil.example/reset-password')).toBe('/admin')
    expect(safeCallbackPath('//evil.example/reset-password')).toBe('/admin')
    expect(safeCallbackPath('/cars')).toBe('/admin')
    expect(safeCallbackPath('/reset-password/extra')).toBe('/admin')
    expect(safeCallbackPath('/reset-password?next=https://evil.example')).toBe('/admin')
    expect(safeCallbackPath(null)).toBe('/admin')
  })
})
