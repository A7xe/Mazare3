import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '@mazare3/db';
import type { ForgotPasswordInput, ResetPasswordInput } from '@mazare3/shared';
import {
  PASSWORD_RESET_TOKEN_TTL_MS,
  getPasswordResetFrontendOrigin,
} from '../config/password-reset.js';
import { AppError } from '../lib/errors.js';
import { isAppEnvProduction } from '../config/app-env.js';
import { maskEmail } from '../lib/mask-email.js';
import { isPasswordResetDevLinkEnvEnabled } from '../lib/qa-mode.js';
import { getEmailProvider } from './email/get-email-provider.js';
import { renderPasswordResetEmail } from './email/templates/password-reset.js';
import { clearLoginIdentifierAbuse } from './login-abuse.service.js';

const BCRYPT_ROUNDS = 12;

const GENERIC_FORGOT_MESSAGE =
  'If an account exists for this email address, we will send password reset instructions.';

export function hashPasswordResetToken(rawToken: string): string {
  return createHash('sha256').update(rawToken, 'utf8').digest('hex');
}

export function generatePasswordResetToken(): string {
  return randomBytes(32).toString('base64url');
}

/** Dev/QA only — never in production. Requires explicit ENABLE_PASSWORD_RESET_DEV_LINK. */
export function isPasswordResetDevLinkEnabled(): boolean {
  if (isAppEnvProduction()) return false;
  return isPasswordResetDevLinkEnvEnabled();
}

function buildResetUrl(locale: string, rawToken: string): string {
  const origin = getPasswordResetFrontendOrigin();
  const loc = locale === 'en' ? 'en' : 'ar';
  return `${origin}/${loc}/reset-password?token=${encodeURIComponent(rawToken)}`;
}

async function invalidateResetToken(tokenId: string): Promise<void> {
  await prisma.passwordResetToken.updateMany({
    where: { id: tokenId, usedAt: null },
    data: { usedAt: new Date() },
  });
}

export type ForgotPasswordResult = {
  message: string;
  /** Present only when ENABLE_PASSWORD_RESET_DEV_LINK / internal QA is on and not production. */
  devResetLink?: string;
};

/**
 * Always returns the same generic message whether or not the email exists.
 * Does not reactivate suspended accounts; only active users with a password receive tokens.
 *
 * Delivery failure policy (AUTH-3):
 * - Provider accepts (ok) → token stays active until use / expiry / replacement
 * - Provider skipped (none / misconfigured) → token stays (local/dev recovery via gated link)
 * - Provider definitive failure → consume token so an undelivered link is not left active
 */
export async function requestPasswordReset(
  input: ForgotPasswordInput,
): Promise<ForgotPasswordResult> {
  const email = input.email.toLowerCase().trim();
  const result: ForgotPasswordResult = { message: GENERIC_FORGOT_MESSAGE };

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      locale: true,
      status: true,
      passwordHash: true,
    },
  });

  // Same timing path for missing / inactive / no-password / no-email users: no token created.
  if (!user || !user.email || user.status !== 'active' || !user.passwordHash) {
    return result;
  }

  const toEmail = user.email;

  const rawToken = generatePasswordResetToken();
  const tokenHash = hashPasswordResetToken(rawToken);
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS);

  const created = await prisma.$transaction(async (tx) => {
    await tx.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    return tx.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
      select: { id: true },
    });
  });

  const locale = user.locale === 'en' ? 'en' : 'ar';
  const resetUrl = buildResetUrl(locale, rawToken);
  const expiresMinutes = Math.round(PASSWORD_RESET_TOKEN_TTL_MS / 60_000);
  const content = renderPasswordResetEmail(locale, resetUrl, expiresMinutes);
  const provider = getEmailProvider();

  let deliveryOk = false;
  let deliverySkipped = false;

  try {
    const sendResult = await provider.send({
      to: toEmail,
      subject: content.subject,
      text: content.text,
      html: content.html,
    });

    if (sendResult.ok) {
      deliveryOk = true;
      console.info('[password-reset] password reset email accepted by provider', {
        code: 'EMAIL_ACCEPTED',
        provider: provider.name,
        providerRef: sendResult.providerRef,
        recipientMasked: maskEmail(toEmail),
      });
    } else if (sendResult.skipped) {
      deliverySkipped = true;
      console.info('[password-reset] password reset email skipped', {
        code: 'EMAIL_SKIPPED',
        provider: provider.name,
        reason: sendResult.errorMessage ?? 'skipped',
      });
    } else {
      console.error('[password-reset] email delivery failed', {
        code: 'EMAIL_SEND_FAILED',
        provider: provider.name,
        category: sendResult.errorMessage ?? 'provider_rejected',
      });
      await invalidateResetToken(created.id);
    }
  } catch {
    console.error('[password-reset] email delivery error', {
      code: 'EMAIL_SEND_ERROR',
      provider: provider.name,
    });
    await invalidateResetToken(created.id);
  }

  // Gated local/QA link only when the token remains usable.
  if (isPasswordResetDevLinkEnabled() && (deliveryOk || deliverySkipped)) {
    result.devResetLink = resetUrl;
  }

  return result;
}

export async function resetPasswordWithToken(input: ResetPasswordInput): Promise<void> {
  const tokenHash = hashPasswordResetToken(input.token.trim());
  const now = new Date();

  const row = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      userId: true,
      expiresAt: true,
      usedAt: true,
      user: { select: { id: true, status: true, email: true } },
    },
  });

  if (!row || row.usedAt || row.expiresAt.getTime() <= now.getTime()) {
    throw new AppError(
      400,
      'INVALID_RESET_TOKEN',
      'This password reset link is invalid or has expired.',
    );
  }

  // Do not reactivate suspended users — reject reset for non-active accounts.
  if (row.user.status !== 'active') {
    throw new AppError(
      400,
      'INVALID_RESET_TOKEN',
      'This password reset link is invalid or has expired.',
    );
  }

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: row.userId },
      data: {
        passwordHash,
        passwordChangedAt: now,
      },
    }),
    prisma.passwordResetToken.update({
      where: { id: row.id },
      data: { usedAt: now },
    }),
    prisma.passwordResetToken.updateMany({
      where: { userId: row.userId, usedAt: null, id: { not: row.id } },
      data: { usedAt: now },
    }),
  ]);

  // Clear stale login-failure cooldown so recovery is not immediately blocked.
  if (row.user.email) {
    await clearLoginIdentifierAbuse(row.user.email);
  }
}
