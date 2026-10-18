import type { MetadataRoute } from 'next'

import { resolvePublicTenant } from '@/lib/public/tenant'
import { getRequestOrigin } from '@/lib/seo/origin'

export const dynamic = 'force-dynamic'

const PRIVATE_PATHS = [
  '/admin/',
  '/api/',
  '/auth/',
  '/login',
  '/forgot-password',
  '/reset-password',
]

/**
 * Tenant-specific robots.txt.
 *
 * A resolved tenant allows its public pages and advertises its own sitemap. An
 * unresolved hostname denies crawling and reveals no sitemap.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const tenant = await resolvePublicTenant()
  if (!tenant) {
    return {
      rules: {
        userAgent: '*',
        disallow: '/',
      },
    }
  }

  const origin = await getRequestOrigin()

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: PRIVATE_PATHS,
    },
    sitemap: `${origin}/sitemap.xml`,
  }
}
