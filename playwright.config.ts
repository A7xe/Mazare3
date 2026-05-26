import { defineConfig, devices } from '@playwright/test';

/** Dedicated ports so E2E does not clash with a developer's `pnpm dev` on 3000/4000. */
const WEB_URL = process.env.PLAYWRIGHT_WEB_URL ?? 'http://localhost:3010';
const API_HEALTH_URL =
  process.env.PLAYWRIGHT_API_HEALTH_URL ?? 'http://localhost:4010/api/v1/health';
const API_PUBLIC_URL = process.env.PLAYWRIGHT_API_URL ?? 'http://localhost:4010/api/v1';

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 1,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: WEB_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'pnpm --filter @mazare3/api run dev',
      url: API_HEALTH_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        ...process.env,
        API_PORT: '4010',
        CORS_ORIGIN: WEB_URL,
        DISABLE_AUTH_RATE_LIMIT: 'true',
        PAYMENT_PROVIDER: 'test',
        PAYMENT_SIMULATE_ENABLED: 'true',
      },
    },
    {
      command: 'pnpm --filter @mazare3/web exec next dev --port 3010',
      url: `${WEB_URL}/ar/properties/chalet-emerald-dead-sea`,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      env: {
        ...process.env,
        NEXT_PUBLIC_API_URL: API_PUBLIC_URL,
        NEXT_PUBLIC_APP_URL: WEB_URL,
      },
    },
  ],
});
