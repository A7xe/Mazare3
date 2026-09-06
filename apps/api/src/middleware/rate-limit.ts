import rateLimit, { type Options } from 'express-rate-limit';
import type { Request, Response } from 'express';
import { isAuthRateLimitDisabled } from '../lib/qa-mode.js';
import {
  PASSWORD_RESET_ATTEMPT_RATE_MAX,
  PASSWORD_RESET_ATTEMPT_RATE_WINDOW_MS,
  PASSWORD_RESET_FORGOT_RATE_MAX,
  PASSWORD_RESET_FORGOT_RATE_WINDOW_MS,
} from '../config/password-reset.js';
import {
  PHONE_OTP_SEND_ID_MAX,
  PHONE_OTP_SEND_ID_WINDOW_MS,
  PHONE_OTP_SEND_IP_MAX,
  PHONE_OTP_SEND_IP_WINDOW_MS,
  PHONE_OTP_VERIFY_ID_MAX,
  PHONE_OTP_VERIFY_ID_WINDOW_MS,
  PHONE_OTP_VERIFY_IP_MAX,
  PHONE_OTP_VERIFY_IP_WINDOW_MS,
} from '../config/phone-otp-config.js';
import {
  authIpRateLimitKeyFromRequestIp,
  rateLimitKeyLogPrefix,
} from '../lib/auth-ip-key.js';
import { hashPhoneOtpRateIdentifier } from '../lib/phone-otp-crypto.js';
import { normalizeJordanPhoneE164 } from '../lib/phone-normalize.js';
import { createAuthPostgresRateLimitStore } from './postgres-rate-limit-store.js';

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

/** General auth IP limit — preserved AUTH-1 policy (overridable for QA only). */
export const AUTH_IP_RATE_WINDOW_MS = parsePositiveInt(
  process.env.AUTH_IP_RATE_WINDOW_MS,
  15 * 60 * 1000,
);
export const AUTH_IP_RATE_MAX = parsePositiveInt(process.env.AUTH_IP_RATE_MAX, 30);

function authIpKeyGenerator(req: Request): string {
  return authIpRateLimitKeyFromRequestIp(req.ip ?? req.socket.remoteAddress);
}

function phoneIdentifierKeyGenerator(req: Request): string {
  try {
    const raw = typeof req.body?.phone === 'string' ? req.body.phone : '';
    const e164 = normalizeJordanPhoneE164(raw);
    return hashPhoneOtpRateIdentifier(e164);
  } catch {
    // Invalid phones still share a bucket so abuse of garbage inputs is limited.
    return hashPhoneOtpRateIdentifier('invalid');
  }
}

function sharedAuthLimitMessage(): Options['message'] {
  return {
    error: 'Too many attempts. Please try again later.',
    code: 'RATE_LIMITED',
  };
}

function makeIpThrottleHandler(code: string) {
  return (req: Request, res: Response, _next: unknown, options: Options) => {
    const key = authIpKeyGenerator(req);
    console.info('[auth] IP auth throttle triggered', {
      code,
      keyPrefix: rateLimitKeyLogPrefix(key),
    });
    res.status(options.statusCode).json(
      typeof options.message === 'object' ? options.message : { error: options.message, code: 'RATE_LIMITED' },
    );
  };
}

/**
 * Shared (Postgres) IP rate limiters for auth surfaces.
 * Order on Login: IP limiter (middleware) → identifier abuse → credential verify.
 */
export const authRateLimiter = rateLimit({
  windowMs: AUTH_IP_RATE_WINDOW_MS,
  max: AUTH_IP_RATE_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isAuthRateLimitDisabled(),
  store: createAuthPostgresRateLimitStore('auth-general'),
  keyGenerator: authIpKeyGenerator,
  handler: makeIpThrottleHandler('AUTH_IP_THROTTLED'),
  message: sharedAuthLimitMessage(),
});

export const forgotPasswordRateLimiter = rateLimit({
  windowMs: PASSWORD_RESET_FORGOT_RATE_WINDOW_MS,
  max: PASSWORD_RESET_FORGOT_RATE_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isAuthRateLimitDisabled(),
  store: createAuthPostgresRateLimitStore('auth-forgot-password'),
  keyGenerator: authIpKeyGenerator,
  handler: makeIpThrottleHandler('AUTH_FORGOT_IP_THROTTLED'),
  message: sharedAuthLimitMessage(),
});

export const resetPasswordRateLimiter = rateLimit({
  windowMs: PASSWORD_RESET_ATTEMPT_RATE_WINDOW_MS,
  max: PASSWORD_RESET_ATTEMPT_RATE_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isAuthRateLimitDisabled(),
  store: createAuthPostgresRateLimitStore('auth-reset-password'),
  keyGenerator: authIpKeyGenerator,
  handler: makeIpThrottleHandler('AUTH_RESET_IP_THROTTLED'),
  message: sharedAuthLimitMessage(),
});

/** UA-2 — Phone OTP send by IP */
export const phoneOtpSendIpRateLimiter = rateLimit({
  windowMs: PHONE_OTP_SEND_IP_WINDOW_MS,
  max: PHONE_OTP_SEND_IP_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isAuthRateLimitDisabled(),
  store: createAuthPostgresRateLimitStore('auth-phone-otp-send-ip'),
  keyGenerator: authIpKeyGenerator,
  handler: makeIpThrottleHandler('PHONE_OTP_SEND_IP_THROTTLED'),
  message: sharedAuthLimitMessage(),
});

/** UA-2 — Phone OTP send by phone identifier (HMAC) */
export const phoneOtpSendIdRateLimiter = rateLimit({
  windowMs: PHONE_OTP_SEND_ID_WINDOW_MS,
  max: PHONE_OTP_SEND_ID_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isAuthRateLimitDisabled(),
  store: createAuthPostgresRateLimitStore('auth-phone-otp-send-id'),
  keyGenerator: phoneIdentifierKeyGenerator,
  handler: makeIpThrottleHandler('PHONE_OTP_SEND_ID_THROTTLED'),
  message: sharedAuthLimitMessage(),
});

/** UA-2 — Phone OTP verify by IP */
export const phoneOtpVerifyIpRateLimiter = rateLimit({
  windowMs: PHONE_OTP_VERIFY_IP_WINDOW_MS,
  max: PHONE_OTP_VERIFY_IP_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isAuthRateLimitDisabled(),
  store: createAuthPostgresRateLimitStore('auth-phone-otp-verify-ip'),
  keyGenerator: authIpKeyGenerator,
  handler: makeIpThrottleHandler('PHONE_OTP_VERIFY_IP_THROTTLED'),
  message: sharedAuthLimitMessage(),
});

/** UA-2 — Phone OTP verify by phone identifier (HMAC) */
export const phoneOtpVerifyIdRateLimiter = rateLimit({
  windowMs: PHONE_OTP_VERIFY_ID_WINDOW_MS,
  max: PHONE_OTP_VERIFY_ID_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isAuthRateLimitDisabled(),
  store: createAuthPostgresRateLimitStore('auth-phone-otp-verify-id'),
  keyGenerator: phoneIdentifierKeyGenerator,
  handler: makeIpThrottleHandler('PHONE_OTP_VERIFY_ID_THROTTLED'),
  message: sharedAuthLimitMessage(),
});

/** Support tickets remain process-local (non-auth-critical for AUTH-5 scope). */
export const supportRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isAuthRateLimitDisabled(),
  message: {
    error: 'Too many support requests. Please try again later.',
    code: 'RATE_LIMITED',
  },
  keyGenerator: (req) => req.ip ?? req.socket.remoteAddress ?? 'unknown',
});
