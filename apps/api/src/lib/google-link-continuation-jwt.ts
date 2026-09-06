import jwt from 'jsonwebtoken';
import { GOOGLE_LINK_CONTINUE_TTL_MS } from '../config/google-auth-config.js';
import { AppError } from './errors.js';

export const GOOGLE_LINK_CONTINUE_TYP = 'google_link_existing';

export type GoogleLinkContinuePayload = {
  typ: typeof GOOGLE_LINK_CONTINUE_TYP;
  googleSub: string;
  /** Normalized verified Google email. */
  email: string;
  /** Existing Mazare3 user id (internal — not returned to clients in clear form beyond token). */
  existingUserId: string;
};

function getSecret(): string {
  const secret = process.env.JWT_SECRET ?? process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET or SESSION_SECRET (min 32 chars) is required');
  }
  return secret;
}

export function signGoogleLinkContinueToken(
  payload: Omit<GoogleLinkContinuePayload, 'typ'>,
): string {
  const expiresInSec = Math.max(60, Math.floor(GOOGLE_LINK_CONTINUE_TTL_MS / 1000));
  return jwt.sign(
    {
      typ: GOOGLE_LINK_CONTINUE_TYP,
      googleSub: payload.googleSub,
      email: payload.email,
      existingUserId: payload.existingUserId,
    },
    getSecret(),
    { expiresIn: expiresInSec, audience: GOOGLE_LINK_CONTINUE_TYP },
  );
}

export function verifyGoogleLinkContinueToken(raw: string): GoogleLinkContinuePayload {
  try {
    const decoded = jwt.verify(raw, getSecret(), {
      audience: GOOGLE_LINK_CONTINUE_TYP,
    }) as GoogleLinkContinuePayload;
    if (
      decoded.typ !== GOOGLE_LINK_CONTINUE_TYP ||
      !decoded.googleSub ||
      !decoded.email ||
      !decoded.existingUserId
    ) {
      throw new AppError(400, 'INVALID_LINK_TOKEN', 'This linking step has expired.');
    }
    return decoded;
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(400, 'INVALID_LINK_TOKEN', 'This linking step has expired.');
  }
}
