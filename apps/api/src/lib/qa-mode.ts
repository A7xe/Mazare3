import { isAppEnvProduction } from '../config/app-env.js';

/**
 * QA / E2E-only flags. Never weaken APP_ENV=production security.
 */

/** Skip auth rate limiter (login/signup) — never on APP_ENV=production. */
export function isAuthRateLimitDisabled(): boolean {
  if (isAppEnvProduction()) return false;
  return process.env.DISABLE_AUTH_RATE_LIMIT === 'true';
}

/** Internal routes for payment expiry QA, backdating, etc. */
export function isInternalQaRoutesEnabled(): boolean {
  if (isAppEnvProduction()) return false;
  return process.env.ENABLE_INTERNAL_QA_ROUTES === 'true';
}

/**
 * Allow forgot-password responses to include a one-time reset URL in local/QA only.
 * Never on APP_ENV=production.
 */
export function isPasswordResetDevLinkEnvEnabled(): boolean {
  if (isAppEnvProduction()) return false;
  return process.env.ENABLE_PASSWORD_RESET_DEV_LINK === 'true';
}
