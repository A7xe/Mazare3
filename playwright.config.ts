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
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        ...process.env,
        API_PORT: '4010',
        CORS_ORIGIN: WEB_URL,
        APP_ENV: 'local',
        ENABLE_INTERNAL_QA_ROUTES: 'true',
        ENABLE_PASSWORD_RESET_DEV_LINK: 'false',
        DISABLE_AUTH_RATE_LIMIT: 'true',
        DISABLE_LOGIN_ABUSE_PROTECTION: 'true',
        LOGIN_ABUSE_FAIL_THRESHOLD: '3',
        LOGIN_ABUSE_EXTENDED_THRESHOLD: '100',
        LOGIN_ABUSE_MAX_THRESHOLD: '200',
        LOGIN_ABUSE_COOLDOWN_MS: '4000',
        LOGIN_ABUSE_STATE_TTL_MS: '600000',
        EMAIL_PROVIDER: 'memory',
        EMAIL_FROM: 'noreply@mazare3.test',
        EMAIL_FROM_NAME: 'Mazare3 QA',
        FRONTEND_URL: WEB_URL,
        NEXT_PUBLIC_APP_URL: WEB_URL,
        /** Prefer gateway selector so local `.env` PAYMENT_GATEWAY_PROVIDER=paytabs cannot leak into E2E. */
        PAYMENT_GATEWAY_PROVIDER: 'mock',
        PAYMENT_PROVIDER: 'test',
        PAYMENT_SIMULATE_ENABLED: 'true',
        /** CB-4 — Managed Form mock seam (HPP remains via create-intent / UI fallback). */
        PAYTABS_CHECKOUT_MODE: 'managed_form',
        /** CB-5A — mock vault + save-card opt-in (no real PayTabs). */
        PAYTABS_TOKENIZATION_ENABLED: 'true',
        /** CB-5B — default safe customer-present saved-card charge (mock). */
        PAYTABS_SAVED_CARD_CHARGE_MODE: 'ecom_cvv_redirect',
        PAYTABS_RECURRING_ENABLED: 'false',
        PRISMA_DISABLE_QUERY_LOG: 'true',
        /** UA-6A — test-safe phone OTP + Google seams (process-scoped; not real .env). */
        SMS_OTP_PROVIDER: 'memory',
        PHONE_AUTH_PUBLIC_ENABLED: 'false',
        GOOGLE_AUTH_ENABLED: 'true',
        GOOGLE_CLIENT_ID: 'ua6a-playwright-client.apps.googleusercontent.com',
        GOOGLE_CLIENT_SECRET: 'ua6a-playwright-secret-not-real',
        GOOGLE_REDIRECT_URI: `${API_PUBLIC_URL.replace(/\/api\/v1$/, '')}/api/v1/auth/google/callback`,
      },
    },
    {
      command: 'pnpm --filter @mazare3/web exec next dev --port 3010',
      url: `${WEB_URL}/ar/properties/chalet-emerald-dead-sea`,
      reuseExistingServer: false,
      timeout: 180_000,
      env: {
        ...process.env,
        NEXT_PUBLIC_API_URL: API_PUBLIC_URL,
        NEXT_PUBLIC_APP_URL: WEB_URL,
        API_URL: 'http://localhost:4010',
        /** Isolate Next cache from concurrent `pnpm dev` on port 3000. */
        PLAYWRIGHT_NEXT_DIST: '.next-e2e',
      },
    },
  ],
});
