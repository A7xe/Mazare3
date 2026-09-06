/**
 * UA-2 / UA-4 — Phone OTP auth + legacy collision link intents + proactive link_phone.
 */
import {
  AuthIdentityProvider,
  OtpChallengePurpose,
  Prisma,
  UserRole,
  UserStatus,
  prisma,
} from '@mazare3/db';
import type { UserRole as SharedUserRole } from '@mazare3/shared';
import { sanitizeReturnUrl } from '@mazare3/shared';
import {
  PHONE_OTP_MAX_ATTEMPTS,
  PHONE_OTP_RESEND_COOLDOWN_MS,
  PHONE_OTP_TTL_MS,
  PHONE_PROFILE_CONTINUE_TTL_MS,
} from '../config/phone-otp-config.js';
import { AppError } from '../lib/errors.js';
import type { SessionPayload } from '../lib/jwt.js';
import { signIdentityLinkIntent } from '../lib/identity-link-intent.js';
import {
  signPhoneContinueToken,
  verifyPhoneContinueToken,
} from '../lib/phone-continuation-jwt.js';
import {
  generateSecureNumericOtp,
  hashPhoneOtpCode,
  hashPhoneOtpIdentifier,
  timingSafeEqualHex,
} from '../lib/phone-otp-crypto.js';
import { normalizeJordanPhoneE164, tryNormalizeJordanPhoneE164 } from '../lib/phone-normalize.js';
import { getSmsOtpProvider } from './sms/get-sms-otp-provider.js';
import { getUserById } from './auth.service.js';
import {
  assertUserMayLinkIdentities,
  linkProviderToAuthenticatedUser,
} from './identity-link.service.js';

const AUTH_PURPOSE = OtpChallengePurpose.auth_continue;
const LINK_PURPOSE = OtpChallengePurpose.link_phone;

export type PhoneStartResult = {
  challengeId: string;
  expiresInSeconds: number;
  resendAfterSeconds: number;
};

export type PhoneVerifyAuthenticated = {
  outcome: 'authenticated';
  session: SessionPayload;
  user: NonNullable<Awaited<ReturnType<typeof getUserById>>>;
};

export type PhoneVerifyProfileRequired = {
  outcome: 'profile_required';
  continueToken: string;
  expiresInSeconds: number;
};

export type PhoneVerifyLinkRequired = {
  outcome: 'existing_account_link_required';
  linkToken: string;
  expiresInSeconds: number;
};

export type PhoneVerifyResult =
  | PhoneVerifyAuthenticated
  | PhoneVerifyProfileRequired
  | PhoneVerifyLinkRequired;

export type PhoneCompleteResult = PhoneVerifyAuthenticated;

function sessionFromUser(user: {
  id: string;
  email: string | null;
  role: string;
  passwordChangedAt: Date | null;
}): SessionPayload {
  return {
    userId: user.id,
    email: user.email,
    role: user.role as SharedUserRole,
    pwdAt: user.passwordChangedAt?.getTime() ?? 0,
  };
}

async function purgeExpiredChallengesOpportunistic(): Promise<void> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  await prisma.otpChallenge
    .deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() }, consumedAt: { not: null } },
          { expiresAt: { lt: cutoff } },
        ],
      },
    })
    .catch(() => undefined);
}

