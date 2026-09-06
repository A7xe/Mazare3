/**
 * UA-4 — Canonical AuthIdentity linking (no User merge).
 */
import { AuthIdentityProvider, Prisma, UserRole, UserStatus, prisma } from '@mazare3/db';
import { AppError } from '../lib/errors.js';
import {
  isIdentityLinkIntentConsumed,
  markIdentityLinkIntentConsumed,
  verifyIdentityLinkIntent,
  type IdentityLinkIntent,
  type IdentityLinkProvider,
} from '../lib/identity-link-intent.js';
import { getUserById } from './auth.service.js';
import { normalizeLoginEmail } from './login-abuse.service.js';

export type CompleteIdentityLinkInput = {
  authenticatedUserId: string;
  /** Signed IdentityLinkIntent (cookie or mobile body). */
  linkIntentToken: string;
};

export type CompleteIdentityLinkResult = {
  outcome: 'linked' | 'already_linked';
  user: NonNullable<Awaited<ReturnType<typeof getUserById>>>;
  provider: IdentityLinkProvider;
  returnUrl: string | null;
};

async function loadActiveLinkableUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      passwordHash: true,
    },
  });
  if (!user || user.status !== UserStatus.active) {
    throw new AppError(403, 'ACCOUNT_SUSPENDED', 'Your account is not active');
  }
  if (user.role === UserRole.admin) {
    throw new AppError(
      403,
      'PROVIDER_NOT_ALLOWED_FOR_PRIVILEGED_ACCOUNT',
      'This account type cannot link phone or Google',
    );
  }
  return user;
}

/**
 * Attach a verified provider identity to the authenticated User.
 * Requires IdentityLinkIntent bound to the same userId.
 */
export async function completeIdentityLink(
  input: CompleteIdentityLinkInput,
): Promise<CompleteIdentityLinkResult> {
  const intent = verifyIdentityLinkIntent(input.linkIntentToken);

  if (isIdentityLinkIntentConsumed(intent.jti)) {
    throw new AppError(409, 'IDENTITY_LINK_INTENT_USED', 'This linking step was already used');
  }

  const sessionUser = await loadActiveLinkableUser(input.authenticatedUserId);

  if (intent.intendedUserId !== sessionUser.id) {
    console.warn('[api] identity-link: account mismatch', {
      provider: intent.provider,
      category: 'account_mismatch',
    });
    throw new AppError(
      403,
      'IDENTITY_LINK_ACCOUNT_MISMATCH',
      'Sign in to the account that matches this linking request',
    );
  }

  return attachProviderIdentity({
    userId: sessionUser.id,
    provider: intent.provider,
    providerSubject: intent.providerSubject,
    verifiedEmail: intent.verifiedEmail ?? null,
    intent,
  });
}

/**
 * Proactive / OAuth-link-mode attachment when the authenticated User is already proven
 * and provider proof is fresh (no pending collision intent).
 */
export async function linkProviderToAuthenticatedUser(input: {
  authenticatedUserId: string;
  provider: IdentityLinkProvider;
  providerSubject: string;
  verifiedEmail?: string | null;
  emailVerified?: boolean;
}): Promise<CompleteIdentityLinkResult> {
  const sessionUser = await loadActiveLinkableUser(input.authenticatedUserId);
  return attachProviderIdentity({
    userId: sessionUser.id,
    provider: input.provider,
    providerSubject: input.providerSubject,
    verifiedEmail:
      input.emailVerified === false ? null : (input.verifiedEmail ?? null),
    intent: null,
  });
}

async function attachProviderIdentity(params: {
  userId: string;
  provider: IdentityLinkProvider;
  providerSubject: string;
  verifiedEmail: string | null;
  intent: IdentityLinkIntent | null;
}): Promise<CompleteIdentityLinkResult> {
  const providerEnum =
    params.provider === 'phone' ? AuthIdentityProvider.phone : AuthIdentityProvider.google;
  const now = new Date();

  const existing = await prisma.authIdentity.findUnique({
    where: {
      provider_providerSubject: {
        provider: providerEnum,
        providerSubject: params.providerSubject,
      },
    },
    select: { userId: true },
  });

  if (existing) {
    if (existing.userId === params.userId) {
      if (params.intent) markIdentityLinkIntentConsumed(params.intent.jti);
      const user = await getUserById(params.userId);
      if (!user) throw new AppError(403, 'ACCOUNT_SUSPENDED', 'Your account is not active');
      return {
        outcome: 'already_linked',
        user,
        provider: params.provider,
        returnUrl: params.intent?.returnUrl ?? null,
      };
    }
    throw new AppError(
      409,
      'IDENTITY_ALREADY_LINKED',
      'This identity is already linked to another account',
    );
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.authIdentity.create({
        data: {
          userId: params.userId,
          provider: providerEnum,
          providerSubject: params.providerSubject,
          verifiedAt: now,
        },
      });

      // Phone-first / null-email: optionally populate User.email from verified Google email.
      if (params.provider === 'google' && params.verifiedEmail) {
        const email = normalizeLoginEmail(params.verifiedEmail);
        const current = await tx.user.findUnique({
          where: { id: params.userId },
          select: { email: true },
        });
        if (current && current.email == null) {
          const taken = await tx.user.findUnique({
            where: { email },
            select: { id: true },
          });
          if (!taken) {
            await tx.user.update({
              where: { id: params.userId },
              data: { email },
            });
          }
        }
      }
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const raced = await prisma.authIdentity.findUnique({
        where: {
          provider_providerSubject: {
            provider: providerEnum,
            providerSubject: params.providerSubject,
          },
        },
        select: { userId: true },
      });
      if (raced?.userId === params.userId) {
        if (params.intent) markIdentityLinkIntentConsumed(params.intent.jti);
        const user = await getUserById(params.userId);
        if (!user) throw new AppError(403, 'ACCOUNT_SUSPENDED', 'Your account is not active');
        return {
          outcome: 'already_linked',
          user,
          provider: params.provider,
          returnUrl: params.intent?.returnUrl ?? null,
        };
      }
      throw new AppError(
        409,
        'IDENTITY_ALREADY_LINKED',
        'This identity is already linked to another account',
      );
    }
    throw err;
  }

  if (params.intent) markIdentityLinkIntentConsumed(params.intent.jti);

  console.warn('[api] identity-link: success', {
    provider: params.provider,
    category: 'identity_link_success',
  });

  const user = await getUserById(params.userId);
  if (!user) throw new AppError(403, 'ACCOUNT_SUSPENDED', 'Your account is not active');
  return {
    outcome: 'linked',
    user,
    provider: params.provider,
    returnUrl: params.intent?.returnUrl ?? null,
  };
}

/** Assert caller may start proactive linking. */
export async function assertUserMayLinkIdentities(userId: string): Promise<void> {
  await loadActiveLinkableUser(userId);
}
