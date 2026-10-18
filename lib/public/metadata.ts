/**
 * Public metadata facade.
 *
 * The implementation lives in `lib/seo/metadata.ts` so the SEO builders are
 * shared by pages, sitemap/robots, and structured data. This module keeps the
 * existing import path stable for the public routes and tests.
 */
export {
  DESCRIPTION_LIMIT,
  inventoryMetadata,
  showroomMetadata,
  truncateDescription,
  vehicleMetadata,
  vehicleTitle,
} from '@/lib/seo/metadata'
