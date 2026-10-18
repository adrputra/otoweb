import type { Metadata } from 'next'

import type { Showroom, Vehicle } from '@/lib/types'

import { absoluteUrl } from './origin'

export const DESCRIPTION_LIMIT = 160

export interface PageMetadataOptions {
  origin: string
  path: string
  title: string
  description: string
  siteName: string
  image?: string
}

/** Collapse whitespace and truncate an SEO description to a stable length. */
export function truncateDescription(value: string, limit = DESCRIPTION_LIMIT): string {
  const collapsed = value.replace(/\s+/g, ' ').trim()
  if (collapsed.length <= limit) return collapsed
  return `${collapsed.slice(0, Math.max(0, limit - 1)).trimEnd()}…`
}

function nonEmpty(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

function showroomDescription(showroom: Showroom): string {
  return (
    nonEmpty(showroom.seo.description) ??
    nonEmpty(showroom.description) ??
    nonEmpty(showroom.tagline) ??
    `Showroom mobil bekas ${showroom.name}.`
  )
}

function showroomImage(showroom: Showroom): string {
  return showroom.logoUrl || showroom.heroImageUrl
}

function pageMetadata({
  origin,
  path,
  title,
  description,
  siteName,
  image,
}: PageMetadataOptions): Metadata {
  const imageUrl = image ? absoluteUrl(image, origin) : undefined

  return {
    metadataBase: new URL(origin),
    title,
    description,
    alternates: {
      canonical: path,
    },
    openGraph: {
      type: 'website',
      locale: 'id_ID',
      url: path,
      siteName,
      title,
      description,
      images: imageUrl
        ? [
            {
              url: imageUrl,
              alt: title,
            },
          ]
        : undefined,
    },
    robots: {
      index: true,
      follow: true,
    },
  }
}

/** Home metadata derived from the tenant's stored SEO fields. */
export function showroomMetadata(
  showroom: Showroom,
  options: { origin?: string; path?: string } = {},
): Metadata {
  const origin = options.origin ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  const path = options.path ?? '/'
  const title = nonEmpty(showroom.seo.title) ?? showroom.name
  const description = truncateDescription(showroomDescription(showroom))
  const metadata = pageMetadata({
    origin,
    path,
    title,
    description,
    siteName: showroom.name,
    image: showroomImage(showroom),
  })

  return {
    ...metadata,
    applicationName: showroom.name,
    icons: showroom.logoUrl
      ? {
          icon: showroom.logoUrl,
          apple: showroom.logoUrl,
        }
      : undefined,
  }
}

/** Inventory metadata; the canonical path intentionally drops filters. */
export function inventoryMetadata(showroom: Showroom, origin: string): Metadata {
  const title = `Koleksi mobil — ${showroom.name}`
  const description = truncateDescription(
    `Koleksi mobil bekas pilihan di ${showroom.name}. ${showroomDescription(showroom)}`,
  )
  return pageMetadata({
    origin,
    path: '/cars',
    title,
    description,
    siteName: showroom.name,
    image: showroomImage(showroom),
  })
}

/** Roadmap vehicle title pattern: Brand Model Variant Year Bekas Location | Showroom. */
export function vehicleTitle(vehicle: Vehicle, showroom: Showroom): string {
  const name = [vehicle.brand, vehicle.model, vehicle.variant].filter(Boolean).join(' ')
  return `${name} ${vehicle.year} Bekas ${vehicle.location} | ${showroom.name}`
}

/** Vehicle detail metadata with a self-canonical URL and cover OpenGraph image. */
export function vehicleMetadata(
  vehicle: Vehicle,
  showroom: Showroom,
  origin: string,
): Metadata {
  const title = vehicleTitle(vehicle, showroom)
  const description = truncateDescription(vehicle.description)
  return pageMetadata({
    origin,
    path: `/cars/${encodeURIComponent(vehicle.slug)}`,
    title,
    description,
    siteName: showroom.name,
    image: vehicle.images[0]?.url,
  })
}
