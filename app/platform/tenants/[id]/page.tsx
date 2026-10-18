import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

import { PlatformPageHeader } from '@/components/platform-shell'
import { PlatformStatusBadge } from '@/components/platform/status-badge'
import { TenantControls } from '@/components/platform/tenant-controls'
import { requirePlatformOperatorPage } from '@/lib/platform/auth'
import { getPlatformTenant } from '@/lib/platform/tenant-service'
import type { PlatformMemberRole } from '@/lib/platform/types'
import { formatDate } from '@/lib/format'

export const dynamic = 'force-dynamic'

const ROLE_LABELS: Record<PlatformMemberRole, string> = {
  platform_admin: 'Platform admin',
  owner: 'Pemilik',
  staff: 'Staf',
}

export default async function TenantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { db, user } = await requirePlatformOperatorPage()
  const result = await getPlatformTenant(db, user.id, id)

  if (!result.ok) {
    if (result.error === 'not_found' || result.error === 'invalid') notFound()
    return (
      <>
        <Link
          href="/platform"
          className="mb-4 inline-flex min-h-9 items-center gap-2 text-sm font-semibold text-neutral-600 hover:text-neutral-950"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Kembali ke tenant
        </Link>
        <p role="alert" className="border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {result.message}
        </p>
      </>
    )
  }

  const tenant = result.data
  const cards = [
    ['Kendaraan', tenant.vehicleCount],
    ['Lead', tenant.leadCount],
    ['Anggota', tenant.memberCount],
    ['Pemilik', tenant.ownerCount],
  ] as const

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
        title={tenant.name}
        description={`${tenant.slug} · plan ${tenant.plan}`}
        action={<PlatformStatusBadge status={tenant.status} />}
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
          <h2 className="font-semibold">Identitas</h2>
        </div>
        <dl className="grid gap-4 p-5 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Slug
            </dt>
            <dd className="mt-1 break-all text-sm">{tenant.slug}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Profil showroom
            </dt>
            <dd className="mt-1 text-sm">{tenant.showroomDisplayName ?? 'Belum dibuat'}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Tema
            </dt>
            <dd className="mt-1 text-sm">{tenant.theme}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Dibuat
            </dt>
            <dd className="mt-1 text-sm">{formatDate(tenant.createdAt)}</dd>
          </div>
        </dl>
      </section>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <section className="border border-neutral-200 bg-white">
          <div className="border-b border-neutral-100 px-5 py-4">
            <h2 className="font-semibold">Domain</h2>
            <p className="mt-1 text-sm text-neutral-500">
              Hostname yang dimiliki tenant ini.
            </p>
          </div>
          {tenant.domains.length === 0 ? (
            <p className="p-5 text-sm text-neutral-500">
              Tenant belum memiliki domain. Tetapkan subdomain di bawah.
            </p>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {tenant.domains.map((domain) => (
                <li key={domain.id} className="flex flex-col gap-1 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="break-all text-sm font-semibold">{domain.hostname}</p>
                    <p className="mt-1 text-xs text-neutral-500">
                      {domain.type === 'platform_subdomain' ? 'Subdomain platform' : 'Domain kustom'}
                      {domain.verifiedAt ? ` · terverifikasi ${formatDate(domain.verifiedAt)}` : ''}
                    </p>
                  </div>
                  <span className="inline-flex min-h-7 items-center border border-neutral-200 px-2.5 text-xs font-medium text-neutral-600">
                    {domain.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="border border-neutral-200 bg-white">
          <div className="border-b border-neutral-100 px-5 py-4">
            <h2 className="font-semibold">Anggota</h2>
            <p className="mt-1 text-sm text-neutral-500">
              Akses ke showroom ini, termasuk pemilik dan operator.
            </p>
          </div>
          <ul className="divide-y divide-neutral-100">
            {tenant.members.map((member) => (
              <li key={member.id} className="flex flex-col gap-1 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {member.fullName || 'Tanpa nama'}
                  </p>
                  <p className="mt-1 break-all text-xs text-neutral-500">{member.userId}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="border border-neutral-200 px-2 py-1 text-xs font-medium text-neutral-600">
                    {ROLE_LABELS[member.role]}
                  </span>
                  <span className="text-xs text-neutral-500">{member.status}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <TenantControls tenant={tenant} />
    </>
  )
}
