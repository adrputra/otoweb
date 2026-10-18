import Link from 'next/link'

import { PageHeader } from '@/components/admin-shell'
import { formatConversionPercent } from '@/lib/analytics/format'
import { getAdminAnalyticsSummary } from '@/lib/admin/analytics-queries'
import { requireAdminTenantContext } from '@/lib/admin/context'
import { listAdminLeads } from '@/lib/admin/lead-queries'
import { getAdminVehicleStats, listAdminVehicles } from '@/lib/admin/vehicle-queries'
import { formatDate, formatRupiah } from '@/lib/format'
import { LEAD_STATUS_LABELS } from '@/lib/validation/lead'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const { context, db } = await requireAdminTenantContext('view')
  const [stats, vehicles, recentLeads, analytics] = await Promise.all([
    getAdminVehicleStats(db, context.tenant.id),
    listAdminVehicles(db, context.tenant.id),
    listAdminLeads(db, context.tenant.id),
    getAdminAnalyticsSummary(db, context.tenant.id),
  ])

  const cards = [
    ['Tersedia', stats.available, 'unit'],
    ['Dipesan', stats.reserved, 'unit'],
    ['Terjual', stats.sold, 'unit'],
    ['Lead baru', analytics.newLeads, 'orang'],
  ] as const

  const analyticsCards = [
    ['Kunjungan unit', analytics.vehicleViews, 'kali', 'analytics-vehicle-views'],
    ['Klik WhatsApp', analytics.whatsappClicks, 'klik', 'analytics-whatsapp-clicks'],
    ['Lead baru', analytics.newLeads, 'orang', 'analytics-new-leads'],
    ['Konversi', formatConversionPercent(analytics.conversionPercent), 'lead / kunjungan', 'analytics-conversion'],
  ] as const

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Ringkasan aktivitas showroom hari ini."
      />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map(([label, value, unit]) => (
          <div key={label} className="border border-neutral-200 bg-white p-4">
            <p className="text-sm text-neutral-500">{label}</p>
            <p className="mt-3 text-2xl font-bold">{value}</p>
            <p className="mt-1 text-xs text-neutral-400">{unit}</p>
          </div>
        ))}
      </div>

      <section className="mt-8" aria-labelledby="analytics-heading">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="analytics-heading" className="text-lg font-semibold tracking-tight">
              Analitik
            </h2>
            <p className="mt-1 max-w-xl text-sm text-neutral-500">
              Kunjungan unit dan minat pengunjung. Konversi dihitung dari lead baru
              dibagi kunjungan unit.
            </p>
          </div>
          <span className="w-fit border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-900">
            Semua waktu
          </span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {analyticsCards.map(([label, value, unit, testId]) => (
            <div key={label} className="border border-neutral-200 bg-white p-4">
              <p className="text-sm text-neutral-500">{label}</p>
              <p data-testid={testId} className="mt-3 text-2xl font-bold tabular-nums">
                {value}
              </p>
              <p className="mt-1 text-xs text-neutral-400">{unit}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 border border-neutral-200 bg-white">
          <div className="flex items-center justify-between border-b border-neutral-100 p-5">
            <h3 className="font-semibold">Paling banyak dilihat</h3>
            <span className="text-xs text-neutral-400">5 teratas</span>
          </div>
          <div data-testid="analytics-most-viewed" className="divide-y divide-neutral-100">
            {analytics.mostViewedVehicles.length === 0 && (
              <p className="p-5 text-sm text-neutral-500">
                Belum ada kunjungan unit. Data muncul setelah pengunjung membuka
                halaman detail kendaraan.
              </p>
            )}
            {analytics.mostViewedVehicles.map((vehicle, index) => (
              <Link
                key={vehicle.vehicleId}
                href={`/cars/${vehicle.slug}`}
                className="flex items-center gap-4 p-4 transition hover:bg-neutral-50"
              >
                <span className="w-5 text-xs font-semibold tabular-nums text-neutral-400">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                  {vehicle.label}
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-sm font-semibold tabular-nums">
                    {vehicle.views}
                  </span>
                  <span className="block text-[11px] text-neutral-400">
                    kunjungan
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <div className="mt-8 grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <section className="border border-neutral-200 bg-white">
          <div className="flex items-center justify-between border-b border-neutral-100 p-5">
            <h2 className="font-semibold">Kendaraan terbaru</h2>
            <Link
              href="/admin/vehicles"
              className="text-xs font-semibold underline"
            >
              Lihat semua
            </Link>
          </div>
          <div className="divide-y divide-neutral-100">
            {vehicles.slice(0, 5).map((vehicle) => (
              <Link
                href={
                  vehicle.publication === 'published'
                    ? `/cars/${vehicle.slug}`
                    : `/admin/vehicles/${vehicle.id}/edit`
                }
                key={vehicle.id}
                className="flex items-center justify-between gap-4 p-4 hover:bg-neutral-50"
              >
                <div>
                  <p className="text-sm font-semibold">
                    {vehicle.brand} {vehicle.model}
                  </p>
                  <p className="mt-1 text-xs text-neutral-500">
                    {vehicle.year} · {vehicle.variant}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">
                    {formatRupiah(vehicle.price)}
                  </p>
                  <p className="mt-1 text-xs text-neutral-400">
                    {vehicle.publication}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
        <section className="border border-neutral-200 bg-white">
          <div className="flex items-center justify-between border-b border-neutral-100 p-5">
            <h2 className="font-semibold">Lead terbaru</h2>
            <Link href="/admin/leads" className="text-xs font-semibold underline">
              Kelola lead
            </Link>
          </div>
          <div className="divide-y divide-neutral-100">
            {recentLeads.length === 0 && (
              <p className="p-4 text-sm text-neutral-500">
                Belum ada lead masuk. Lead dari formulir kontak dan WhatsApp akan
                muncul di sini.
              </p>
            )}
            {recentLeads.slice(0, 5).map((lead) => (
              <div
                key={lead.id}
                className="flex items-center justify-between gap-3 p-4"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold">
                    {lead.name || 'Tanpa nama'}
                  </p>
                  <p className="mt-1 line-clamp-1 text-xs text-neutral-500">
                    {lead.message}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <span className="text-xs font-medium text-neutral-500">
                    {LEAD_STATUS_LABELS[lead.status]}
                  </span>
                  <p className="mt-1 text-[11px] text-neutral-400">
                    {formatDate(lead.createdAt)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  )
}
