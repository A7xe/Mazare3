/**
 * UA-6 — Connected identity status for Account (AuthIdentity-authoritative).
 */
import { AuthIdentityProvider, prisma } from '@mazare3/db';
import { AppError } from '../lib/errors.js';
import { parsePhoneNumberFromString } from 'libphonenumber-js';

export type AuthIdentitiesStatus = {
  phone: { linked: boolean; masked: string | null };
  google: { linked: boolean };
  /** Password auth method — NOT inferred from User.email alone. */
  password: { linked: boolean };
};

function maskE164(e164: string): string {
  const parsed = parsePhoneNumberFromString(e164);
  if (parsed?.isValid()) {
    const national = parsed.formatNational().replace(/\D/g, '');
    if (national.length >= 4) {
      const last4 = national.slice(-4);
      return `+${parsed.countryCallingCode} •••• ${last4}`;
    }
  }
  if (e164.length >= 4) return `•••• ${e164.slice(-4)}`;
  return '••••';
}

export async function getAuthIdentitiesStatus(userId: string): Promise<AuthIdentitiesStatus> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      passwordHash: true,
      authIdentities: {
        where: { verifiedAt: { not: null } },
        select: { provider: true, providerSubject: true },
      },
    },
  });
  if (!user) throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');

  const phoneId = user.authIdentities.find((i) => i.provider === AuthIdentityProvider.phone);
  const googleId = user.authIdentities.find((i) => i.provider === AuthIdentityProvider.google);
  const passwordId = user.authIdentities.find((i) => i.provider === AuthIdentityProvider.password);
  const passwordLinked = Boolean(passwordId) || Boolean(user.passwordHash);

  return {
    phone: {
      linked: Boolean(phoneId),
      masked: phoneId ? maskE164(phoneId.providerSubject) : null,
    },
    google: { linked: Boolean(googleId) },
    password: { linked: passwordLinked },
  };
}
