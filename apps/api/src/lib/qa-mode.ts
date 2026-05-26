/**
 * QA / E2E-only flags. Never weaken production security.
 */

/** Skip auth rate limiter (login/signup) — only when explicitly enabled and not production. */
export function isAuthRateLimitDisabled(): boolean {
  if (process.env.NODE_ENV === 'production') return false;
  return process.env.DISABLE_AUTH_RATE_LIMIT === 'true';
}

/** Internal routes for payment expiry QA, backdating, etc. */
export function isInternalQaRoutesEnabled(): boolean {
  if (process.env.NODE_ENV === 'production') return false;
  return process.env.ENABLE_INTERNAL_QA_ROUTES === 'true';
}
