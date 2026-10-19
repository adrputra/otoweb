'use server'

import { redirect } from 'next/navigation'

import { safeNextPath } from './paths'
import { requestPasswordReset, signInWithPassword, signOut, updatePassword } from './service'
import { createServerAuthBackend } from './local'
import type { AuthActionState } from './types'
import { loginSchema, resetRequestSchema, updatePasswordSchema } from './validation'

const INVALID_LOGIN = 'Email atau kata sandi tidak cocok. Periksa kembali lalu coba lagi.'
const GENERIC_RESET =
  'Permintaan diterima. Operator platform akan menindaklanjuti reset kata sandi Anda.'
const CONFIG_ERROR = 'Autentikasi sedang tidak tersedia. Hubungi operator platform.'

function formValue(formData: FormData, key: string): string {
  const value = formData.get(key)
  return typeof value === 'string' ? value : ''
}

function firstIssue(issues: readonly { message: string }[]): string {
  return issues[0]?.message ?? 'Periksa kembali isian Anda.'
}

export async function loginAction(
  _previous: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = loginSchema.safeParse({
    email: formValue(formData, 'email'),
    password: formValue(formData, 'password'),
  })

  if (!parsed.success) return { error: firstIssue(parsed.error.issues) }

  const next = safeNextPath(formValue(formData, 'next'))

  try {
    const auth = await createServerAuthBackend()
    const result = await signInWithPassword(auth, parsed.data)

    if (!result.ok) {
      return {
        error:
          result.error === 'invalid_credentials'
            ? INVALID_LOGIN
            : (result.message ?? INVALID_LOGIN),
      }
    }
  } catch {
    return { error: CONFIG_ERROR }
  }

  redirect(next)
}

export async function logoutAction(): Promise<void> {
  try {
    const auth = await createServerAuthBackend()
    await signOut(auth)
  } catch {
    // Sign-out always returns the user to a signed-out screen.
  }

  redirect('/login?logout=1')
}

export async function requestPasswordResetAction(
  _previous: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = resetRequestSchema.safeParse({ email: formValue(formData, 'email') })

  if (!parsed.success) return { error: firstIssue(parsed.error.issues) }

  try {
    const auth = await createServerAuthBackend()
    await requestPasswordReset(auth, parsed.data.email)
  } catch {
    // Never reveal whether the account exists or whether auth is configured.
  }

  return { success: GENERIC_RESET }
}

export async function updatePasswordAction(
  _previous: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = updatePasswordSchema.safeParse({
    password: formValue(formData, 'password'),
    confirmPassword: formValue(formData, 'confirmPassword'),
  })

  if (!parsed.success) return { error: firstIssue(parsed.error.issues) }

  try {
    const auth = await createServerAuthBackend()
    const result = await updatePassword(auth, parsed.data.password)

    if (!result.ok) {
      return { error: result.message ?? 'Kata sandi tidak dapat diperbarui.' }
    }
  } catch {
    return { error: CONFIG_ERROR }
  }

  redirect('/admin?password=updated')
}
