import { headers } from 'next/headers'

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:'])
const DEFAULT_ORIGIN = 'http://localhost:3000'

export interface RequestOriginInput {
  host?: string | null
  forwardedHost?: string | null
  forwardedProto?: string | null
  fallback?: string | null
}

function firstHeaderValue(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const first = value.split(',')[0]?.trim()
  return first ? first : null
}

function normalizeOriginCandidate(value: string | null | undefined): string | null {
  const raw = firstHeaderValue(value)
  if (!raw) return null

  // Accept a bare host or host:port and reject anything URL-like (paths,
  // queries, userinfo, fragments) before handing it to URL.
  if (/[\s/\\?#@]/.test(raw)) return null

  try {
    const parsed = new URL(`http://${raw}`)
    if (parsed.pathname !== '/' || parsed.search || parsed.hash) return null
    if (!parsed.hostname || parsed.username || parsed.password) return null
    return parsed.host
  } catch {
    return null
  }
}

function normalizeProtocol(value: string | null | undefined): string {
  const raw = firstHeaderValue(value)?.replace(/:$/, '').toLowerCase()
  return raw === 'https' ? 'https' : 'http'
}

/**
 * Resolve an absolute origin from request-style header values.
 *
 * Exported separately from `getRequestOrigin` so the precedence and validation
 * rules are unit-testable without a Next.js request scope.
 */
export function resolveRequestOrigin(input: RequestOriginInput = {}): string {
  const host = normalizeOriginCandidate(input.forwardedHost) ?? normalizeOriginCandidate(input.host)

  if (!host) {
    const fallback = input.fallback?.trim()
    if (!fallback) return DEFAULT_ORIGIN

    try {
      const parsed = new URL(fallback)
      if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) return DEFAULT_ORIGIN
      return parsed.origin
    } catch {
      return DEFAULT_ORIGIN
    }
  }

  return `${normalizeProtocol(input.forwardedProto)}://${host}`
}

/** Request-scoped canonical origin derived from the forwarded host. */
export async function getRequestOrigin(): Promise<string> {
  const requestHeaders = await headers()

  return resolveRequestOrigin({
    host: requestHeaders.get('host'),
    forwardedHost: requestHeaders.get('x-forwarded-host'),
    forwardedProto: requestHeaders.get('x-forwarded-proto'),
    fallback: process.env.NEXT_PUBLIC_SITE_URL,
  })
}

/** Resolve a stored image or route URL against the request origin. */
export function absoluteUrl(value: string, origin: string): string {
  if (!value) return `${origin}/placeholder.jpg`

  try {
    const parsed = new URL(value)
    if (ALLOWED_PROTOCOLS.has(parsed.protocol)) return parsed.toString()
    // Non-HTTP schemes (for example data:) are not valid canonical/OpenGraph
    // image URLs; fall back to the local placeholder.
    return `${origin}/placeholder.jpg`
  } catch {
    // Relative URL; resolve against the tenant origin.
  }

  try {
    return new URL(value, `${origin}/`).toString()
  } catch {
    return `${origin}/placeholder.jpg`
  }
}
