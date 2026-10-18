import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | undefined

/**
 * Return the browser-safe Supabase client.
 *
 * Authentication flows are intentionally not configured in this phase; this
 * factory only establishes the project connection for later features.
 */
export function getSupabaseClient(): SupabaseClient {
  if (client) return client

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set to create the Supabase client.',
    )
  }

  client = createClient(url, anonKey)
  return client
}
