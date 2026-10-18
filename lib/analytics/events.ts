import type { AnalyticsEventMetadata } from '@/db/schema'

export const ANALYTICS_EVENT_TYPES = [
  'vehicle_view',
  'inventory_search',
  'filter_use',
  'whatsapp_click',
  'contact_submit',
  'vehicle_share',
] as const

export type AnalyticsEventType = (typeof ANALYTICS_EVENT_TYPES)[number]

/** Events a browser may submit through the public beacon. */
export const PUBLIC_ANALYTICS_EVENT_TYPES = [
  'vehicle_view',
  'inventory_search',
  'filter_use',
  'vehicle_share',
] as const

export type PublicAnalyticsEventType = (typeof PUBLIC_ANALYTICS_EVENT_TYPES)[number]

/** Events emitted only by server code after a lead write succeeds. */
export const SERVER_ANALYTICS_EVENT_TYPES = ['whatsapp_click', 'contact_submit'] as const

/** Query keys the public inventory surface understands. */
export const INVENTORY_QUERY_KEYS = [
  'brand',
  'model',
  'transmission',
  'fuel',
  'year',
  'minPrice',
  'maxPrice',
  'maxMileage',
  'sort',
] as const

/**
 * Filter keys tracked as `filter_use`. `sort` is a search control rather than a
 * filter, so changing only the order still counts as an inventory search but
 * not as filter use.
 */
export const FILTER_QUERY_KEYS = [
  'brand',
  'model',
  'transmission',
  'fuel',
  'year',
  'minPrice',
  'maxPrice',
  'maxMileage',
] as const

const INVENTORY_KEY_SET = new Set<string>(INVENTORY_QUERY_KEYS)
const EVENT_TYPE_SET = new Set<string>(ANALYTICS_EVENT_TYPES)
const PUBLIC_EVENT_TYPE_SET = new Set<string>(PUBLIC_ANALYTICS_EVENT_TYPES)

export const MAX_ANALYTICS_BODY_BYTES = 4_096
export const MAX_ANALYTICS_PATH_LENGTH = 512
export const MAX_ANALYTICS_SLUG_LENGTH = 200
export const MAX_ANALYTICS_KEY_LENGTH = 32
export const MAX_ANALYTICS_VALUE_LENGTH = 64
export const MAX_ANALYTICS_FILTERS = 10

export type AnalyticsSearchParams = Record<string, string | string[] | undefined>

export interface NormalizedAnalyticsEvent {
  eventType: AnalyticsEventType
  vehicleSlug?: string
  path?: string
  metadata: AnalyticsEventMetadata
}

export function isAnalyticsEventType(value: unknown): value is AnalyticsEventType {
  return typeof value === 'string' && EVENT_TYPE_SET.has(value)
}

export function isPublicAnalyticsEventType(
  value: unknown,
): value is PublicAnalyticsEventType {
  return typeof value === 'string' && PUBLIC_EVENT_TYPE_SET.has(value)
}

function normalizedString(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > maxLength) return undefined
  return trimmed
}

/** Keep only same-origin path names; query strings and fragments are discarded. */
export function normalizeAnalyticsPath(value: unknown): string | undefined {
  const raw = normalizedString(value, MAX_ANALYTICS_PATH_LENGTH)
  if (!raw || !raw.startsWith('/')) return undefined
  return raw.split(/[?#]/, 1)[0]
}

export function normalizeVehicleSlug(value: unknown): string | undefined {
  return normalizedString(value, MAX_ANALYTICS_SLUG_LENGTH)
}

/**
 * Reduce an arbitrary filter object to the supported inventory keys with
 * bounded string values. Unknown keys are dropped rather than persisted.
 */
export function normalizeAnalyticsFilters(
  value: unknown,
): Record<string, string> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined

  const entries: Array<[string, string]> = []
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (entries.length >= MAX_ANALYTICS_FILTERS) break
    if (!INVENTORY_KEY_SET.has(key)) continue
    if (typeof raw !== 'string' && typeof raw !== 'number') continue
    const stringValue = String(raw).trim()
    if (!stringValue || stringValue.length > MAX_ANALYTICS_VALUE_LENGTH) continue
    if (key.length > MAX_ANALYTICS_KEY_LENGTH) continue
    entries.push([key, stringValue])
  }

  return entries.length > 0 ? Object.fromEntries(entries) : undefined
}

export function normalizeShareMethod(value: unknown): 'native' | 'clipboard' | undefined {
  return value === 'native' || value === 'clipboard' ? value : undefined
}

function firstSearchValue(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value
  if (typeof raw !== 'string') return undefined
  const trimmed = raw.trim()
  return trimmed ? trimmed : undefined
}

/** Recognized, non-empty inventory query values from Next.js search params. */
export function filtersFromSearchParams(
  params: AnalyticsSearchParams = {},
): Record<string, string> {
  const entries: Array<[string, string]> = []

  for (const key of INVENTORY_QUERY_KEYS) {
    const value = firstSearchValue(params[key])
    if (!value || value.length > MAX_ANALYTICS_VALUE_LENGTH) continue
    entries.push([key, value])
  }

  return Object.fromEntries(entries)
}

export function hasInventorySearch(params: AnalyticsSearchParams = {}): boolean {
  return Object.keys(filtersFromSearchParams(params)).length > 0
}

export function hasFilterUse(params: AnalyticsSearchParams = {}): boolean {
  return FILTER_QUERY_KEYS.some((key) => Boolean(firstSearchValue(params[key])))
}

/**
 * Validate and normalize a public beacon payload. Returns `null` for anything
 * that is not a supported public event so callers can drop it quietly.
 */
export function normalizeAnalyticsEvent(
  input: unknown,
  options: { publicOnly?: boolean } = {},
): NormalizedAnalyticsEvent | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null

  const payload = input as Record<string, unknown>
  const event = payload.event
  if (!isAnalyticsEventType(event)) return null
  if (options.publicOnly && !isPublicAnalyticsEventType(event)) return null

  const vehicleSlug = normalizeVehicleSlug(payload.vehicleSlug)
  const path = normalizeAnalyticsPath(payload.path)
  const metadata: AnalyticsEventMetadata = {}

  if (vehicleSlug && event !== 'inventory_search' && event !== 'filter_use') {
    // WhatsApp clicks carry the slug as metadata because the vehicle id is the
    // authoritative link. Public events use it only for lookup.
    if (event === 'whatsapp_click') metadata.vehicleSlug = vehicleSlug
  }

  if (event === 'inventory_search' || event === 'filter_use') {
    const filters = normalizeAnalyticsFilters(payload.filters)
    if (filters) metadata.filters = filters
  }

  if (event === 'vehicle_share') {
    const method = normalizeShareMethod(payload.method)
    if (method) metadata.method = method
  }

  return { eventType: event, vehicleSlug, path, metadata }
}
