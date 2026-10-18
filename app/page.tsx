import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowRight, Check, Mail, MapPin, Phone } from 'lucide-react'

import { PublicContactForm } from '@/components/public-contact-form'
import { PublicFooter } from '@/components/public-footer'
import { JsonLd } from '@/components/seo/json-ld'
import { Header, QuickSearch, VehicleCard } from '@/components/showroom'
import { showroomMetadata } from '@/lib/public/metadata'
import { getShowroom, listFeaturedVehicles, listVehicleBrands } from '@/lib/repositories'
import { getRequestOrigin } from '@/lib/seo/origin'
import { buildShowroomStructuredData } from '@/lib/seo/structured-data'
import { showroomThemeStyle } from '@/lib/theme'

export const dynamic = 'force-dynamic'

export async function generateMetadata() {
  const showroom = await getShowroom()
  if (!showroom) notFound()

  const origin = await getRequestOrigin()
  return showroomMetadata(showroom, { origin, path: '/' })
}

export default async function Page() {
  const [showroom, origin] = await Promise.all([getShowroom(), getRequestOrigin()])
  if (!showroom) notFound()

  const [cars, brands] = await Promise.all([listFeaturedVehicles(), listVehicleBrands()])
  return (
    <main style={showroomThemeStyle(showroom.colors)}>
      <JsonLd data={buildShowroomStructuredData(showroom, origin)} />
      <section className="relative min-h-[680px] overflow-hidden bg-neutral-950 text-white">
        <Image
          src={showroom.heroImageUrl}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover opacity-55"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/45 to-black/10" />
        <Header showroom={showroom} />
        <div className="relative mx-auto flex max-w-7xl flex-col justify-center px-5 pb-28 pt-48 lg:px-8">
          <p className="mb-5 text-xs font-semibold uppercase tracking-[0.24em] text-[color:var(--showroom-primary-soft)]">
            {showroom.tagline}
          </p>
          <h1 className="max-w-2xl whitespace-pre-line text-5xl font-semibold leading-[1.04] tracking-tight sm:text-7xl">
            {showroom.hero.headline}
          </h1>
          <p className="mt-6 max-w-md text-base leading-7 text-white/75">
            {showroom.hero.subheadline}
          </p>
          <div className="mt-10 max-w-2xl">
            <QuickSearch brands={brands} />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-20 lg:px-8">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--showroom-accent)]">
              Koleksi pilihan
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              Unit unggulan kami
            </h2>
          </div>
          <Link href="/cars" className="hidden items-center gap-2 text-sm font-semibold md:flex">
            Lihat semua <ArrowRight className="size-4" />
          </Link>
        </div>
        <div className="mt-10 grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
          {cars.map((car) => (
            <VehicleCard vehicle={car} key={car.id} />
          ))}
        </div>
        <Link
          href="/cars"
          className="mt-10 flex items-center justify-center gap-2 border-b border-neutral-300 pb-2 text-sm font-semibold md:hidden"
        >
          Lihat semua koleksi <ArrowRight className="size-4" />
        </Link>
      </section>

      <section id="about" className="bg-[#f4f1ec]">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 py-20 lg:grid-cols-2 lg:items-center lg:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--showroom-accent)]">
              Mengapa {showroom.name}
            </p>
            <h2 className="mt-3 max-w-md text-3xl font-semibold tracking-tight sm:text-4xl">
              Lebih dari sekadar membeli mobil.
            </h2>
            <p className="mt-5 max-w-lg leading-7 text-neutral-600">{showroom.description}</p>
            <div className="mt-8 grid gap-5 sm:grid-cols-2">
              {['Inspeksi 120 titik', 'Dokumen terjamin', 'Harga transparan', 'Bantuan purna jual'].map(
                (item) => (
                  <div key={item} className="flex gap-3 text-sm font-medium">
                    <Check className="size-5 text-[color:var(--showroom-accent)]" />
                    {item}
                  </div>
                ),
              )}
            </div>
          </div>
          <div className="relative aspect-[4/3] overflow-hidden">
            <Image
              src="https://images.unsplash.com/photo-1560958089-b8a1929cea89?auto=format&fit=crop&w=1200&q=85"
              alt={`Mobil di showroom ${showroom.name}`}
              fill
              sizes="(max-width: 1024px) 90vw, 50vw"
              className="object-cover"
            />
          </div>
        </div>
      </section>

      <section
        id="contact"
        className="mx-auto grid max-w-7xl gap-10 px-5 py-20 lg:grid-cols-2 lg:px-8"
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--showroom-accent)]">
            Datang langsung
          </p>
          <h2 className="mt-3 text-3xl font-semibold">Lihat unit pilihan Anda.</h2>
          <div className="mt-8 flex flex-col gap-5 text-sm">
            <p className="flex gap-3">
              <MapPin className="size-5 shrink-0 text-[color:var(--showroom-accent)]" />
              <span>
                {showroom.address.street}
                {showroom.address.street && <br />}
                {[
                  showroom.address.city,
                  showroom.address.province,
                  showroom.address.postalCode,
                ]
                  .filter(Boolean)
                  .join(', ')}
              </span>
            </p>
            {showroom.contact.phone && (
              <p className="flex gap-3">
                <Phone className="size-5 shrink-0 text-[color:var(--showroom-accent)]" />
                <a href={`tel:${showroom.contact.phone.replace(/[^\d+]/g, '')}`}>
                  {showroom.contact.phone}
                </a>
              </p>
            )}
            {showroom.contact.email && (
              <p className="flex gap-3">
                <Mail className="size-5 shrink-0 text-[color:var(--showroom-accent)]" />
                <a href={`mailto:${showroom.contact.email}`}>{showroom.contact.email}</a>
              </p>
            )}
            {showroom.address.openingHours && (
              <p className="pl-8 text-neutral-600">{showroom.address.openingHours}</p>
            )}
          </div>
          {showroom.address.mapUrl && (
            <a
              href={showroom.address.mapUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-8 inline-flex border-b border-neutral-950 pb-1 text-sm font-semibold"
            >
              Buka Google Maps <ArrowRight className="ml-2 size-4" />
            </a>
          )}
        </div>
        <PublicContactForm />
      </section>

      <PublicFooter showroom={showroom} />
    </main>
  )
}
