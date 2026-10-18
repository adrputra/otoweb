import type { Metadata } from 'next'
import Link from 'next/link'

import { AuthShell } from '@/components/auth/auth-shell'
import { resolveAuthBrandName } from '@/lib/public/branding'

import { ForgotPasswordForm } from './forgot-password-form'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const brand = await resolveAuthBrandName()
  return {
    title: `Lupa kata sandi — ${brand} Admin`,
    description: `Minta tautan pemulihan kata sandi untuk panel admin ${brand}.`,
  }
}

export default async function ForgotPasswordPage() {
  const brand = await resolveAuthBrandName()

  return (
    <AuthShell
      brandName={brand}
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
