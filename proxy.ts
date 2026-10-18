import { createAdminProxy } from '@/lib/auth/admin-proxy'

/**
 * Next.js 16 request proxy. Every admin and platform route is default-deny:
 * only a server-verified Supabase session is allowed through. Platform access
 * is narrowed further by the explicit operator membership check in the
 * platform layout and data layer.
 */
export const proxy = createAdminProxy()

export const config = {
  matcher: ['/admin/:path*', '/platform/:path*'],
}
