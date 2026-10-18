/** Public application origin used to build auth callback links. */
export function getSiteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (!configured) return 'http://localhost:3000'
  return configured.replace(/\/+$/, '')
}

/** Supabase redirect target for password recovery. */
export function buildResetCallbackUrl(): string {
  return `${getSiteUrl()}/auth/callback?next=/reset-password`
}
