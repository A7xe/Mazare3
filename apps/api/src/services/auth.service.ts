import bcrypt from 'bcryptjs';
import { AuthIdentityProvider, LegalAcceptanceContext, LegalDocumentType, prisma } from '@mazare3/db';
import type { LoginInput, SignupInput, UserRole } from '@mazare3/shared';
import { AppError } from '../lib/errors.js';
import type { SessionPayload } from '../lib/jwt.js';
import {
  assertLoginIdentifierNotThrottled,
  clearLoginIdentifierAbuse,
  normalizeLoginEmail,
  recordLoginIdentifierFailure,
} from './login-abuse.service.js';
import { recordAcceptance } from './legal/legal-acceptance.service.js';
import { grantConsent } from './legal/privacy-consent.service.js';
import { grantDataProcessingConsent } from './legal/data-processing-consent.service.js';
import { getVersionById } from './legal/legal-document.service.js';

const BCRYPT_ROUNDS = 12;

/** Cached dummy bcrypt hash for timing parity on unknown accounts. */
let dummyPasswordHash: string | null = null;

async function getDummyPasswordHash(): Promise<string> {
  if (!dummyPasswordHash) {
    dummyPasswordHash = await bcrypt.hash('mazare3-timing-dummy-not-a-password', BCRYPT_ROUNDS);
  }
  return dummyPasswordHash;
}

/**
 * Ensure a password AuthIdentity exists for the normalized email.
 * Idempotent. Never reassigns an identity owned by another user.
 * verifiedAt stays null — Mazare3 has no signup email verification yet.
 */
export async function ensurePasswordAuthIdentity(
  userId: string,
  normalizedEmail: string,
): Promise<void> {
  const existing = await prisma.authIdentity.findUnique({
    where: {
      provider_providerSubject: {
        provider: AuthIdentityProvider.password,
        providerSubject: normalizedEmail,
      },
    },
    select: { userId: true },
  });
  if (existing) {
    return;
  }
  try {
    await prisma.authIdentity.create({
      data: {
        userId,
        provider: AuthIdentityProvider.password,
        providerSubject: normalizedEmail,
        verifiedAt: null,
      },
    });
  } catch {
    /* concurrent create — unique constraint; safe to ignore */
  }
}

export async function signupCustomer(input: SignupInput): Promise<SessionPayload> {
  const email = normalizeLoginEmail(input.email);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new AppError(409, 'EMAIL_EXISTS', 'An account with this email already exists');
  }

  const termsVersion = await getVersionById(input.acceptedTermsVersionId);
  if (!termsVersion || termsVersion.documentType !== LegalDocumentType.terms_and_conditions) {
    throw new AppError(400, 'INVALID_TERMS_VERSION', 'acceptedTermsVersionId is invalid');
  }
  if (termsVersion.status !== 'active') {
    throw new AppError(400, 'TERMS_NOT_ACTIVE', 'Terms version is not active');
  }

  const privacyVersion = await getVersionById(input.acknowledgedPrivacyVersionId);
  if (!privacyVersion || privacyVersion.documentType !== LegalDocumentType.privacy_policy) {
    throw new AppError(400, 'INVALID_PRIVACY_VERSION', 'acknowledgedPrivacyVersionId is invalid');
  }
  if (privacyVersion.status !== 'active') {
    throw new AppError(400, 'PRIVACY_NOT_ACTIVE', 'Privacy version is not active');
  }

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  const passwordChangedAt = new Date();

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        email,
        name: input.name?.trim(),
        passwordHash,
        passwordChangedAt,
        role: 'customer',
        locale: input.locale ?? 'ar',
        status: 'active',
      },
    });

    await tx.authIdentity.create({
      data: {
        userId: created.id,
        provider: AuthIdentityProvider.password,
        providerSubject: email,
        verifiedAt: null,
      },
    });

    return created;
  });

  // Separate evidence: Terms acceptance vs Privacy acknowledgement (not Prior Consent / marketing).
  await recordAcceptance(user.id, {
    documentVersionId: input.acceptedTermsVersionId,
    context: LegalAcceptanceContext.registration,
    sourceSurface: 'auth.signup',
  });
  await recordAcceptance(user.id, {
    documentVersionId: input.acknowledgedPrivacyVersionId,
    context: LegalAcceptanceContext.privacy_consent,
    sourceSurface: 'auth.signup.privacy_ack',
  });

  // Jordan Prior Consent for account processing — distinct from Privacy Policy acknowledgement.
  if (input.priorConsentAccount !== true) {
    throw new AppError(
      400,
      'PRIOR_CONSENT_REQUIRED',
      'Explicit Prior Consent is required for account Personal Data processing',
    );
  }
  await grantDataProcessingConsent(user.id, {
    purposeKey: 'account_registration_and_authentication',
    language: input.priorConsentLanguage ?? input.locale ?? 'ar',
    explicitConsent: true,
    sourceSurface: 'auth.signup.prior_consent',
    privacyNoticeVersionId: input.acknowledgedPrivacyVersionId,
  });

  // Marketing is optional and separate — never required for signup.
  if (input.marketingConsent?.email) {
    await grantConsent(user.id, {
      purposeCode: 'marketing_email',
      consentVersion: input.marketingConsent.consentVersion ?? 'signup-v1',
      noticeVersionId: input.marketingConsent.noticeVersionId,
      sourceSurface: 'auth.signup.marketing',
    });
  }
  if (input.marketingConsent?.sms) {
    await grantConsent(user.id, {
      purposeCode: 'marketing_sms',
      consentVersion: input.marketingConsent.consentVersion ?? 'signup-v1',
      noticeVersionId: input.marketingConsent.noticeVersionId,
      sourceSurface: 'auth.signup.marketing',
    });
  }

  return {
    userId: user.id,
    email: user.email,
    role: 'customer' as UserRole,
    pwdAt: passwordChangedAt.getTime(),
  };
}

export async function loginUser(input: LoginInput): Promise<SessionPayload> {
  const email = normalizeLoginEmail(input.email);

  // Identifier throttle first — same path for known and unknown emails.
  await assertLoginIdentifierNotThrottled(email);

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash) {
    await bcrypt.compare(input.password, await getDummyPasswordHash());
    await recordLoginIdentifierFailure(email);
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  if (user.status !== 'active') {
    // Preserve product suspension semantics without treating this as a password-guess signal.
    throw new AppError(403, 'ACCOUNT_SUSPENDED', 'Your account is not active');
  }

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) {
    await recordLoginIdentifierFailure(email);
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  await clearLoginIdentifierAbuse(email);

  // Keep identity table consistent for legacy accounts that predate UA-1 backfill.
  try {
    await ensurePasswordAuthIdentity(user.id, email);
  } catch {
    /* unique conflict owned by another user should not block login — log later if needed */
  }

  return {
    userId: user.id,
    email: user.email,
    role: user.role as UserRole,
    pwdAt: user.passwordChangedAt?.getTime() ?? 0,
  };
}

export async function getUserById(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      locale: true,
      status: true,
      createdAt: true,
      superAdmin: true,
      capabilityGrants: { select: { capability: true } },
      ownerProfile: {
        select: { status: true, rejectionReason: true },
      },
    },
  });

  if (!user || user.status !== 'active') {
    return null;
  }

  const { ownerProfile, capabilityGrants, ...rest } = user;
  return {
    ...rest,
    capabilities: capabilityGrants.map((g) => g.capability),
    ownerProfileStatus: ownerProfile?.status ?? null,
    ownerRejectionReason: ownerProfile?.rejectionReason ?? null,
  };
}
