import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

import { CreateTenantForm } from '@/components/platform/create-tenant-form'
import { PlatformPageHeader } from '@/components/platform-shell'
import { requirePlatformOperatorPage } from '@/lib/platform/auth'

export const dynamic = 'force-dynamic'

export default async function NewTenantPage() {
  await requirePlatformOperatorPage()

  return (
    <>
      <Link
        href="/platform"
        className="mb-4 inline-flex min-h-9 items-center gap-2 text-sm font-semibold text-neutral-600 transition-colors hover:text-neutral-950"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Kembali ke tenant
      </Link>

      <PlatformPageHeader
        title="Tenant baru"
        description="Buat showroom, subdomain platform, dan pemilik awal dalam satu langkah."
      />
      <CreateTenantForm />
    </>
  )
}
