import type { User } from '@supabase/supabase-js'

import type { AuthUser } from './types'

/** Map a Supabase Auth user to the application's minimal auth identity. */
export function toAuthUser(user: Pick<User, 'id' | 'email' | 'user_metadata'>): AuthUser {
  const metadata = user.user_metadata as Record<string, unknown> | null | undefined
  const candidate = metadata?.full_name ?? metadata?.name
  const displayName =
    typeof candidate === 'string' && candidate.trim().length > 0 ? candidate.trim() : null

  return {
    id: user.id,
    email: user.email ?? null,
    displayName,
  }
}
