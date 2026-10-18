import type { Availability, Showroom, Vehicle } from '@/lib/types'

import { absoluteUrl } from './origin'

export type JsonLdObject = Record<string, unknown>

const AVAILABILITY_BY_STATUS: Record<Availability, string> = {
  available: 'https://schema.org/InStock',
  reserved: 'https://schema.org/PreOrder',
  sold: 'https://schema.org/SoldOut',
}

/** Schema.org availability URL for a stored public vehicle status. */
export function vehicleAvailability(status: Availability): string {
  return AVAILABILITY_BY_STATUS[status]
}

function nonEmpty(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

function showroomImage(showroom: Showroom, origin: string): string {
  return absoluteUrl(showroom.logoUrl || showroom.heroImageUrl, origin)
}

function showroomAddress(showroom: Showroom): JsonLdObject | undefined {
  const streetAddress = nonEmpty(showroom.address.street)
  const addressLocality = nonEmpty(showroom.address.city)
  const addressRegion = nonEmpty(showroom.address.province)
  const postalCode = nonEmpty(showroom.address.postalCode)

  if (!streetAddress && !addressLocality && !addressRegion && !postalCode) {
    return undefined
  }

  return {
    '@type': 'PostalAddress',
    ...(streetAddress ? { streetAddress } : {}),
    ...(addressLocality ? { addressLocality } : {}),
    ...(addressRegion ? { addressRegion } : {}),
    ...(postalCode ? { postalCode } : {}),
    addressCountry: 'ID',
  }
}

/** JSON-LD for the tenant showroom as a local auto dealer. */
export function buildShowroomStructuredData(
  showroom: Showroom,
  origin: string,
): JsonLdObject {
  const address = showroomAddress(showroom)
  const socialLinks = Object.values(showroom.social).filter(
    (value): value is string => typeof value === 'string' && value.trim().length > 0,
  )
  const telephone = nonEmpty(showroom.contact.phone) ?? nonEmpty(showroom.contact.whatsapp)
  const email = nonEmpty(showroom.contact.email)
  const logo = nonEmpty(showroom.logoUrl)
  const image = showroomImage(showroom, origin)
  const url = absoluteUrl('/', origin)

  return {
    '@context': 'https://schema.org',
    '@type': ['LocalBusiness', 'AutoDealer'],
    '@id': `${url}#showroom`,
    name: showroom.name,
    url,
    ...(telephone ? { telephone } : {}),
    ...(email ? { email } : {}),
    image,
    ...(logo ? { logo: absoluteUrl(logo, origin) } : {}),
    ...(address ? { address } : {}),
    ...(socialLinks.length > 0 ? { sameAs: socialLinks } : {}),
  }
}

/** JSON-LD for a public vehicle and its current offer. */
export function buildVehicleStructuredData(
  vehicle: Vehicle,
  showroom: Showroom,
  origin: string,
): JsonLdObject {
  const url = absoluteUrl(`/cars/${encodeURIComponent(vehicle.slug)}`, origin)
  const image = absoluteUrl(vehicle.images[0]?.url ?? '', origin)
  const name = [vehicle.brand, vehicle.model, vehicle.variant].filter(Boolean).join(' ')

  return {
    '@context': 'https://schema.org',
    '@type': 'Vehicle',
    '@id': url,
    url,
    name,
    brand: {
      '@type': 'Brand',
      name: vehicle.brand,
    },
    model: vehicle.model,
    vehicleConfiguration: vehicle.variant,
    vehicleModelDate: String(vehicle.year),
    bodyType: vehicle.bodyType,
    vehicleTransmission: vehicle.transmission,
    fuelType: vehicle.fuel,
    color: vehicle.color,
    mileageFromOdometer: {
      '@type': 'QuantitativeValue',
      value: vehicle.mileageKm,
      unitCode: 'KMT',
    },
    image: [image],
    itemCondition: 'https://schema.org/UsedCondition',
    offers: {
      '@type': 'Offer',
      url,
      price: vehicle.price,
      priceCurrency: 'IDR',
      availability: vehicleAvailability(vehicle.availability),
      itemCondition: 'https://schema.org/UsedCondition',
      seller: {
        '@type': 'AutoDealer',
        name: showroom.name,
        url: absoluteUrl('/', origin),
      },
    },
  }
}

/**
 * Serialize JSON-LD for a `<script>` element.
 *
 * Escaping `<`, `>`, `&`, and the Unicode line separators keeps stored text from
 * closing the script element or breaking the JSON payload while preserving a
 * valid JSON document.
 */
export function serializeJsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}
