import { defineConfig, devices } from '@playwright/test'

const APP_PORT = '3002'

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /admin-(vehicles|vehicle-images|showroom-settings|leads|analytics)\.spec\.ts/,
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
      name: 'admin-chromium',
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
  webServer: {
    command: `pnpm exec next dev -p ${APP_PORT}`,
    url: `http://127.0.0.1:${APP_PORT}`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      NEXT_TELEMETRY_DISABLED: '1',
      NEXT_PUBLIC_SITE_URL: `http://prima.otoweb.id:${APP_PORT}`,
      NEXT_PUBLIC_SHOWROOM_SLUG: 'prima-auto-gallery',
      MEDIA_PROVIDER: 'fake',
      SEED_DEV_AUTH: '1',
      ALLOW_DEV_LOGIN: '1',
    },
  },
})
