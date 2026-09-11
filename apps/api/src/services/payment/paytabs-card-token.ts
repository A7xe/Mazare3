import type { PaymentProvider } from '@mazare3/shared';

/**
 * Safe card metadata extracted from a trusted PayTabs success payload.
 * Never includes PAN/CVV or Managed Form temporary payment_token.
 */
export type PaytabsPersistentCardCapture = {
  /** Persistent PayTabs card token (NOT Managed Form payment_token). */
  providerToken: string;
  providerOriginalTransactionRef: string | null;
  brand: string | null;
  maskedDisplay: string | null;
  last4: string | null;
  expiryMonth: number | null;
  expiryYear: number | null;
};

const TEMP_TOKEN_HINT = /^(mf_|Dh|payment_)/i;

/**
 * Extract persistent card token + safe display fields from provider JSON.
 * Returns null when tokenisation did not yield a usable persistent token.
 */
export function extractPaytabsPersistentCardCapture(
  payload: unknown,
): PaytabsPersistentCardCapture | null {
  if (!payload || typeof payload !== 'object') return null;
  const root = payload as Record<string, unknown>;

  const tokenRaw =
    (typeof root.token === 'string' && root.token.trim()) ||
    (typeof (root.payment_result as Record<string, unknown> | undefined)?.token === 'string'
      ? String((root.payment_result as Record<string, unknown>).token).trim()
      : '');
  if (!tokenRaw || tokenRaw.length < 8) return null;
  // Guard: temporary Managed Form payment_token must never be vaulted.
  if (TEMP_TOKEN_HINT.test(tokenRaw) && tokenRaw.length < 20 && tokenRaw.startsWith('mf_')) {
    return null;
  }

  const paymentInfo =
    root.payment_info && typeof root.payment_info === 'object'
      ? (root.payment_info as Record<string, unknown>)
      : null;

  const brand =
    (typeof paymentInfo?.card_scheme === 'string' && paymentInfo.card_scheme.trim()) ||
    (typeof paymentInfo?.payment_method === 'string' && paymentInfo.payment_method.trim()) ||
    null;

  const description =
    (typeof paymentInfo?.payment_description === 'string' && paymentInfo.payment_description.trim()) ||
    (typeof root.payment_description === 'string' && root.payment_description.trim()) ||
    null;

  const last4 = deriveLast4(description, paymentInfo);
  const expiryMonth = parseExpiryPart(
    paymentInfo?.expiryMonth ?? paymentInfo?.expiry_month ?? root.expiryMonth,
  );
  const expiryYear = parseExpiryPart(
    paymentInfo?.expiryYear ?? paymentInfo?.expiry_year ?? root.expiryYear,
  );

  const maskedDisplay =
    description && /\*{2,}|\u2022{2,}|\d{4}\s*$/.test(description)
      ? description
      : brand && last4
        ? `${brand} •••• ${last4}`
        : last4
          ? `•••• ${last4}`
          : brand
            ? brand
            : null;

  const tranRef =
    (typeof root.tran_ref === 'string' && root.tran_ref.trim()) ||
    (typeof root.tranRef === 'string' && root.tranRef.trim()) ||
    null;

  return {
    providerToken: tokenRaw,
    providerOriginalTransactionRef: tranRef,
    brand,
    maskedDisplay,
    last4,
    expiryMonth,
    expiryYear,
  };
}

function deriveLast4(
  description: string | null,
  paymentInfo: Record<string, unknown> | null,
): string | null {
  const fromInfo =
    (typeof paymentInfo?.card_last4 === 'string' && paymentInfo.card_last4.trim()) ||
    (typeof paymentInfo?.last4 === 'string' && paymentInfo.last4.trim()) ||
    '';
  if (/^\d{4}$/.test(fromInfo)) return fromInfo;
  if (description) {
    const m = description.match(/(\d{4})\s*$/);
    if (m?.[1]) return m[1];
  }
  return null;
}

function parseExpiryPart(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return Math.trunc(raw);
  if (typeof raw === 'string' && /^\d{1,4}$/.test(raw.trim())) return Number(raw.trim());
  return null;
}

export type SavedPaymentMethodPublic = {
  id: string;
  provider: PaymentProvider;
  brand: string | null;
  maskedDisplay: string | null;
  last4: string | null;
  expiryMonth: number | null;
  expiryYear: number | null;
  isDefault: boolean;
  createdAt: string;
  /** Account UI: conclusively expired from stored expiry metadata. */
  expired?: boolean;
};
