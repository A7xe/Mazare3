/**
 * UA-2 — Phone OTP configuration (safe defaults; env optional).
 * Owner does NOT need to set these for local development.
 */
function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export const PHONE_OTP_DIGITS = 6;
export const PHONE_OTP_TTL_MS = parsePositiveInt(process.env.PHONE_OTP_TTL_MS, 5 * 60 * 1000);
export const PHONE_OTP_RESEND_COOLDOWN_MS = parsePositiveInt(
  process.env.PHONE_OTP_RESEND_COOLDOWN_MS,
  60 * 1000,
);
export const PHONE_OTP_MAX_ATTEMPTS = parsePositiveInt(process.env.PHONE_OTP_MAX_ATTEMPTS, 5);
export const PHONE_PROFILE_CONTINUE_TTL_MS = parsePositiveInt(
  process.env.PHONE_PROFILE_CONTINUE_TTL_MS,
  10 * 60 * 1000,
);

export const PHONE_OTP_SEND_IP_WINDOW_MS = parsePositiveInt(
  process.env.PHONE_OTP_SEND_IP_WINDOW_MS,
  15 * 60 * 1000,
);
export const PHONE_OTP_SEND_IP_MAX = parsePositiveInt(process.env.PHONE_OTP_SEND_IP_MAX, 10);
export const PHONE_OTP_SEND_ID_WINDOW_MS = parsePositiveInt(
  process.env.PHONE_OTP_SEND_ID_WINDOW_MS,
  15 * 60 * 1000,
);
export const PHONE_OTP_SEND_ID_MAX = parsePositiveInt(process.env.PHONE_OTP_SEND_ID_MAX, 5);
export const PHONE_OTP_VERIFY_IP_WINDOW_MS = parsePositiveInt(
  process.env.PHONE_OTP_VERIFY_IP_WINDOW_MS,
  15 * 60 * 1000,
);
export const PHONE_OTP_VERIFY_IP_MAX = parsePositiveInt(process.env.PHONE_OTP_VERIFY_IP_MAX, 30);
export const PHONE_OTP_VERIFY_ID_WINDOW_MS = parsePositiveInt(
  process.env.PHONE_OTP_VERIFY_ID_WINDOW_MS,
  15 * 60 * 1000,
);
export const PHONE_OTP_VERIFY_ID_MAX = parsePositiveInt(process.env.PHONE_OTP_VERIFY_ID_MAX, 15);

export type SmsOtpProviderName = 'none' | 'memory';

/**
 * Default when unset: `none` (safe — no fake SMS success).
 * `memory` is LOCAL/QA ONLY — refused in production.
 */
export function getSmsOtpProviderName(): SmsOtpProviderName {
  const raw = (process.env.SMS_OTP_PROVIDER ?? 'none').trim().toLowerCase();
  if (raw === 'memory') return 'memory';
  return 'none';
}
