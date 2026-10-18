'use client'

import Link from 'next/link'
import { Eye, EyeOff, Loader2, LogIn } from 'lucide-react'
import { useActionState, useState } from 'react'

import { AuthMessage } from '@/components/auth/auth-message'
import { Field, inputClassName } from '@/components/auth/form-field'
import { loginAction } from '@/lib/auth/actions'
import type { AuthActionState } from '@/lib/auth/types'

const initialState: AuthActionState = {}

export function LoginForm({
  next,
  loggedOut,
  callbackError,
}: {
  next: string
  loggedOut: boolean
  callbackError: boolean
}) {
  const [state, formAction, pending] = useActionState(loginAction, initialState)
  const [showPassword, setShowPassword] = useState(false)

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-semibold tracking-tight text-neutral-950">
          Masuk ke akun Anda
        </h2>
        <p className="mt-2 text-sm leading-6 text-neutral-500">
          Gunakan email dan kata sandi yang diberikan operator platform untuk mengakses panel
          showroom.
        </p>
      </div>

      <form action={formAction} className="space-y-5" noValidate>
        <input type="hidden" name="next" value={next} />

        <Field id="email" label="Email">
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            placeholder="nama@showroom.id"
            className={inputClassName}
            aria-describedby={state.error ? 'login-error' : undefined}
          />
        </Field>

        <Field
          id="password"
          label="Kata sandi"
          action={
            <Link
              href="/forgot-password"
              className="text-xs font-medium text-neutral-600 underline underline-offset-4 hover:text-neutral-950"
            >
              Lupa kata sandi?
            </Link>
          }
        >
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              placeholder="••••••••"
              className={`${inputClassName} pr-12`}
              aria-describedby={state.error ? 'login-error' : undefined}
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

        {loggedOut ? (
          <AuthMessage tone="success">Anda telah keluar dari panel admin.</AuthMessage>
        ) : null}

        {callbackError ? (
          <AuthMessage tone="error">
            Tautan autentikasi tidak valid atau sudah kedaluwarsa. Silakan masuk kembali.
          </AuthMessage>
        ) : null}

        {state.error ? (
          <div id="login-error">
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
              Memproses…
            </>
          ) : (
            <>
              <LogIn className="size-4" aria-hidden="true" />
              Masuk
            </>
          )}
        </button>
      </form>

      <p className="mt-6 text-xs leading-5 text-neutral-500">
        Akses panel admin hanya untuk staf showroom yang diundang operator platform.
      </p>
    </div>
  )
}
