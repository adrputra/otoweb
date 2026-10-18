import type { EmailOtpType } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'

import { safeCallbackPath } from '@/lib/auth/paths'
import { createRouteHandlerSupabaseClient } from '@/lib/auth/supabase-route'

/**
 * Supabase Auth callback for password recovery and invite links.
 *
 * Supports the PKCE `code` flow and the `token_hash`/`type` email OTP flow.
 * Redirects only to a same-origin admin path.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const code = request.nextUrl.searchParams.get('code')
  const tokenHash = request.nextUrl.searchParams.get('token_hash')
  const type = request.nextUrl.searchParams.get('type')
  const next = safeCallbackPath(request.nextUrl.searchParams.get('next'))

  try {
    const response = NextResponse.redirect(new URL(next, request.nextUrl.origin))
    const supabase = createRouteHandlerSupabaseClient(request, response)

    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      if (error) throw error
    } else if (tokenHash && type) {
      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: type as EmailOtpType,
      })
      if (error) throw error
    } else {
      throw new Error('Missing auth code or token hash')
    }

    return response
  } catch {
    const failure = new URL('/login', request.nextUrl.origin)
    failure.searchParams.set('error', 'callback')
    return NextResponse.redirect(failure)
  }
}
