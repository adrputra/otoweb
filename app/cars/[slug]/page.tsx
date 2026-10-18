import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, ArrowRight, Check, MapPin } from 'lucide-react'

import { VehicleViewTracker } from '@/components/analytics/page-trackers'
import { VehicleShareButton } from '@/components/analytics/vehicle-share-button'
import { PublicFooter } from '@/components/public-footer'
import { JsonLd } from '@/components/seo/json-ld'
import { VehicleCard } from '@/components/showroom'
import { formatDate, formatKm, formatRupiah } from '@/lib/format'
import { vehicleMetadata } from '@/lib/public/metadata'
import { getRelatedVehicles, getShowroom, getVehicleBySlug } from '@/lib/repositories'
import { getRequestOrigin } from '@/lib/seo/origin'
import { buildVehicleStructuredData } from '@/lib/seo/structured-data'
import { showroomThemeStyle } from '@/lib/theme'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const [showroom, vehicle] = await Promise.all([getShowroom(), getVehicleBySlug(slug)])
  // Resolve the 404 before the streamed shell is sent so an unknown or
  // cross-tenant slug returns a real 404 status, not a 200 error fallback.
  if (!showroom || !vehicle) notFound()

  const origin = await getRequestOrigin()
  return vehicleMetadata(vehicle, showroom, origin)
}

export default async function Detail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const [showroom, origin] = await Promise.all([getShowroom(), getRequestOrigin()])
  if (!showroom) notFound()

  const vehicle = await getVehicleBySlug(slug)
  if (!vehicle) notFound()

  const related = await getRelatedVehicles(vehicle.id, vehicle.bodyType)
  const sold = vehicle.availability === 'sold'

  return (
    <main className="min-h-screen bg-[#faf9f7]" style={showroomThemeStyle(showroom.colors)}>
      <VehicleViewTracker vehicleSlug={vehicle.slug} />
      <JsonLd data={buildVehicleStructuredData(vehicle, showroom, origin)} />
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 lg:px-8">
          <Link href="/cars" className="flex items-center gap-2 text-sm font-semibold">
            <ArrowLeft className="size-4" /> Kembali ke koleksi
          </Link>
          <Link href="/" className="flex items-center gap-2 font-bold">
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
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-5 py-10 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[1.15fr_.85fr]">
          <div>
            <div className="relative aspect-[4/3] overflow-hidden bg-neutral-200">
              <Image
                src={vehicle.images[0].url}
                alt={vehicle.images[0].alt}
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 60vw"
                className="object-cover"
              />
              <span className="absolute left-4 top-4 bg-neutral-950 px-3 py-1.5 text-xs font-semibold text-white">
                {sold ? 'Terjual' : vehicle.availability === 'reserved' ? 'Dipesan' : 'Tersedia'}
              </span>
            </div>
          </div>
          <div className="flex flex-col justify-center">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--showroom-accent)]">
              {vehicle.brand}
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight">{vehicle.model}</h1>
            <p className="mt-2 text-lg text-neutral-500">{vehicle.variant}</p>
            <p className="mt-7 text-3xl font-bold">{formatRupiah(vehicle.price)}</p>
            <p className="mt-2 text-sm text-neutral-500">
              {vehicle.originalPrice && (
                <span className="mr-2 line-through">{formatRupiah(vehicle.originalPrice)}</span>
              )}{' '}
              Harga terbaik, transparan.
            </p>
            <a
              href={`/api/public/whatsapp?vehicle=${encodeURIComponent(vehicle.slug)}`}
              target="_blank"
              rel="noreferrer"
              className="mt-8 flex h-14 items-center justify-center bg-[#25D366] font-semibold text-white"
            >
              {sold ? 'Tanya mobil serupa' : 'Tanya via WhatsApp'} <ArrowRight className="ml-2 size-5" />
            </a>
            <VehicleShareButton
              vehicleSlug={vehicle.slug}
              title={`${vehicle.brand} ${vehicle.model} ${vehicle.variant}`}
            />
          </div>
        </div>
        <section className="mt-16 border-t border-neutral-200 pt-12">
          <h2 className="text-xl font-semibold">Spesifikasi kendaraan</h2>
          <div className="mt-6 grid grid-cols-2 gap-px bg-neutral-200 sm:grid-cols-4">
            {[
              ['Tahun', String(vehicle.year)],
              ['Kilometer', formatKm(vehicle.mileageKm)],
              ['Transmisi', vehicle.transmission],
              ['Bahan bakar', vehicle.fuel],
              ['Warna', vehicle.color],
              ['Pajak sampai', formatDate(vehicle.taxExpiry)],
              ['Kepemilikan', `${vehicle.ownerCount} tangan`],
              ['Plat nomor', vehicle.plateRegion],
            ].map(([label, value]) => (
              <div key={label} className="bg-white p-4">
                <p className="text-xs text-neutral-500">{label}</p>
                <p className="mt-2 text-sm font-semibold capitalize">{value}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 grid gap-10 lg:grid-cols-2">
            <div>
              <h3 className="font-semibold">Fitur unggulan</h3>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {vehicle.features.map((feature) => (
                  <li key={feature} className="flex gap-2 text-sm">
                    <Check className="size-4 text-[color:var(--showroom-accent)]" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="font-semibold">Tentang unit ini</h3>
              <p className="mt-4 text-sm leading-7 text-neutral-600">{vehicle.description}</p>
              <p className="mt-5 flex gap-2 text-sm text-neutral-600">
                <MapPin className="size-4 text-[color:var(--showroom-accent)]" /> {vehicle.location}
              </p>
            </div>
          </div>
        </section>
        {related.length > 0 && (
          <section className="mt-16 border-t border-neutral-200 pt-12">
            <h2 className="text-xl font-semibold">Mungkin Anda juga suka</h2>
            <div className="mt-8 grid gap-8 sm:grid-cols-3">
              {related.map((car) => (
                <VehicleCard key={car.id} vehicle={car} />
              ))}
            </div>
          </section>
        )}
      </div>
      <PublicFooter showroom={showroom} />
    </main>
  )
}
