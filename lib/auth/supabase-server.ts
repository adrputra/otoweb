import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

import { readSupabaseEnv } from './supabase-env'
import { toAuthUser } from './supabase-user'
import type { AuthBackend, AuthErrorCode, AuthResult, AuthUser, SignInCredentials } from './types'

function failure<T>(error: AuthErrorCode, message?: string): AuthResult<T> {
  return { ok: false, error, message }
}

function mapSignInError(code: string | undefined, status: number | undefined): AuthErrorCode {
  if (code === 'invalid_credentials' || status === 400) return 'invalid_credentials'
  return 'unexpected'
}

/**
 * Create a request-scoped Supabase Auth backend for server actions, route
 * handlers, and server components. A new client is created on every call; the
 * client is never shared across requests.
 */
export async function createServerAuthBackend(): Promise<AuthBackend> {
  const { url, anonKey } = readSupabaseEnv()
  const cookieStore = await cookies()

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        } catch {
          // Server Components cannot write cookies. The proxy refreshes
          // sessions on the next request; actions and route handlers can write.
        }
      },
    },
  })

  return {
    async getUser(): Promise<AuthUser | null> {
      const { data, error } = await supabase.auth.getUser()
      if (error || !data.user) return null
      return toAuthUser(data.user)
    },

    async signInWithPassword(credentials: SignInCredentials): Promise<AuthResult<AuthUser>> {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password,
      })

      if (error) {
        return failure(
          mapSignInError(error.code, error.status),
          'Email atau kata sandi tidak cocok.',
        )
      }

      if (!data.user) return failure('unexpected', 'Sesi tidak dapat dibuat.')

      return { ok: true, data: toAuthUser(data.user) }
    },

    async signOut(): Promise<AuthResult<null>> {
      const { error } = await supabase.auth.signOut()
      if (error) return failure('unexpected', error.message)
      return { ok: true, data: null }
    },

    async requestPasswordReset(email: string, redirectTo: string): Promise<AuthResult<null>> {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
      if (error) return failure('unexpected', error.message)
      return { ok: true, data: null }
    },

    async updatePassword(password: string): Promise<AuthResult<AuthUser>> {
      const { data, error } = await supabase.auth.updateUser({ password })

      if (error) {
        if (error.code === 'same_password') {
          return failure('weak_password', 'Kata sandi baru harus berbeda dari sebelumnya.')
        }
        return failure('session_invalid', 'Sesi pemulihan tidak valid atau sudah kedaluwarsa.')
      }

      if (!data.user) return failure('session_invalid', 'Sesi pemulihan tidak valid.')

      return { ok: true, data: toAuthUser(data.user) }
    },
  }
}
