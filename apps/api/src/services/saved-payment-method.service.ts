import { prisma, type PaymentProvider } from '@mazare3/db';
import type { SavedPaymentMethodPublic } from './payment/paytabs-card-token.js';
import {
  extractPaytabsPersistentCardCapture,
  type PaytabsPersistentCardCapture,
} from './payment/paytabs-card-token.js';
import {
  encryptPaymentVaultToken,
  fingerprintPaymentVaultToken,
  decryptPaymentVaultToken,
  isPaymentVaultEncryptionConfigured,
  redactPaymentVaultSecrets,
} from '../lib/payment-vault-crypto.js';
import { AppError } from '../lib/errors.js';
import { getPaymentGateway } from './payment/payment-provider.registry.js';
import { loadPaytabsConfig } from '../config/paytabs-config.js';
import { createAuditLog } from './audit.service.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';

export function isPaytabsTokenizationEnabled(): boolean {
  return process.env.PAYTABS_TOKENIZATION_ENABLED?.trim() === 'true';
}

/** Capability: tokenization feature + vault encryption ready (or mock provider). */
export function isSavedCardVaultCapabilityEnabled(): boolean {
  if (!isPaytabsTokenizationEnabled()) return false;
  const provider = (process.env.PAYMENT_GATEWAY_PROVIDER ?? process.env.PAYMENT_PROVIDER ?? 'mock')
    .trim()
    .toLowerCase();
  if (provider === 'mock' || provider === 'test') {
    // Mock vault uses encryption key when present; generate-local seam allows QA without real PayTabs.
    return isPaymentVaultEncryptionConfigured() || process.env.ENABLE_INTERNAL_QA_ROUTES === 'true';
  }
  return isPaymentVaultEncryptionConfigured();
}

export function toSavedPaymentMethodPublic(row: {
  id: string;
  provider: PaymentProvider;
  brand: string | null;
  maskedDisplay: string | null;
  last4: string | null;
  expiryMonth: number | null;
  expiryYear: number | null;
  isDefault: boolean;
  createdAt: Date;
}): SavedPaymentMethodPublic {
  const expired = isSavedCardExpired(row.expiryMonth, row.expiryYear);
  return {
    id: row.id,
    provider: row.provider as SavedPaymentMethodPublic['provider'],
    brand: row.brand,
    maskedDisplay: row.maskedDisplay,
    last4: row.last4,
    expiryMonth: row.expiryMonth,
    expiryYear: row.expiryYear,
    isDefault: row.isDefault,
    createdAt: row.createdAt.toISOString(),
    ...(expired ? { expired: true } : {}),
  };
}

/** True when expiryMonth/Year conclusively show the card is past its last valid month. */
export function isSavedCardExpired(
  expiryMonth: number | null | undefined,
  expiryYear: number | null | undefined,
  now: Date = new Date(),
): boolean {
  if (expiryMonth == null || expiryYear == null) return false;
  if (!Number.isFinite(expiryMonth) || !Number.isFinite(expiryYear)) return false;
  if (expiryMonth < 1 || expiryMonth > 12) return false;
  let year = Math.trunc(expiryYear);
  if (year < 100) year += 2000;
  // Card valid through end of expiry month.
  const lastValid = new Date(Date.UTC(year, expiryMonth, 0, 23, 59, 59, 999));
  return now.getTime() > lastValid.getTime();
}

/**
 * After authoritative payment success: persist PayTabs card token if customer opted in.
 * Idempotent on (userId, provider, token fingerprint). Never called from browser return alone.
 */
export async function maybeSavePaytabsCardAfterSuccess(args: {
  userId: string;
  paymentId: string;
  provider: PaymentProvider;
  providerRef: string | null;
  raw: unknown;
  saveCardRequested: boolean;
  req?: AuthenticatedRequest;
}): Promise<{ saved: boolean; reason: string }> {
  if (!args.saveCardRequested) {
    return { saved: false, reason: 'opt_in_false' };
  }
  if (!isPaytabsTokenizationEnabled()) {
    return { saved: false, reason: 'tokenization_disabled' };
  }
  if (args.provider !== 'paytabs' && args.provider !== 'test') {
    return { saved: false, reason: 'provider_unsupported' };
  }

  const capture = extractPaytabsPersistentCardCapture(args.raw);
  if (!capture?.providerToken) {
    return { saved: false, reason: 'no_persistent_token' };
  }

  await upsertSavedPaymentMethod({
    userId: args.userId,
    provider: args.provider === 'test' ? 'test' : 'paytabs',
    capture: {
      ...capture,
      providerOriginalTransactionRef:
        capture.providerOriginalTransactionRef ?? args.providerRef,
    },
    req: args.req,
    paymentId: args.paymentId,
  });

  return { saved: true, reason: 'saved' };
}