async function issuePhoneOtpChallenge(input: {
  phone: string;
  locale?: 'ar' | 'en';
  purpose: typeof AUTH_PURPOSE | typeof LINK_PURPOSE;
}): Promise<PhoneStartResult> {
  const e164 = normalizeJordanPhoneE164(input.phone);
  const identifierHash = hashPhoneOtpIdentifier(e164);
  const locale = input.locale === 'en' ? 'en' : 'ar';
  const purpose = input.purpose;
  const now = new Date();

  await purgeExpiredChallengesOpportunistic();

  const active = await prisma.otpChallenge.findFirst({
    where: {
      identifierHash,
      purpose,
      consumedAt: null,
      expiresAt: { gt: now },
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true, lastSentAt: true, createdAt: true },
  });

  if (active) {
    const lastSent = active.lastSentAt ?? active.createdAt;
    const elapsed = now.getTime() - lastSent.getTime();
    if (elapsed < PHONE_OTP_RESEND_COOLDOWN_MS) {
      const waitSec = Math.ceil((PHONE_OTP_RESEND_COOLDOWN_MS - elapsed) / 1000);
      throw new AppError(
        429,
        'PHONE_OTP_RESEND_COOLDOWN',
        'Please wait before requesting another code',
        { resendAfterSeconds: waitSec },
      );
    }
  }

  const code = generateSecureNumericOtp();
  const expiresAt = new Date(now.getTime() + PHONE_OTP_TTL_MS);

  const challenge = await prisma.$transaction(async (tx) => {
    await tx.otpChallenge.updateMany({
      where: {
        identifierHash,
        purpose,
        consumedAt: null,
      },
      data: { consumedAt: now, updatedAt: now },
    });

    const created = await tx.otpChallenge.create({
      data: {
        identifierHash,
        codeHash: 'pending',
        purpose,
        attempts: 0,
        expiresAt,
        lastSentAt: now,
      },
    });

    const codeHash = hashPhoneOtpCode(created.id, code);
    return tx.otpChallenge.update({
      where: { id: created.id },
      data: { codeHash },
      select: { id: true, expiresAt: true },
    });
  });

  const provider = getSmsOtpProvider();
  const send = await provider.sendOtp({
    toE164: e164,
    code,
    locale,
    expiresInMinutes: Math.round(PHONE_OTP_TTL_MS / 60_000),
  });

  if (!send.ok) {
    await prisma.otpChallenge
      .update({
        where: { id: challenge.id },
        data: { consumedAt: new Date() },
      })
      .catch(() => undefined);
    throw new AppError(
      503,
      'PHONE_AUTH_UNAVAILABLE',
      'Phone authentication is temporarily unavailable',
    );
  }

  return {
    challengeId: challenge.id,
    expiresInSeconds: Math.max(1, Math.floor((challenge.expiresAt.getTime() - Date.now()) / 1000)),
    resendAfterSeconds: Math.ceil(PHONE_OTP_RESEND_COOLDOWN_MS / 1000),
  };
}

export async function startPhoneOtp(input: {
  phone: string;
  locale?: 'ar' | 'en';
  returnUrl?: string | null;
}): Promise<PhoneStartResult> {
  void sanitizeReturnUrl(input.returnUrl);
  return issuePhoneOtpChallenge({
    phone: input.phone,
    locale: input.locale,
    purpose: AUTH_PURPOSE,
  });
}

/** UA-4 — authenticated proactive phone link OTP (purpose=link_phone). */
export async function startPhoneLinkOtp(input: {
  authenticatedUserId: string;
  phone: string;
  locale?: 'ar' | 'en';
}): Promise<PhoneStartResult> {
  await assertUserMayLinkIdentities(input.authenticatedUserId);
  return issuePhoneOtpChallenge({
    phone: input.phone,
    locale: input.locale,
    purpose: LINK_PURPOSE,
  });
}

async function consumeVerifiedOtpChallenge(input: {
  challengeId: string;
  phone: string;
  code: string;
  purpose: typeof AUTH_PURPOSE | typeof LINK_PURPOSE;
}): Promise<{ e164: string; identifierHash: string }> {
  const e164 = normalizeJordanPhoneE164(input.phone);
  const identifierHash = hashPhoneOtpIdentifier(e164);
  const code = String(input.code ?? '').trim();
  if (!/^\d{6}$/.test(code)) {
    throw new AppError(400, 'INVALID_OTP', 'Invalid verification code');
  }

  const now = new Date();
  const challenge = await prisma.otpChallenge.findUnique({
    where: { id: input.challengeId },
  });

  if (
    !challenge ||
    challenge.purpose !== input.purpose ||
    challenge.identifierHash !== identifierHash ||
    challenge.consumedAt ||
    challenge.expiresAt.getTime() <= now.getTime()
  ) {
    throw new AppError(400, 'INVALID_OTP', 'Invalid or expired verification code');
  }

  if (challenge.attempts >= PHONE_OTP_MAX_ATTEMPTS) {
    throw new AppError(400, 'OTP_ATTEMPTS_EXCEEDED', 'Too many attempts. Request a new code');
  }

  const expectedHash = hashPhoneOtpCode(challenge.id, code);
  const ok = timingSafeEqualHex(expectedHash, challenge.codeHash);

  if (!ok) {
    const updated = await prisma.$queryRaw<{ id: string; attempts: number }[]>`
      UPDATE "OtpChallenge"
      SET "attempts" = "attempts" + 1, "updatedAt" = ${now}
      WHERE "id" = ${challenge.id}
        AND "consumedAt" IS NULL
        AND "expiresAt" > ${now}
        AND "attempts" < ${PHONE_OTP_MAX_ATTEMPTS}
      RETURNING "id", "attempts"
    `;
    if (!updated.length || (updated[0]?.attempts ?? 0) >= PHONE_OTP_MAX_ATTEMPTS) {
      await prisma.otpChallenge
        .updateMany({
          where: { id: challenge.id, consumedAt: null },
          data: { consumedAt: now },
        })
        .catch(() => undefined);
      throw new AppError(400, 'OTP_ATTEMPTS_EXCEEDED', 'Too many attempts. Request a new code');
    }
    throw new AppError(400, 'INVALID_OTP', 'Invalid or expired verification code');
  }

  const consumed = await prisma.$queryRaw<{ id: string }[]>`
    UPDATE "OtpChallenge"
    SET "consumedAt" = ${now}, "updatedAt" = ${now}
    WHERE "id" = ${challenge.id}
      AND "consumedAt" IS NULL
      AND "expiresAt" > ${now}
      AND "attempts" < ${PHONE_OTP_MAX_ATTEMPTS}
    RETURNING "id"
  `;
  if (!consumed.length) {
    throw new AppError(400, 'INVALID_OTP', 'Invalid or expired verification code');
  }

  return { e164, identifierHash };
}

