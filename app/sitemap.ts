import type { MetadataRoute } from 'next'

import { getAppDatabase } from '@/lib/db/runtime'
import { listPublicVehicles } from '@/lib/public/queries'
import { resolvePublicTenant } from '@/lib/public/tenant'
import { getRequestOrigin } from '@/lib/seo/origin'
import { buildSitemapEntries } from '@/lib/seo/sitemap'

export const dynamic = 'force-dynamic'

/**
 * Tenant-specific sitemap.
 *
 * The request hostname resolves the tenant, so the same deployment returns a
 * distinct XML document per showroom. An unresolved hostname exposes no URLs.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const tenant = await resolvePublicTenant()
  if (!tenant) return []

  const [origin, db] = await Promise.all([getRequestOrigin(), getAppDatabase()])
  const vehicles = await listPublicVehicles(db, tenant.id)

  return buildSitemapEntries(origin, vehicles)
}
