/**
 * UA-5 — Truthful payment customer contact (no fabricated email/phone/name).
 * AuthIdentity phone is preferred for verified phone; User.phone is never treated as verified.
 */
import { AuthIdentityProvider, prisma } from '@mazare3/db';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { AppError } from '../lib/errors.js';
import { normalizeLoginEmail } from './login-abuse.service.js';
import { normalizeJordanPhoneE164 } from '../lib/phone-normalize.js';

export type PaymentCustomerContact = {
  name: string;
  email: string;
  phone: string;
};

export type PaymentContactRequiredDetails = {
  requiredFields: Array<'email' | 'phone' | 'name'>;
};

/** Verified phone AuthIdentity for the user — never User.phone / Partner phones. */
export async function getVerifiedPhoneIdentity(
  userId: string,
): Promise<{ e164: string } | null> {
  const row = await prisma.authIdentity.findFirst({
    where: {
      userId,
      provider: AuthIdentityProvider.phone,
      verifiedAt: { not: null },
    },
    select: { providerSubject: true },
    orderBy: { verifiedAt: 'desc' },
  });
  if (!row?.providerSubject) return null;
  return { e164: row.providerSubject };
}

/** Format E.164 for PayTabs Jordan payloads (national mobile, e.g. 07XXXXXXXX). */
export function formatPhoneForPaytabs(e164OrLocal: string): string {
  const parsed = parsePhoneNumberFromString(e164OrLocal, 'JO');
  if (parsed && parsed.isValid() && parsed.country === 'JO') {
    const national = parsed.formatNational().replace(/\D/g, '');
    if (national.startsWith('0')) return national;
    return `0${national}`;
  }
  const digits = e164OrLocal.replace(/\D/g, '');
  if (/^07\d{8}$/.test(digits)) return digits;
  throw new AppError(400, 'INVALID_PHONE', 'Enter a valid Jordanian mobile number');
}

function assertValidEmailSyntax(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Enter a valid email address');
  }
  return normalizeLoginEmail(trimmed);
}

/**
 * Resolve truthful PayTabs customer contact.
 * Does not fabricate identity. May persist contact email onto User when safe.
 */
export async function resolvePaymentCustomerContact(
  userId: string,
  opts?: {
    contactEmail?: string | null;
    contactPhone?: string | null;
    requireComplete?: boolean;
  },
): Promise<
  | PaymentCustomerContact
  | { incomplete: true; requiredFields: Array<'email' | 'phone' | 'name'> }
> {
  const requireComplete = opts?.requireComplete ?? true;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true },
  });
  if (!user) {
    throw new AppError(401, 'UNAUTHORIZED', 'Authentication required');
  }

  const requiredFields: Array<'email' | 'phone' | 'name'> = [];
  const name = user.name?.trim() ?? '';
  if (name.length < 2) requiredFields.push('name');

  let email = user.email ? normalizeLoginEmail(user.email) : null;

  if (opts?.contactEmail != null && String(opts.contactEmail).trim()) {
    const submitted = assertValidEmailSyntax(String(opts.contactEmail));
    if (!email) {
      const taken = await prisma.user.findUnique({
        where: { email: submitted },
        select: { id: true },
      });
      if (taken && taken.id !== userId) {
        throw new AppError(
          409,
          'PAYMENT_CONTACT_EMAIL_UNAVAILABLE',
          'Please use a different email address for payment',
        );
      }
      if (!taken) {
        await prisma.user.update({
          where: { id: userId },
          data: { email: submitted },
        });
      }
      email = submitted;
    }
    // If User.email already set, keep it — do not overwrite with checkout input.
  }

  if (!email) requiredFields.push('email');

  const verified = await getVerifiedPhoneIdentity(userId);
  let phone: string | null = null;
  if (verified) {
    phone = formatPhoneForPaytabs(verified.e164);
  } else if (opts?.contactPhone?.trim()) {
    const e164 = normalizeJordanPhoneE164(opts.contactPhone.trim());
    phone = formatPhoneForPaytabs(e164);
  }
  if (!phone) requiredFields.push('phone');

  if (requiredFields.length > 0) {
    if (requireComplete) {
      throw new AppError(
        422,
        'PAYMENT_CONTACT_REQUIRED',
        'Additional contact details are required to continue to payment',
        { requiredFields } satisfies PaymentContactRequiredDetails,
      );
    }
    return { incomplete: true, requiredFields };
  }

  return { name, email: email!, phone: phone! };
}

/** Build PayTabs customer_details from validated contact — never invents identity fields. */
export function buildPayTabsCustomerContact(contact: PaymentCustomerContact): {
  name: string;
  email: string;
  phone: string;
  street1: string;
  city: string;
  state: string;
  country: string;
  zip: string;
} {
  const name = contact.name.trim();
  const email = contact.email.trim();
  const phone = contact.phone.trim();
  if (!name || !email || !phone) {
    throw new AppError(
      422,
      'PAYMENT_CONTACT_REQUIRED',
      'Additional contact details are required to continue to payment',
    );
  }
  // Jordan marketplace HPP address defaults (not a fabricated personal street address).
  return {
    name,
    email,
    phone,
    street1: 'Amman',
    city: 'Amman',
    state: 'Amman',
    country: 'JO',
    zip: '11118',
  };
}
