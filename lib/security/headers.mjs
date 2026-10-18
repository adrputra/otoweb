/**
 * Shared response-hardening headers.
 *
 * Kept in a plain module so the Next config and the audit tests use exactly the
 * same values. The CSP is intentionally a non-script subset: it blocks framing,
 * base-tag hijacking, plugin content, and cross-origin form posts without
 * requiring a nonce for Next's inline bootstrap.
 */
export const SECURITY_HEADERS = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=()',
  },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  {
    key: 'Content-Security-Policy',
    value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'",
  },
]

/** Return the header set for the current environment. HSTS is HTTPS-only. */
export function buildSecurityHeaders(isProduction) {
  const headers = SECURITY_HEADERS.map((header) => ({ ...header }))

  if (isProduction) {
    headers.push({
      key: 'Strict-Transport-Security',
      value: 'max-age=31536000; includeSubDomains',
    })
  }

  return headers
}
