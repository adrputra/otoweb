'use client'

import { Eye, EyeOff, KeyRound, Loader2 } from 'lucide-react'
import { useActionState, useState } from 'react'

import { AuthMessage } from '@/components/auth/auth-message'
import { Field, inputClassName } from '@/components/auth/form-field'
import { updatePasswordAction } from '@/lib/auth/actions'
import type { AuthActionState } from '@/lib/auth/types'

const initialState: AuthActionState = {}

export function ResetPasswordForm({ email }: { email: string | null }) {
  const [state, formAction, pending] = useActionState(updatePasswordAction, initialState)
  const [showPassword, setShowPassword] = useState(false)

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-semibold tracking-tight text-neutral-950">
          Buat kata sandi baru
        </h2>
        <p className="mt-2 text-sm leading-6 text-neutral-500">
          {email
            ? `Masukkan kata sandi baru untuk ${email}.`
            : 'Masukkan kata sandi baru untuk akun Anda.'}
        </p>
      </div>

      <form action={formAction} className="space-y-5" noValidate>
        <Field
          id="password"
          label="Kata sandi baru"
          hint="Minimal 8 karakter. Gunakan kombinasi yang tidak Anda pakai di layanan lain."
        >
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              required
              minLength={8}
              maxLength={72}
              placeholder="••••••••"
              className={`${inputClassName} pr-12`}
              aria-describedby={state.error ? 'reset-password-error' : undefined}
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
              aria-pressed={showPassword}
              className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-neutral-500 transition-colors hover:text-neutral-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-neutral-950/20"
            >
              {showPassword ? (
                <EyeOff className="size-4" aria-hidden="true" />
              ) : (
                <Eye className="size-4" aria-hidden="true" />
              )}
            </button>
          </div>
        </Field>

        <Field id="confirmPassword" label="Ulangi kata sandi baru">
          <input
            id="confirmPassword"
            name="confirmPassword"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={72}
            placeholder="••••••••"
            className={inputClassName}
            aria-describedby={state.error ? 'reset-password-error' : undefined}
          />
        </Field>

        {state.error ? (
          <div id="reset-password-error">
            <AuthMessage tone="error">{state.error}</AuthMessage>
          </div>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="flex h-11 w-full items-center justify-center gap-2 bg-neutral-950 px-4 text-sm font-semibold text-white transition-colors hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-neutral-400"
        >
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Menyimpan…
            </>
          ) : (
            <>
              <KeyRound className="size-4" aria-hidden="true" />
              Simpan kata sandi
            </>
          )}
        </button>
      </form>
    </div>
  )
}
