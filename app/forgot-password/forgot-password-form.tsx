'use client'

import Link from 'next/link'
import { ArrowLeft, Loader2, Mail } from 'lucide-react'
import { useActionState } from 'react'

import { AuthMessage } from '@/components/auth/auth-message'
import { Field, inputClassName } from '@/components/auth/form-field'
import { requestPasswordResetAction } from '@/lib/auth/actions'
import type { AuthActionState } from '@/lib/auth/types'

const initialState: AuthActionState = {}

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(requestPasswordResetAction, initialState)

  if (state.success) {
    return (
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-neutral-950">
          Periksa email Anda
        </h2>
        <p className="mt-2 text-sm leading-6 text-neutral-500">
          Kami telah memproses permintaan pemulihan. Ikuti petunjuk di email untuk membuat kata
          sandi baru.
        </p>
        <AuthMessage tone="success" className="mt-6">
          {state.success}
        </AuthMessage>
        <Link
          href="/login"
          className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-neutral-700 underline underline-offset-4 hover:text-neutral-950"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Kembali ke halaman masuk
        </Link>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-semibold tracking-tight text-neutral-950">
          Pulihkan akses akun
        </h2>
        <p className="mt-2 text-sm leading-6 text-neutral-500">
          Masukkan email akun showroom Anda. Kami akan mengirim tautan untuk membuat kata sandi
          baru.
        </p>
      </div>

      <form action={formAction} className="space-y-5" noValidate>
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
            aria-describedby={state.error ? 'reset-request-error' : undefined}
          />
        </Field>

        {state.error ? (
          <div id="reset-request-error">
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
              Mengirim…
            </>
          ) : (
            <>
              <Mail className="size-4" aria-hidden="true" />
              Kirim tautan pemulihan
            </>
          )}
        </button>
      </form>

      <p className="mt-6 text-xs leading-5 text-neutral-500">
        Demi keamanan, halaman ini tidak memberi tahu apakah sebuah email terdaftar.
      </p>
    </div>
  )
}
