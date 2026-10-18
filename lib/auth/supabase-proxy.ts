import { createServerClient } from '@supabase/ssr'
import type { NextRequest } from 'next/server'

import { readSupabaseEnvOrNull } from './supabase-env'
import { toAuthUser } from './supabase-user'
import type { AuthCookie, AuthResolution } from './types'

/**
 * Edge-safe Supabase session resolver for the Next.js proxy.
 *
 * Reads auth cookies from the incoming request, lets `@supabase/ssr` refresh
 * the session when possible, and returns the refreshed cookies/headers so the
 * caller can attach them to whichever response it sends. Missing configuration
 * or provider failures resolve to an anonymous session (fail closed).
 */
export async function resolveSupabaseUser(request: NextRequest): Promise<AuthResolution> {
  const env = readSupabaseEnvOrNull()
  if (!env) return { user: null, cookies: [] }

  const capturedCookies: AuthCookie[] = []
  const capturedHeaders: Record<string, string> = {}

  const supabase = createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet, headers) => {
        for (const cookie of cookiesToSet) {
          request.cookies.set(cookie.name, cookie.value)
          capturedCookies.push(cookie)
        }
        Object.assign(capturedHeaders, headers)
      },
    },
  })

  try {
    const { data, error } = await supabase.auth.getUser()

    if (error || !data.user) {
      return { user: null, cookies: capturedCookies, headers: capturedHeaders }
    }

    return {
      user: toAuthUser(data.user),
      cookies: capturedCookies,
      headers: capturedHeaders,
    }
  } catch {
    return { user: null, cookies: capturedCookies, headers: capturedHeaders }
  }
}
