import { validateEnv } from './scripts/validate-env.mjs'

validateEnv()

/** @type {import('next').NextConfig} */
const nextConfig = {
  // PGlite ships WASM and filesystem assets; keep it as a server external so
  // the development-only database fallback is not bundled into chunks.
  serverExternalPackages: ['@electric-sql/pglite'],
  // Visual QA reaches the dev server through the seeded tenant hostnames.
  allowedDevOrigins: ['prima.otoweb.id', 'tenant-b.otoweb.id', 'showroom.prima.test', 'pending.prima.test'],
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ]
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
