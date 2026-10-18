import { createServerClient } from '@supabase/ssr'
import type { NextRequest, NextResponse } from 'next/server'

import { readSupabaseEnv } from './supabase-env'

/**
 * Create a Supabase Auth client for a route handler. Refreshed cookies are
 * written directly to the response that the handler returns.
 */
export function createRouteHandlerSupabaseClient(request: NextRequest, response: NextResponse) {
  const { url, anonKey } = readSupabaseEnv()

  return createServerClient(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet, headers) => {
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options)
        }
        for (const [key, value] of Object.entries(headers)) {
          response.headers.set(key, value)
        }
      },
    },
  })
}
