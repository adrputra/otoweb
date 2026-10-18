import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { AuthShell } from '@/components/auth/auth-shell'
import { safeNextPath } from '@/lib/auth/paths'
import { getCurrentUser } from '@/lib/auth/server'
import { resolveAuthBrandName } from '@/lib/public/branding'

import { LoginForm } from './login-form'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const brand = await resolveAuthBrandName()
  return {
    title: `Masuk — ${brand} Admin`,
    description: `Masuk ke panel admin ${brand}.`,
  }
}

function param(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '')
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const next = safeNextPath(param(params.next))
  const [user, brand] = await Promise.all([getCurrentUser(), resolveAuthBrandName()])

  if (user) redirect(next)

  return (
    <AuthShell
      brandName={brand}
      footer={
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span>Akun showroom diberikan oleh operator platform.</span>
          <Link
            href="/"
            className="font-medium text-neutral-700 underline underline-offset-4 hover:text-neutral-950"
          >
            Kembali ke situs
          </Link>
        </div>
      }
    >
      <LoginForm
        next={next}
        loggedOut={param(params.logout) === '1'}
        callbackError={param(params.error) === 'callback'}
      />
    </AuthShell>
  )
}
