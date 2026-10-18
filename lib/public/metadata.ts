import type { Metadata } from 'next'

import type { Showroom } from '@/lib/types'

/**
 * Build public metadata from the tenant's stored SEO fields.
 *
 * Empty values fall back to the showroom identity so a tenant never ships a
 * blank title or description. Full canonical/OpenGraph/sitemap productionization
 * belongs to F011.
 */
export function showroomMetadata(showroom: Showroom): Metadata {
  const title = showroom.seo.title.trim() || showroom.name
  const description =
    showroom.seo.description.trim() ||
    showroom.description.trim() ||
    showroom.tagline.trim() ||
    undefined

  return {
    title,
    description,
    applicationName: showroom.name,
    icons: showroom.logoUrl
      ? {
          icon: showroom.logoUrl,
          apple: showroom.logoUrl,
        }
      : undefined,
  }
}
