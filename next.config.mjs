import { buildSecurityHeaders } from './lib/security/headers.mjs'
import { validateEnv } from './scripts/validate-env.mjs'

validateEnv()

const isProduction = process.env.NODE_ENV === 'production'
const securityHeaders = buildSecurityHeaders(isProduction)

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Do not advertise the framework in production responses.
  poweredByHeader: false,
  // PGlite ships WASM and filesystem assets; keep it as a server external so
  // the development-only database fallback is not bundled into chunks.
  serverExternalPackages: ['@electric-sql/pglite'],
  // Visual QA reaches the dev server through the seeded tenant hostnames.
  allowedDevOrigins: [
    'prima.otoweb.id',
    'tenant-b.otoweb.id',
    'unknown.otoweb.id',
    'showroom.prima.test',
    'pending.prima.test',
  ],
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
