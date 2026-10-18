import { createAdminProxy } from '@/lib/auth/admin-proxy'

/**
 * Next.js 16 request proxy. Every admin route is default-deny: only a
 * server-verified Supabase session is allowed through.
 */
export const proxy = createAdminProxy()

export const config = {
  matcher: ['/admin/:path*'],
}
