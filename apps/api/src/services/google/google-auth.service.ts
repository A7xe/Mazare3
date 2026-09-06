/**
 * UA-3 — Mazare3 Google account resolution (shared by Web callback + ID-token path).
 * Never stores Google access/refresh tokens.
 */
import { AuthIdentityProvider, Prisma, UserRole, UserStatus, prisma } from '@mazare3/db';
import type { UserRole as SharedUserRole } from '@mazare3/shared';
import { AppError } from '../../lib/errors.js';
import type { SessionPayload } from '../../lib/jwt.js';
import { signIdentityLinkIntent } from '../../lib/identity-link-intent.js';
import { getUserById } from '../auth.service.js';
import { normalizeLoginEmail } from '../login-abuse.service.js';
import type { VerifiedGoogleIdentity } from './google-oidc-client.js';

export type GoogleAuthAuthenticated = {
  outcome: 'authenticated';
  session: SessionPayload;
  user: NonNullable<Awaited<ReturnType<typeof getUserById>>>;
};

export type GoogleAuthLinkRequired = {
  outcome: 'existing_account_link_required';
  linkToken: string;
  expiresInSeconds: number;
};

export type GoogleAuthPrivilegedBlocked = {
  outcome: 'provider_not_allowed_for_privileged_account';
};

export type GoogleAuthResult =
  | GoogleAuthAuthenticated
  | GoogleAuthLinkRequired
  | GoogleAuthPrivilegedBlocked;

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

/** Display name from Google — never invent placeholders. Null if unusable. */
export function sanitizeGoogleDisplayName(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const name = String(raw).trim().replace(/\s+/g, ' ');
  if (name.length < 2 || name.length > 100) return null;
  return name;
}

function assertActiveUser(status: string): void {
  if (status !== UserStatus.active) {
    throw new AppError(403, 'ACCOUNT_SUSPENDED', 'Your account is not active');
  }
}

/**
 * Canonical Google identity → Mazare3 user resolution.
 * Web OIDC callback and future Flutter ID-token both call this.
 */
export async function resolveGoogleIdentity(
  identity: VerifiedGoogleIdentity,
  opts?: { locale?: 'ar' | 'en' },
): Promise<GoogleAuthResult> {
  const sub = identity.sub?.trim();
  if (!sub) {
    throw new AppError(401, 'GOOGLE_AUTH_FAILED', 'Google sign-in failed');
  }

  // 1) Existing Google AuthIdentity (keyed by stable sub)
  const existingIdentity = await prisma.authIdentity.findUnique({
    where: {
      provider_providerSubject: {
        provider: AuthIdentityProvider.google,
        providerSubject: sub,
      },
    },
    include: {
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

  if (existingIdentity) {
    assertActiveUser(existingIdentity.user.status);
    const session = sessionFromUser(existingIdentity.user);
    const user = await getUserById(session.userId);
    if (!user) {
      throw new AppError(403, 'ACCOUNT_SUSPENDED', 'Your account is not active');
    }
    // UA-3: do not silently mutate User.email when Google email changes.
    return { outcome: 'authenticated', session, user };
  }

  // 2) New Google identity — require verified email for account creation / collision
  const rawEmail = identity.email?.trim() ?? '';
  if (!rawEmail) {
    throw new AppError(
      400,
      'GOOGLE_EMAIL_REQUIRED',
      'Google did not provide an email address for this account',
    );
  }
  if (!identity.emailVerified) {
    throw new AppError(
      400,
      'GOOGLE_EMAIL_UNVERIFIED',
      'Google email must be verified to continue',
    );
  }

  const email = normalizeLoginEmail(rawEmail);
  const name = sanitizeGoogleDisplayName(identity.name);
  const locale = opts?.locale === 'en' ? 'en' : 'ar';

  const emailOwner = await prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true, status: true, passwordHash: true },
  });

  if (emailOwner) {
    if (emailOwner.role === UserRole.admin) {
      return { outcome: 'provider_not_allowed_for_privileged_account' };
    }

    // Customer or owner — explicit linking required (UA-4 IdentityLinkIntent).
    const { token, expiresInSeconds } = signIdentityLinkIntent({
      provider: 'google',
      providerSubject: sub,
      intendedUserId: emailOwner.id,
      verifiedEmail: email,
      verifiedAt: Date.now(),
    });
    return {
      outcome: 'existing_account_link_required',
      linkToken: token,
      expiresInSeconds,
    };
  }

  // 3) Create new customer + Google identity
  try {
    const created = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name,
          email,
          passwordHash: null,
          role: UserRole.customer,
          status: UserStatus.active,
          locale,
        },
      });

      await tx.authIdentity.create({
        data: {
          userId: user.id,
          provider: AuthIdentityProvider.google,
          providerSubject: sub,
          verifiedAt: new Date(),
        },
      });

      return user;
    });

    const session = sessionFromUser(created);
    const user = await getUserById(created.id);
    if (!user) {
      throw new AppError(500, 'INTERNAL_ERROR', 'Failed to load user after Google signup');
    }
    return { outcome: 'authenticated', session, user };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      // Concurrent create won on AuthIdentity unique — resolve again by sub.
      const raced = await prisma.authIdentity.findUnique({
        where: {
          provider_providerSubject: {
            provider: AuthIdentityProvider.google,
            providerSubject: sub,
          },
        },
        include: {
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
      if (raced) {
        assertActiveUser(raced.user.status);
        const session = sessionFromUser(raced.user);
        const user = await getUserById(session.userId);
        if (!user) {
          throw new AppError(403, 'ACCOUNT_SUSPENDED', 'Your account is not active');
        }
        return { outcome: 'authenticated', session, user };
      }
      // Email unique race without google identity — treat as link required
      const again = await prisma.user.findUnique({
        where: { email },
        select: { id: true, role: true },
      });
      if (again) {
        if (again.role === UserRole.admin) {
          return { outcome: 'provider_not_allowed_for_privileged_account' };
        }
        const { token, expiresInSeconds } = signIdentityLinkIntent({
          provider: 'google',
          providerSubject: sub,
          intendedUserId: again.id,
          verifiedEmail: email,
          verifiedAt: Date.now(),
        });
        return {
          outcome: 'existing_account_link_required',
          linkToken: token,
          expiresInSeconds,
        };
      }
    }
    throw err;
  }
}
