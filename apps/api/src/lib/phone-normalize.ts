import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { AppError } from './errors.js';

/**
 * UA-2 — Jordan-first phone normalization to E.164.
 *
 * Accepted examples (valid JO mobile):
 * - 07XXXXXXXX
 * - 7XXXXXXXX (national without leading 0)
 * - +9627XXXXXXXX
 * - 009627XXXXXXXX
 *
 * Rejects invalid / non-JO numbers for UA-2 scope.
 */
export function normalizeJordanPhoneE164(raw: string): string {
  const input = String(raw ?? '').trim();
  if (!input) {
    throw new AppError(400, 'INVALID_PHONE', 'Enter a valid Jordanian mobile number');
  }

  const parsed = parsePhoneNumberFromString(input, 'JO');
  if (!parsed || !parsed.isValid()) {
    throw new AppError(400, 'INVALID_PHONE', 'Enter a valid Jordanian mobile number');
  }
  if (parsed.country !== 'JO') {
    throw new AppError(400, 'INVALID_PHONE', 'Enter a valid Jordanian mobile number');
  }
  // JO mobiles are typically 7XXXXXXXX (national) → +9627…
  if (parsed.getType() && parsed.getType() !== 'MOBILE' && parsed.getType() !== 'FIXED_LINE_OR_MOBILE') {
    // libphonenumber may classify some JO numbers as FIXED_LINE_OR_MOBILE; allow those.
    // Reject pure FIXED_LINE / VOIP etc. when known.
    if (parsed.getType() === 'FIXED_LINE' || parsed.getType() === 'VOIP') {
      throw new AppError(400, 'INVALID_PHONE', 'Enter a valid Jordanian mobile number');
    }
  }

  return parsed.format('E.164');
}

/** Best-effort normalize for legacy User.phone collision checks — never throws. */
export function tryNormalizeJordanPhoneE164(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    return normalizeJordanPhoneE164(raw);
  } catch {
    return null;
  }
}
