import jwt from 'jsonwebtoken';
import { PHONE_PROFILE_CONTINUE_TTL_MS } from '../config/phone-otp-config.js';
import { AppError } from './errors.js';

export const PHONE_CONTINUE_TOKEN_TYP = 'phone_profile_continue';

export type PhoneContinuePayload = {
  typ: typeof PHONE_CONTINUE_TOKEN_TYP;
  challengeId: string;
  identifierHash: string;
  /** Safe internal return path only (already sanitized). */
  returnUrl?: string | null;
};

function getSecret(): string {
  const secret = process.env.JWT_SECRET ?? process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET or SESSION_SECRET (min 32 chars) is required');
  }
  return secret;
}

export function signPhoneContinueToken(payload: Omit<PhoneContinuePayload, 'typ'>): string {
  const expiresInSec = Math.max(60, Math.floor(PHONE_PROFILE_CONTINUE_TTL_MS / 1000));
  return jwt.sign(
    {
      typ: PHONE_CONTINUE_TOKEN_TYP,
      challengeId: payload.challengeId,
      identifierHash: payload.identifierHash,
      returnUrl: payload.returnUrl ?? null,
    },
    getSecret(),
    { expiresIn: expiresInSec, audience: PHONE_CONTINUE_TOKEN_TYP },
  );
}

export function verifyPhoneContinueToken(raw: string): PhoneContinuePayload {
  try {
    const decoded = jwt.verify(raw, getSecret(), {
      audience: PHONE_CONTINUE_TOKEN_TYP,
    }) as PhoneContinuePayload;
    if (decoded.typ !== PHONE_CONTINUE_TOKEN_TYP) {
      throw new AppError(400, 'INVALID_CONTINUE_TOKEN', 'This step has expired. Please verify again.');
    }
    if (!decoded.challengeId || !decoded.identifierHash) {
      throw new AppError(400, 'INVALID_CONTINUE_TOKEN', 'This step has expired. Please verify again.');
    }
    return decoded;
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(400, 'INVALID_CONTINUE_TOKEN', 'This step has expired. Please verify again.');
  }
}
