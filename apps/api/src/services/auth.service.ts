import bcrypt from 'bcryptjs';
import { AuthIdentityProvider, prisma } from '@mazare3/db';
import type { LoginInput, SignupInput, UserRole } from '@mazare3/shared';
import { AppError } from '../lib/errors.js';
import type { SessionPayload } from '../lib/jwt.js';
import {
  assertLoginIdentifierNotThrottled,
  clearLoginIdentifierAbuse,
  normalizeLoginEmail,
  recordLoginIdentifierFailure,
} from './login-abuse.service.js';

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
      ownerProfile: {
        select: { status: true, rejectionReason: true },
      },
    },
  });

  if (!user || user.status !== 'active') {
    return null;
  }

  const { ownerProfile, ...rest } = user;
  return {
    ...rest,
    ownerProfileStatus: ownerProfile?.status ?? null,
    ownerRejectionReason: ownerProfile?.rejectionReason ?? null,
  };
}
