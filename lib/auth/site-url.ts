/** Public application origin used to build absolute links. */
export function getSiteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim()
  if (!configured) return 'http://localhost:3000'
  return configured.replace(/\/+$/, '')
}
