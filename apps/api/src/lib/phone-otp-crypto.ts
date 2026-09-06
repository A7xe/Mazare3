import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { PHONE_OTP_DIGITS } from '../config/phone-otp-config.js';

function getOtpSecret(): string {
  const secret = process.env.JWT_SECRET ?? process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET or SESSION_SECRET (min 32 chars) is required for phone OTP');
  }
  return secret;
}

/** Privacy-preserving OtpChallenge.identifierHash — never store raw phone. */
export function hashPhoneOtpIdentifier(canonicalE164: string): string {
  return createHmac('sha256', getOtpSecret())
    .update(`phone-otp-identifier:v1:${canonicalE164}`, 'utf8')
    .digest('hex');
}

/** Keyed digest for low-entropy OTP codes (HMAC, not plain SHA-256). */
export function hashPhoneOtpCode(challengeId: string, code: string): string {
  return createHmac('sha256', getOtpSecret())
    .update(`phone-otp-code:v1:${challengeId}:${code}`, 'utf8')
    .digest('hex');
}

/** Rate-limit key material for phone identifier buckets (separate domain). */
export function hashPhoneOtpRateIdentifier(canonicalE164: string): string {
  return createHmac('sha256', getOtpSecret())
    .update(`phone-otp-rate:v1:${canonicalE164}`, 'utf8')
    .digest('hex');
}

export function generateSecureNumericOtp(digits = PHONE_OTP_DIGITS): string {
  const max = 10 ** digits;
  const n = randomInt(0, max);
  return String(n).padStart(digits, '0');
}

export function timingSafeEqualHex(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, 'utf8');
    const bb = Buffer.from(b, 'utf8');
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}
