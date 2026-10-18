import Link from 'next/link'
import { ArrowRight, Plus } from 'lucide-react'

import { PlatformPageHeader } from '@/components/platform-shell'
import { PlatformStatusBadge } from '@/components/platform/status-badge'
import { requirePlatformOperatorPage } from '@/lib/platform/auth'
import { listPlatformTenants } from '@/lib/platform/tenant-service'

export const dynamic = 'force-dynamic'

export default async function PlatformPage() {
  const { db, user } = await requirePlatformOperatorPage()
  const result = await listPlatformTenants(db, user.id)

  if (!result.ok) {
    return (
      <>
        <PlatformPageHeader title="Tenant" description="Semua showroom di platform OtoWeb." />
        <p role="alert" className="border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {result.message}
        </p>
      </>
    )
  }

  const tenants = result.data
  const cards = [
    ['Total tenant', tenants.length],
    ['Aktif', tenants.filter((tenant) => tenant.status === 'active').length],
    ['Uji coba', tenants.filter((tenant) => tenant.status === 'trial').length],
    ['Nonaktif', tenants.filter((tenant) => tenant.status === 'disabled').length],
  ] as const

  return (
    <>
      <PlatformPageHeader
        title="Tenant"
        description="Semua showroom di platform OtoWeb. Buka satu tenant untuk memeriksa dan mengubah konfigurasinya."
        action={
          <Link
            href="/platform/tenants/new"
            className="flex min-h-10 items-center justify-center gap-2 bg-neutral-950 px-4 text-sm font-semibold text-white transition-colors hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950/30"
          >
            <Plus className="size-4" aria-hidden="true" />
            Tenant baru
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map(([label, value]) => (
          <div key={label} className="border border-neutral-200 bg-white p-4">
            <p className="text-sm text-neutral-500">{label}</p>
            <p className="mt-3 text-2xl font-bold tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      <section className="mt-6 border border-neutral-200 bg-white">
        <div className="border-b border-neutral-100 px-5 py-4">
          <h2 className="font-semibold">Daftar tenant</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Status, plan, subdomain, dan ringkasan data setiap showroom.
          </p>
        </div>

        {tenants.length === 0 ? (
          <div className="p-8 text-center">
            <p className="font-semibold">Belum ada tenant.</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-neutral-500">
              Buat tenant pertama untuk menyiapkan showroom, subdomain, dan pemiliknya.
            </p>
            <Link
              href="/platform/tenants/new"
              className="mt-4 inline-flex min-h-10 items-center justify-center gap-2 bg-neutral-950 px-4 text-sm font-semibold text-white"
            >
              <Plus className="size-4" aria-hidden="true" />
              Buat tenant pertama
            </Link>
          </div>
        ) : (
          <div>
            {tenants.map((tenant) => (
              <Link
                key={tenant.id}
                href={`/platform/tenants/${tenant.id}`}
                className="group grid gap-3 border-b border-neutral-100 p-4 transition-colors last:border-b-0 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-neutral-950/20 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] sm:items-center sm:px-5"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold">{tenant.name}</p>
                  <p className="mt-1 text-xs text-neutral-500">{tenant.slug}</p>
                  <p className="mt-1 break-all text-xs text-neutral-500">
                    {tenant.hostnames.length > 0
                      ? tenant.hostnames.join(' · ')
                      : 'Tanpa subdomain'}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <PlatformStatusBadge status={tenant.status} />
                  <span className="border border-neutral-200 px-2 py-1 text-xs text-neutral-600">
                    Plan {tenant.plan}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4 sm:justify-end">
                  <div className="text-left text-xs text-neutral-500 sm:text-right">
                    <p>{tenant.ownerCount} pemilik</p>
                    <p className="mt-1 tabular-nums">
                      {tenant.vehicleCount} unit · {tenant.leadCount} lead
                    </p>
                  </div>
                  <ArrowRight
                    className="size-4 shrink-0 text-neutral-400 transition-transform group-hover:translate-x-1"
                    aria-hidden="true"
                  />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </>
  )
}
