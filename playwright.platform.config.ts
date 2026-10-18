import { defineConfig, devices } from '@playwright/test'

const AUTH_PORT = '54323'
const APP_PORT = '3003'
const AUTH_URL = `http://127.0.0.1:${AUTH_PORT}`
const PLATFORM_PROFILE_ID = '50000000-0000-4000-8000-000000000003'

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /(?:platform|custom-domains)\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://prima.otoweb.id:${APP_PORT}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    viewport: { width: 1440, height: 900 },
  },
  projects: [
    {
      name: 'platform-chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: [
            '--host-resolver-rules=MAP prima.otoweb.id 127.0.0.1, MAP tenant-b.otoweb.id 127.0.0.1',
          ],
        },
      },
    },
  ],
  webServer: [
    {
      command: 'node scripts/fake-supabase-auth.mjs',
      url: `${AUTH_URL}/health`,
      reuseExistingServer: false,
      timeout: 30_000,
      env: {
        FAKE_AUTH_PORT: AUTH_PORT,
        FAKE_AUTH_USER_ID: PLATFORM_PROFILE_ID,
        FAKE_AUTH_EMAIL: 'operator@otoweb.test',
        FAKE_AUTH_NAME: 'Platform Operator',
      },
    },
    {
      command: `NEXT_PUBLIC_SUPABASE_URL=${AUTH_URL} NEXT_PUBLIC_SUPABASE_ANON_KEY=fake-anon-key NEXT_PUBLIC_SHOWROOM_SLUG=prima-auto-gallery pnpm exec next dev -p ${APP_PORT}`,
      url: `http://127.0.0.1:${APP_PORT}`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        NEXT_TELEMETRY_DISABLED: '1',
        NEXT_PUBLIC_SITE_URL: `http://prima.otoweb.id:${APP_PORT}`,
        NEXT_PUBLIC_SHOWROOM_SLUG: 'prima-auto-gallery',
        NEXT_PUBLIC_SUPABASE_URL: AUTH_URL,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'fake-anon-key',
        MEDIA_PROVIDER: 'fake',
        DOMAIN_PROVIDER: 'fake',
      },
    },
  ],
})
