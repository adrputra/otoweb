export interface SupabaseEnv {
  url: string
  anonKey: string
}

/**
 * Read the browser-safe Supabase project configuration.
 *
 * Only the public URL and anon key are used. A service-role key is never read
 * by the application and must never be committed.
 */
export function readSupabaseEnv(): SupabaseEnv {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()

  if (!url || !anonKey) {
    throw new Error(
      'Supabase Auth is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.',
    )
  }

  return { url, anonKey }
}

/** Non-throwing variant for proxy paths that must fail closed. */
export function readSupabaseEnvOrNull(): SupabaseEnv | null {
  try {
    return readSupabaseEnv()
  } catch {
    return null
  }
}
