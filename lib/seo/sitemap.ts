import type { MetadataRoute } from 'next'

import type { Vehicle } from '@/lib/types'

import { absoluteUrl } from './origin'

const PUBLIC_SITEMAP_STATUSES = new Set<Vehicle['availability']>([
  'available',
  'reserved',
  'sold',
])

/**
 * Build the tenant's sitemap entries.
 *
 * The caller supplies vehicles already scoped to one tenant; this function
 * additionally drops any non-public status defensively. Sold detail URLs are
 * intentionally included because the sold policy preserves acquired URLs and
 * their search value.
 */
export function buildSitemapEntries(
  origin: string,
  vehicles: readonly Vehicle[],
  now: Date = new Date(),
): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [
    {
      url: absoluteUrl('/', origin),
      lastModified: now,
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: absoluteUrl('/cars', origin),
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.8,
    },
  ]

  for (const vehicle of vehicles) {
    if (vehicle.publication !== 'published') continue
    if (!PUBLIC_SITEMAP_STATUSES.has(vehicle.availability)) continue

    const lastModified = new Date(vehicle.updatedAt)

    entries.push({
      url: absoluteUrl(`/cars/${encodeURIComponent(vehicle.slug)}`, origin),
      lastModified: Number.isNaN(lastModified.getTime()) ? now : lastModified,
      changeFrequency: 'weekly',
      priority: 0.8,
    })
  }

  return entries
}
