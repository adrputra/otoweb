import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { PublicFooter } from '@/components/public-footer'
import { Filters, VehicleCard } from '@/components/showroom'
import { showroomMetadata } from '@/lib/public/metadata'
import { getShowroom, listVehicleBrands, listVehicles } from '@/lib/repositories'
import { showroomThemeStyle } from '@/lib/theme'

export const dynamic = 'force-dynamic'

export async function generateMetadata() {
  const showroom = await getShowroom()
  if (!showroom) return {}
  const base = showroomMetadata(showroom)
  return { ...base, title: `Koleksi mobil — ${showroom.name}` }
}

export default async function Cars({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const showroom = await getShowroom()
  if (!showroom) notFound()

  const [cars, brands] = await Promise.all([listVehicles(params), listVehicleBrands()])

  return (
    <main className="min-h-screen bg-[#faf9f7]" style={showroomThemeStyle(showroom.colors)}>
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 lg:px-8">
          <Link href="/" className="flex items-center gap-2.5 font-bold">
            {showroom.logoUrl && (
              <Image
                src={showroom.logoUrl}
                alt=""
                width={32}
                height={32}
                className="size-8 object-contain"
              />
            )}
            <span>{showroom.name}</span>
          </Link>
          <Link href="/" className="text-sm text-neutral-500">
            Kembali ke beranda
          </Link>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-5 py-12 lg:px-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--showroom-accent)]">
          Inventory
        </p>
        <div className="mt-3 flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <h1 className="text-4xl font-semibold tracking-tight">Koleksi mobil</h1>
          <form className="flex flex-wrap gap-2">
            <Filters count={cars.length} brands={brands} values={params} />
            <button className="h-11 bg-[var(--showroom-secondary)] px-4 text-sm font-semibold text-[color:var(--showroom-on-secondary)] transition hover:opacity-90">
              Terapkan
            </button>
          </form>
        </div>
        <div className="mt-10 grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
          {cars.map((car) => (
            <VehicleCard vehicle={car} key={car.id} />
          ))}
        </div>
        {!cars.length && (
          <div className="py-24 text-center">
            <h2 className="text-xl font-semibold">Belum ada unit yang sesuai</h2>
            <p className="mt-2 text-sm text-neutral-500">Coba ubah filter pencarian Anda.</p>
          </div>
        )}
      </div>
      <PublicFooter showroom={showroom} />
    </main>
  )
}