export async function upsertSavedPaymentMethod(args: {
  userId: string;
  provider: PaymentProvider;
  capture: PaytabsPersistentCardCapture;
  paymentId?: string;
  req?: AuthenticatedRequest;
}): Promise<SavedPaymentMethodPublic> {
  const fingerprint = fingerprintPaymentVaultToken(args.capture.providerToken);
  const cipher = encryptPaymentVaultToken(args.capture.providerToken);

  const existing = await prisma.savedPaymentMethod.findUnique({
    where: {
      userId_provider_providerTokenFingerprint: {
        userId: args.userId,
        provider: args.provider,
        providerTokenFingerprint: fingerprint,
      },
    },
  });

  const activeCount = await prisma.savedPaymentMethod.count({
    where: { userId: args.userId, revokedAt: null },
  });

  if (existing) {
    const updated = await prisma.savedPaymentMethod.update({
      where: { id: existing.id },
      data: {
        providerTokenCipher: cipher,
        providerOriginalTransactionRef:
          args.capture.providerOriginalTransactionRef ?? existing.providerOriginalTransactionRef,
        brand: args.capture.brand ?? existing.brand,
        maskedDisplay: args.capture.maskedDisplay ?? existing.maskedDisplay,
        last4: args.capture.last4 ?? existing.last4,
        expiryMonth: args.capture.expiryMonth ?? existing.expiryMonth,
        expiryYear: args.capture.expiryYear ?? existing.expiryYear,
        revokedAt: null,
        isDefault: existing.isDefault || activeCount === 0,
      },
    });
    return toSavedPaymentMethodPublic(updated);
  }

  const created = await prisma.savedPaymentMethod.create({
    data: {
      userId: args.userId,
      provider: args.provider,
      providerTokenCipher: cipher,
      providerTokenFingerprint: fingerprint,
      providerOriginalTransactionRef: args.capture.providerOriginalTransactionRef,
      brand: args.capture.brand,
      maskedDisplay: args.capture.maskedDisplay,
      last4: args.capture.last4,
      expiryMonth: args.capture.expiryMonth,
      expiryYear: args.capture.expiryYear,
      isDefault: activeCount === 0,
    },
  });

  await createAuditLog({
    actorUserId: args.userId,
    action: 'payment_method.saved',
    entityType: 'saved_payment_method',
    entityId: created.id,
    metadata: {
      provider: args.provider,
      brand: created.brand,
      last4: created.last4,
      paymentId: args.paymentId ?? null,
      // Never log providerToken.
    },
    req: args.req,
  });

  return toSavedPaymentMethodPublic(created);
}

export async function listSavedPaymentMethodsForUser(
  userId: string,
): Promise<SavedPaymentMethodPublic[]> {
  const rows = await prisma.savedPaymentMethod.findMany({
    where: { userId, revokedAt: null },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
  });
  return rows.map(toSavedPaymentMethodPublic);
}

/** Checkout-usable cards only: active, non-revoked, not conclusively expired. */
export async function listCheckoutSavedPaymentMethodsForUser(
  userId: string,
): Promise<SavedPaymentMethodPublic[]> {
  const rows = await listSavedPaymentMethodsForUser(userId);
  return rows.filter((m) => !m.expired);
}

/**
 * Load owned active saved method for charging. IDOR-safe: wrong user → NOT_FOUND.
 * Decrypts token as late as possible; caller must not log plaintext.
 */
export async function loadSavedPaymentMethodForCharge(
  userId: string,
  methodId: string,
): Promise<{
  id: string;
  provider: PaymentProvider;
  providerToken: string;
  providerOriginalTransactionRef: string | null;
  brand: string | null;
  last4: string | null;
}> {
  const row = await prisma.savedPaymentMethod.findFirst({
    where: { id: methodId, userId, revokedAt: null },
  });
  if (!row) {
    throw new AppError(404, 'NOT_FOUND', 'Payment method not found');
  }
  if (isSavedCardExpired(row.expiryMonth, row.expiryYear)) {
    throw new AppError(400, 'SAVED_CARD_EXPIRED', 'This saved card has expired');
  }
  let providerToken: string;
  try {
    providerToken = decryptPaymentVaultToken(row.providerTokenCipher);
  } catch {
    throw new AppError(503, 'PAYMENT_VAULT_DECRYPT_FAILED', 'Could not unlock saved card');
  }
  return {
    id: row.id,
    provider: row.provider,
    providerToken,
    providerOriginalTransactionRef: row.providerOriginalTransactionRef,
    brand: row.brand,
    last4: row.last4,
  };
}