export async function verifyPhoneOtp(input: {
  challengeId: string;
  phone: string;
  code: string;
  returnUrl?: string | null;
}): Promise<PhoneVerifyResult> {
  const { e164, identifierHash } = await consumeVerifiedOtpChallenge({
    challengeId: input.challengeId,
    phone: input.phone,
    code: input.code,
    purpose: AUTH_PURPOSE,
  });

  const identity = await prisma.authIdentity.findUnique({
    where: {
      provider_providerSubject: {
        provider: AuthIdentityProvider.phone,
        providerSubject: e164,
      },
    },
    select: {
      userId: true,
      user: {
        select: {
          id: true,
          email: true,
          role: true,
          status: true,
          passwordChangedAt: true,
        },
      },
    },
  });

  if (identity) {
    if (identity.user.status !== UserStatus.active) {
      throw new AppError(403, 'ACCOUNT_SUSPENDED', 'Your account is not active');
    }
    const session = sessionFromUser(identity.user);
    const user = await getUserById(identity.user.id);
    if (!user) {
      throw new AppError(403, 'ACCOUNT_SUSPENDED', 'Your account is not active');
    }
    return { outcome: 'authenticated', session, user };
  }

  const legacyUsers = await prisma.user.findMany({
    where: { phone: { not: null } },
    select: { id: true, phone: true, role: true, status: true },
    take: 5000,
  });
  const legacyMatches = legacyUsers.filter(
    (u) => tryNormalizeJordanPhoneE164(u.phone) === e164,
  );

  if (legacyMatches.length >= 1) {
    if (legacyMatches.length !== 1) {
      throw new AppError(
        409,
        'EXISTING_ACCOUNT_LINK_REQUIRED',
        'This phone is associated with an existing account. Sign in to link it later.',
      );
    }
    const target = legacyMatches[0]!;
    if (target.role === UserRole.admin) {
      throw new AppError(
        403,
        'PROVIDER_NOT_ALLOWED_FOR_PRIVILEGED_ACCOUNT',
        'This account type cannot link phone or Google',
      );
    }
    if (target.status !== UserStatus.active) {
      throw new AppError(403, 'ACCOUNT_SUSPENDED', 'Your account is not active');
    }
    const safeReturn = sanitizeReturnUrl(input.returnUrl);
    const { token, expiresInSeconds } = signIdentityLinkIntent({
      provider: 'phone',
      providerSubject: e164,
      intendedUserId: target.id,
      verifiedAt: Date.now(),
      returnUrl: safeReturn,
    });
    return {
      outcome: 'existing_account_link_required',
      linkToken: token,
      expiresInSeconds,
    };
  }

  const challenge = await prisma.otpChallenge.findUnique({
    where: { id: input.challengeId },
    select: { id: true },
  });
  const safeReturn = sanitizeReturnUrl(input.returnUrl);
  const continueToken = signPhoneContinueToken({
    challengeId: challenge?.id ?? input.challengeId,
    identifierHash,
    returnUrl: safeReturn,
  });

  return {
    outcome: 'profile_required',
    continueToken,
    expiresInSeconds: Math.max(60, Math.floor(PHONE_PROFILE_CONTINUE_TTL_MS / 1000)),
  };
}

