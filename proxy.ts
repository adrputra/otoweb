import { createAdminProxy } from '@/lib/auth/admin-proxy'

/**
 * Next.js 16 request proxy. Every admin and platform route is default-deny:
 * requests without the local session cookie are redirected to sign-in. The
 * admin and platform layouts then verify the session against PostgreSQL;
 * platform access is narrowed further by the explicit operator membership
 * check in the platform layout and data layer.
 */
export const proxy = createAdminProxy()

export const config = {
  matcher: ['/admin/:path*', '/platform/:path*'],
}
