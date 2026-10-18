import type { Metadata } from 'next'
import Link from 'next/link'

import { AuthShell } from '@/components/auth/auth-shell'
import { getCurrentUser } from '@/lib/auth/server'

import { ResetPasswordForm } from './reset-password-form'

export const metadata: Metadata = {
  title: 'Buat kata sandi baru — Prima Auto Gallery Admin',
  description: 'Buat kata sandi baru untuk akun panel admin Prima Auto Gallery.',
}

export default async function ResetPasswordPage() {
  const user = await getCurrentUser()

  return (
    <AuthShell
      footer={
        <Link
          href="/login"
          className="font-medium text-neutral-700 underline underline-offset-4 hover:text-neutral-950"
        >
          Kembali ke halaman masuk
        </Link>
      }
    >
      {user ? (
        <ResetPasswordForm email={user.email} />
      ) : (
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-neutral-950">
            Tautan pemulihan tidak valid
          </h2>
          <p className="mt-2 text-sm leading-6 text-neutral-500">
            Tautan ini sudah kedaluwarsa, sudah digunakan, atau tidak dibuka di perangkat yang sama.
            Minta tautan baru untuk melanjutkan.
          </p>
          <Link
            href="/forgot-password"
            className="mt-6 inline-flex h-11 items-center justify-center bg-neutral-950 px-5 text-sm font-semibold text-white transition-colors hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950 focus-visible:ring-offset-2"
          >
            Minta tautan baru
          </Link>
        </div>
      )}
    </AuthShell>
  )
}