/** UA-4 — verify link_phone OTP and attach phone AuthIdentity to authenticated User. */
export async function verifyPhoneLinkOtp(input: {
  authenticatedUserId: string;
  challengeId: string;
  phone: string;
  code: string;
}): Promise<{ outcome: 'linked' | 'already_linked'; user: NonNullable<Awaited<ReturnType<typeof getUserById>>> }> {
  await assertUserMayLinkIdentities(input.authenticatedUserId);
  const { e164 } = await consumeVerifiedOtpChallenge({
    challengeId: input.challengeId,
    phone: input.phone,
    code: input.code,
    purpose: LINK_PURPOSE,
  });

  const result = await linkProviderToAuthenticatedUser({
    authenticatedUserId: input.authenticatedUserId,
    provider: 'phone',
    providerSubject: e164,
  });
  return { outcome: result.outcome, user: result.user };
}

export async function completePhoneProfile(input: {
  continueToken: string;
  phone: string;
  name: string;
  locale?: 'ar' | 'en';
}): Promise<PhoneCompleteResult> {
  const e164 = normalizeJordanPhoneE164(input.phone);
  const identifierHash = hashPhoneOtpIdentifier(e164);
  const name = input.name.trim();
  if (name.length < 2 || name.length > 100) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Name must be between 2 and 100 characters');
  }

  const proof = verifyPhoneContinueToken(input.continueToken);
  if (proof.identifierHash !== identifierHash) {
    throw new AppError(400, 'INVALID_CONTINUE_TOKEN', 'This step has expired. Please verify again.');
  }

  const challenge = await prisma.otpChallenge.findUnique({
    where: { id: proof.challengeId },
    select: { id: true, identifierHash: true, consumedAt: true, purpose: true },
  });
  if (
    !challenge ||
    challenge.purpose !== AUTH_PURPOSE ||
    challenge.identifierHash !== identifierHash ||
    !challenge.consumedAt
  ) {
    throw new AppError(400, 'INVALID_CONTINUE_TOKEN', 'This step has expired. Please verify again.');
  }

  const existingIdentity = await prisma.authIdentity.findUnique({
    where: {
      provider_providerSubject: {
        provider: AuthIdentityProvider.phone,
        providerSubject: e164,
      },
    },
    select: { userId: true },
  });
  if (existingIdentity) {
    throw new AppError(409, 'CONTINUE_TOKEN_USED', 'This verification step was already used');
  }

  const legacyUsers = await prisma.user.findMany({
    where: { phone: { not: null } },
    select: { id: true, phone: true },
    take: 5000,
  });
  if (legacyUsers.some((u) => tryNormalizeJordanPhoneE164(u.phone) === e164)) {
    throw new AppError(
      409,
      'EXISTING_ACCOUNT_LINK_REQUIRED',
      'This phone is associated with an existing account. Sign in and link from account settings.',
    );
  }

  const locale = input.locale === 'en' ? 'en' : 'ar';
  const now = new Date();

  let userId: string;
  try {
    userId = await prisma.$transaction(async (tx) => {
      const gate = await tx.$queryRaw<{ id: string }[]>`
        UPDATE "OtpChallenge"
        SET "attempts" = ${PHONE_OTP_MAX_ATTEMPTS + 100}, "updatedAt" = ${now}
        WHERE "id" = ${challenge.id}
          AND "consumedAt" IS NOT NULL
          AND "attempts" < ${PHONE_OTP_MAX_ATTEMPTS + 100}
        RETURNING "id"
      `;
      if (!gate.length) {
        throw new AppError(409, 'CONTINUE_TOKEN_USED', 'This verification step was already used');
      }

      const created = await tx.user.create({
        data: {
          name,
          email: null,
          passwordHash: null,
          role: 'customer',
          status: 'active',
          locale,
        },
        select: { id: true },
      });

      await tx.authIdentity.create({
        data: {
          userId: created.id,
          provider: AuthIdentityProvider.phone,
          providerSubject: e164,
          verifiedAt: now,
        },
      });

      return created.id;
    });
  } catch (err) {
    if (err instanceof AppError) throw err;
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new AppError(409, 'CONTINUE_TOKEN_USED', 'This verification step was already used');
    }
    throw err;
  }

  const row = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { id: true, email: true, role: true, passwordChangedAt: true },
  });
  const session = sessionFromUser(row);
  const user = await getUserById(userId);
  if (!user) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Account created but session unavailable');
  }
  return { outcome: 'authenticated', session, user };
}
