import { and, eq } from 'drizzle-orm'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'

import { vehicleImages } from '@/db/schema'
import type * as schema from '@/db/schema'
import type { MediaProvider } from '@/lib/media/types'

type Database = PgDatabase<PgQueryResultHKT, typeof schema>

export interface MediaCandidate {
  readonly provider: string
  readonly assetId: string | null
}

export interface MediaCleanupSummary {
  destroyed: number
  failed: number
  skipped: number
  failures: { assetId: string; message: string }[]
}

export function emptyMediaSummary(): MediaCleanupSummary {
  return { destroyed: 0, failed: 0, skipped: 0, failures: [] }
}

/**
 * Destroy provider-owned assets that no remaining image row references.
 *
 * The reference check spans every tenant because a provider asset id is global
 * and duplicated vehicles intentionally share ids. Only rows whose provider
 * matches the active provider are candidates; seeded/external media is never
 * sent to the provider. Failures are recorded, never thrown.
 */
export async function cleanupUnreferencedMedia(
  db: Database,
  candidates: readonly MediaCandidate[],
  provider: MediaProvider | null,
): Promise<MediaCleanupSummary> {
  const summary = emptyMediaSummary()
  const seen = new Set<string>()

  if (!provider) {
    summary.skipped += candidates.length
    return summary
  }

  for (const candidate of candidates) {
    const assetId = candidate.assetId?.trim() ?? ''

    if (!assetId || candidate.provider !== provider.key) {
      summary.skipped += 1
      continue
    }

    const key = `${candidate.provider}:${assetId}`
    if (seen.has(key)) {
      summary.skipped += 1
      continue
    }
    seen.add(key)

    const remaining = await db
      .select({ id: vehicleImages.id })
      .from(vehicleImages)
      .where(
        and(
          eq(vehicleImages.provider, candidate.provider),
          eq(vehicleImages.providerAssetId, assetId),
        ),
      )
      .limit(1)

    if (remaining.length > 0) {
      summary.skipped += 1
      continue
    }

    try {
      await provider.destroy(assetId)
      summary.destroyed += 1
    } catch (error) {
      summary.failed += 1
      summary.failures.push({
        assetId,
        message: error instanceof Error ? error.message : 'Media cleanup failed.',
      })
    }
  }

  return summary
}