/** Soft-revoke when provider conclusively reports invalid/revoked token. */
export async function markSavedPaymentMethodInvalidToken(
  userId: string,
  methodId: string,
  req?: AuthenticatedRequest,
): Promise<void> {
  const row = await prisma.savedPaymentMethod.findFirst({
    where: { id: methodId, userId, revokedAt: null },
  });
  if (!row) return;
  await prisma.savedPaymentMethod.update({
    where: { id: row.id },
    data: { revokedAt: new Date(), isDefault: false },
  });
  if (row.isDefault) {
    const next = await prisma.savedPaymentMethod.findFirst({
      where: { userId, revokedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    if (next) {
      await prisma.savedPaymentMethod.update({
        where: { id: next.id },
        data: { isDefault: true },
      });
    }
  }
  await createAuditLog({
    actorUserId: userId,
    action: 'payment_method.invalid_token',
    entityType: 'saved_payment_method',
    entityId: row.id,
    metadata: { provider: row.provider, brand: row.brand, last4: row.last4 },
    req,
  });
}

export async function setDefaultSavedPaymentMethod(
  userId: string,
  methodId: string,
  req?: AuthenticatedRequest,
): Promise<SavedPaymentMethodPublic> {
  const row = await prisma.savedPaymentMethod.findFirst({
    where: { id: methodId, userId, revokedAt: null },
  });
  if (!row) throw new AppError(404, 'NOT_FOUND', 'Payment method not found');

  await prisma.$transaction([
    prisma.savedPaymentMethod.updateMany({
      where: { userId, revokedAt: null, isDefault: true },
      data: { isDefault: false },
    }),
    prisma.savedPaymentMethod.update({
      where: { id: row.id },
      data: { isDefault: true },
    }),
  ]);

  const updated = await prisma.savedPaymentMethod.findUniqueOrThrow({ where: { id: row.id } });
  await createAuditLog({
    actorUserId: userId,
    action: 'payment_method.default_set',
    entityType: 'saved_payment_method',
    entityId: updated.id,
    metadata: { provider: updated.provider },
    req,
  });
  return toSavedPaymentMethodPublic(updated);
}

export async function revokeSavedPaymentMethod(
  userId: string,
  methodId: string,
  req?: AuthenticatedRequest,
): Promise<{ revoked: true }> {
  const row = await prisma.savedPaymentMethod.findFirst({
    where: { id: methodId, userId },
  });
  if (!row) throw new AppError(404, 'NOT_FOUND', 'Payment method not found');
  if (row.revokedAt) return { revoked: true };

  let plaintext: string | null = null;
  try {
    plaintext = decryptPaymentVaultToken(row.providerTokenCipher);
  } catch {
    plaintext = null;
  }

  if (plaintext && (row.provider === 'paytabs' || row.provider === 'test')) {
    try {
      const gateway = getPaymentGateway(row.provider);
      if ('deleteCardToken' in gateway && typeof gateway.deleteCardToken === 'function') {
        const result = await gateway.deleteCardToken({ token: plaintext });
        if (result.status === 'failed') {
          throw new AppError(
            502,
            'PROVIDER_TOKEN_REVOKE_FAILED',
            'Could not revoke card with payment provider',
          );
        }
      }
    } catch (err) {
      if (err instanceof AppError) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      if (!/NOT_FOUND|ALREADY|INVALID|404/i.test(msg)) {
        console.info(
          '[saved-payment-method] provider revoke failed',
          redactPaymentVaultSecrets(msg.slice(0, 120), plaintext ? [plaintext] : []),
        );
        throw new AppError(
          502,
          'PROVIDER_TOKEN_REVOKE_FAILED',
          'Could not revoke card with payment provider',
        );
      }
    }
  }

  await prisma.savedPaymentMethod.update({
    where: { id: row.id },
    data: { revokedAt: new Date(), isDefault: false },
  });

  if (row.isDefault) {
    const next = await prisma.savedPaymentMethod.findFirst({
      where: { userId, revokedAt: null },
      orderBy: { createdAt: 'asc' },
    });
    if (next) {
      await prisma.savedPaymentMethod.update({
        where: { id: next.id },
        data: { isDefault: true },
      });
    }
  }

  await createAuditLog({
    actorUserId: userId,
    action: 'payment_method.revoked',
    entityType: 'saved_payment_method',
    entityId: row.id,
    metadata: { provider: row.provider, brand: row.brand, last4: row.last4 },
    req,
  });

  return { revoked: true };
}

/** Read saveCardRequested from the latest intent event (never from browser alone). */
export async function paymentRequestedSaveCard(paymentId: string): Promise<boolean> {
  const ev = await prisma.paymentEvent.findFirst({
    where: { paymentId, action: 'payment.intent_created' },
    orderBy: { createdAt: 'desc' },
    select: { metadata: true },
  });
  const meta = ev?.metadata as { saveCardRequested?: boolean } | null;
  return meta?.saveCardRequested === true;
}

export { loadPaytabsConfig };
