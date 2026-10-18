import { z } from 'zod'

/**
 * Shared, client-safe showroom settings contract.
 *
 * The admin form validates against this schema for immediate feedback and the
 * service re-parses the same shape before writing. It must stay free of
 * database and Node imports so it can run in the browser.
 */

export const DEFAULT_PRIMARY_COLOR = '#b88a44'
export const DEFAULT_SECONDARY_COLOR = '#171717'

export const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/
const PHONE_PATTERN = /^[+()\d\s-]*$/
const SOCIAL_HANDLE_PATTERN = /^@?[A-Za-z0-9._-]{1,100}$/
const DOMAIN_PATTERN = /^[\w-]+(?:\.[\w-]+)+(\/.*)?$/
const MEDIA_URL_PATTERN = /^(?:https?:\/\/|\/)/i
const HTTP_URL_PATTERN = /^https?:\/\//i
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type SocialPlatform = 'instagram' | 'tiktok' | 'facebook'

const SOCIAL_BASE_URLS: Record<SocialPlatform, string> = {
  instagram: 'https://instagram.com/',
  tiktok: 'https://tiktok.com/@',
  facebook: 'https://facebook.com/',
}

function boundedText(max: number) {
  return z
    .string()
    .trim()
    .max(max, `Maksimal ${max} karakter`)
    .default('')
}

function mediaUrl(max = 500) {
  return z
    .string()
    .trim()
    .max(max, `Maksimal ${max} karakter`)
    .refine(
      (value) => value === '' || MEDIA_URL_PATTERN.test(value),
      'URL harus diawali http://, https://, atau /',
    )
    .default('')
}

function httpUrl(max = 500) {
  return z
    .string()
    .trim()
    .max(max, `Maksimal ${max} karakter`)
    .refine(
      (value) => value === '' || HTTP_URL_PATTERN.test(value),
      'URL harus diawali http:// atau https://',
    )
    .default('')
}

function socialValue() {
  return z
    .string()
    .trim()
    .max(300, 'Maksimal 300 karakter')
    .refine(
      (value) =>
        value === '' ||
        HTTP_URL_PATTERN.test(value) ||
        SOCIAL_HANDLE_PATTERN.test(value) ||
        DOMAIN_PATTERN.test(value),
      'Masukkan URL atau nama pengguna',
    )
    .default('')
}

export const showroomSettingsInputSchema = z.object({
  displayName: z.string().trim().min(1, 'Nama showroom wajib diisi').max(120, 'Maksimal 120 karakter'),
  tagline: boundedText(160),
  description: boundedText(2000),
  logoUrl: mediaUrl(),
  heroImageUrl: mediaUrl(),
  primaryColor: z
    .string()
    .trim()
    .regex(HEX_COLOR_PATTERN, 'Gunakan format #RRGGBB')
    .default(DEFAULT_PRIMARY_COLOR),
  secondaryColor: z
    .string()
    .trim()
    .regex(HEX_COLOR_PATTERN, 'Gunakan format #RRGGBB')
    .default(DEFAULT_SECONDARY_COLOR),
  phone: boundedText(32).refine(
    (value) => value === '' || PHONE_PATTERN.test(value),
    'Nomor telepon hanya boleh berisi angka, spasi, +, -, dan tanda kurung',
  ),
  whatsapp: boundedText(32).refine(
    (value) => value === '' || PHONE_PATTERN.test(value),
    'Nomor WhatsApp hanya boleh berisi angka, spasi, +, -, dan tanda kurung',
  ),
  email: boundedText(254).refine(
    (value) => value === '' || EMAIL_PATTERN.test(value),
    'Email tidak valid',
  ),
  address: boundedText(200),
  city: boundedText(80),
  province: boundedText(80),
  postalCode: boundedText(16),
  googleMapsUrl: httpUrl(),
  instagramUrl: socialValue(),
  tiktokUrl: socialValue(),
  facebookUrl: socialValue(),
  openingHours: boundedText(200),
  seoTitle: boundedText(120),
  seoDescription: boundedText(200),
})

export type ShowroomSettingsInput = z.output<typeof showroomSettingsInputSchema>
export type ShowroomSettingsFormValues = ShowroomSettingsInput

/** Trim and convert an optional form value to the database null representation. */
export function emptyToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? ''
  return trimmed.length > 0 ? trimmed : null
}

/** Convert a stored nullable column to the empty-string form representation. */
export function nullToEmpty(value: string | null | undefined): string {
  return value ?? ''
}

/**
 * Normalize a social value to an absolute profile URL.
 *
 * Accepts a full URL, `@handle`, a bare handle, or a domain such as
 * `instagram.com/showroom`. Production stores the normalized URL so public
 * links are always valid.
 */
export function normalizeSocialUrl(value: string, platform: SocialPlatform): string {
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (HTTP_URL_PATTERN.test(trimmed)) return trimmed

  const base = SOCIAL_BASE_URLS[platform]

  if (trimmed.startsWith('@')) return `${base}${trimmed.slice(1)}`

  // A dotted handle (`primaauto.id`) is a handle, not a domain. Only expand a
  // bare domain when it names a social site or includes an explicit path.
  const knownSocialDomain = /^(?:www\.)?(?:instagram|tiktok|facebook)\.com(\/.*)?$/i.test(
    trimmed,
  )
  if (DOMAIN_PATTERN.test(trimmed) && (knownSocialDomain || trimmed.includes('/'))) {
    return `https://${trimmed.replace(/^\/+/, '')}`
  }

  return `${base}${trimmed.replace(/^\/+/, '')}`
}

/** Apply social URL normalization to a parsed settings payload. */
export function normalizeShowroomSettings(
  input: ShowroomSettingsInput,
): ShowroomSettingsInput {
  return {
    ...input,
    instagramUrl: normalizeSocialUrl(input.instagramUrl, 'instagram'),
    tiktokUrl: normalizeSocialUrl(input.tiktokUrl, 'tiktok'),
    facebookUrl: normalizeSocialUrl(input.facebookUrl, 'facebook'),
  }
}
