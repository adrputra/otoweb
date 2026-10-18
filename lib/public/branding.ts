import { getShowroom } from '@/lib/repositories'

/** Neutral platform identity used when no showroom can be resolved. */
export const NEUTRAL_PLATFORM_BRAND = 'OtoWeb'

/**
 * Resolve the showroom identity for shared auth screens.
 *
 * Auth pages are reachable on every tenant host. They must show the current
 * showroom's name rather than a hard-coded tenant, but they must also render
 * when the database is unavailable. Every failure therefore falls back to the
 * neutral platform identity instead of throwing.
 */
export async function resolveAuthBrandName(): Promise<string> {
  try {
    const showroom = await getShowroom()
    const name = showroom?.name?.trim()
    return name || NEUTRAL_PLATFORM_BRAND
  } catch {
    return NEUTRAL_PLATFORM_BRAND
  }
}
