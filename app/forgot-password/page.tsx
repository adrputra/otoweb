import type { Metadata } from 'next'
import Link from 'next/link'

import { AuthShell } from '@/components/auth/auth-shell'

import { ForgotPasswordForm } from './forgot-password-form'

export const metadata: Metadata = {
  title: 'Lupa kata sandi — Prima Auto Gallery Admin',
  description: 'Minta tautan pemulihan kata sandi untuk panel admin Prima Auto Gallery.',
}

export default function ForgotPasswordPage() {
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
      <ForgotPasswordForm />
    </AuthShell>
  )
}
