// @vitest-environment node
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const supabaseMocks = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
  verifyOtp: vi.fn(),
}))

vi.mock('@/lib/auth/supabase-route', () => ({
  createRouteHandlerSupabaseClient: () => ({ auth: supabaseMocks }),
}))

import { GET } from '@/app/auth/callback/route'

function callbackRequest(query: string): NextRequest {
  return new NextRequest(`http://localhost:3000/auth/callback?${query}`)
}

function locationOf(response: Response): URL {
  return new URL(response.headers.get('location') as string)
}

describe('auth callback', () => {
  beforeEach(() => {
    supabaseMocks.exchangeCodeForSession.mockReset()
    supabaseMocks.verifyOtp.mockReset()
    supabaseMocks.exchangeCodeForSession.mockResolvedValue({ error: null })
    supabaseMocks.verifyOtp.mockResolvedValue({ error: null })
  })

  it('sends a recovery code to the reset-password form', async () => {
    const response = await GET(callbackRequest('code=abc&next=/reset-password'))

    expect(response.status).toBe(307)
    expect(locationOf(response).pathname).toBe('/reset-password')
    expect(supabaseMocks.exchangeCodeForSession).toHaveBeenCalledWith('abc')
  })

  it('sends a recovery token hash to the reset-password form', async () => {
    const response = await GET(
      callbackRequest('token_hash=hash&type=recovery&next=/reset-password'),
    )

    expect(locationOf(response).pathname).toBe('/reset-password')
    expect(supabaseMocks.verifyOtp).toHaveBeenCalledWith({
      token_hash: 'hash',
      type: 'recovery',
    })
  })

  it('preserves a safe nested admin destination', async () => {
    const response = await GET(callbackRequest('code=abc&next=/admin/vehicles?status=available'))

    const location = locationOf(response)
    expect(location.pathname).toBe('/admin/vehicles')
    expect(location.search).toBe('?status=available')
  })

  it('refuses to redirect off-site', async () => {
    const response = await GET(callbackRequest('code=abc&next=https://evil.example/reset-password'))

    expect(locationOf(response).pathname).toBe('/admin')
  })

  it('returns to sign-in with an error when the exchange fails', async () => {
    supabaseMocks.exchangeCodeForSession.mockResolvedValue({
      error: new Error('expired'),
    })

    const response = await GET(callbackRequest('code=expired&next=/reset-password'))

    const location = locationOf(response)
    expect(location.pathname).toBe('/login')
    expect(location.searchParams.get('error')).toBe('callback')
  })

  it('returns to sign-in when no code or token hash is supplied', async () => {
    const response = await GET(callbackRequest('next=/reset-password'))

    const location = locationOf(response)
    expect(location.pathname).toBe('/login')
    expect(location.searchParams.get('error')).toBe('callback')
  })
})
