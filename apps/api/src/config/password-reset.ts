/**
 * Password reset token lifetime and related auth-recovery config.
 * Centralized — do not scatter magic numbers.
 */

/** Reset links expire after 45 minutes. */
export const PASSWORD_RESET_TOKEN_TTL_MS = 45 * 60 * 1000;

/** Forgot-password: max requests per IP per window. */
export const PASSWORD_RESET_FORGOT_RATE_MAX = 5;
export const PASSWORD_RESET_FORGOT_RATE_WINDOW_MS = 15 * 60 * 1000;

/** Reset-password: max attempts per IP per window (token brute-force dampening). */
export const PASSWORD_RESET_ATTEMPT_RATE_MAX = 10;
export const PASSWORD_RESET_ATTEMPT_RATE_WINDOW_MS = 15 * 60 * 1000;

export function getPasswordResetFrontendOrigin(): string {
  const raw =
    process.env.FRONTEND_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    'http://localhost:3000';
  return raw.replace(/\/$/, '');
}
