/**
 * Phase 3C.4E.2B — Shared financial validation for provider capture
 * (webhook IPN and reconciliation must use the same rules).
 */
import { jodToFils } from './money';

export const CAPTURE_VALIDATION_CATEGORY = {
  AMOUNT_MISMATCH: 'PAYMENT_AMOUNT_MISMATCH',
  CURRENCY_MISMATCH: 'PAYMENT_CURRENCY_MISMATCH',
  REFERENCE_MISMATCH: 'PAYMENT_REFERENCE_MISMATCH',
  PURPOSE_MISMATCH: 'PAYMENT_PURPOSE_MISMATCH',
} as const;

export type CaptureValidationCategory =
  (typeof CAPTURE_VALIDATION_CATEGORY)[keyof typeof CAPTURE_VALIDATION_CATEGORY];

export type CaptureFinancialValidationResult =
  | { ok: true }
  | {
      ok: false;
      category: CaptureValidationCategory;
      message: string;
    };

export function filsAmountsEqual(
  expectedJod: number,
  providerJod: number | null | undefined,
): boolean {
  if (providerJod == null || !Number.isFinite(providerJod)) return false;
  return jodToFils(expectedJod) === jodToFils(providerJod);
}

export function currenciesEqual(
  expected: string,
  provider: string | null | undefined,
): boolean {
  if (!provider || !provider.trim()) return false;
  return expected.trim().toUpperCase() === provider.trim().toUpperCase();
}

/**
 * Validate provider-reported capture against the local Payment obligation.
 * Amount comparison uses integer fils — never floating-point equality.
 */
export function validateProviderCaptureAgainstPayment(params: {
  expectedAmountJod: number;
  expectedCurrency: string;
  /** When local Payment already has providerRef, provider must match. */
  expectedProviderRef?: string | null;
  expectedPurpose?: string | null;
  providerAmountJod?: number | null;
  providerCurrency?: string | null;
  providerRef?: string | null;
  /** Purpose parsed from cart_id when present. */
  cartPurpose?: string | null;
  /** When true, amount/currency are required (webhook success / reconcile). */
  requireAmountCurrency?: boolean;
}): CaptureFinancialValidationResult {
  const requireAC = params.requireAmountCurrency !== false;

  if (requireAC) {
    if (params.providerAmountJod == null || !Number.isFinite(params.providerAmountJod)) {
      return {
        ok: false,
        category: CAPTURE_VALIDATION_CATEGORY.AMOUNT_MISMATCH,
        message: 'Provider did not report a transaction amount',
      };
    }
    if (!filsAmountsEqual(params.expectedAmountJod, params.providerAmountJod)) {
      return {
        ok: false,
        category: CAPTURE_VALIDATION_CATEGORY.AMOUNT_MISMATCH,
        message: 'Provider amount does not match the internal payment',
      };
    }
    if (!params.providerCurrency?.trim()) {
      return {
        ok: false,
        category: CAPTURE_VALIDATION_CATEGORY.CURRENCY_MISMATCH,
        message: 'Provider did not report a currency',
      };
    }
    if (!currenciesEqual(params.expectedCurrency, params.providerCurrency)) {
      return {
        ok: false,
        category: CAPTURE_VALIDATION_CATEGORY.CURRENCY_MISMATCH,
        message: 'Provider currency does not match the internal payment',
      };
    }
  }

  if (
    params.expectedProviderRef &&
    params.providerRef &&
    params.expectedProviderRef.trim() !== params.providerRef.trim()
  ) {
    return {
      ok: false,
      category: CAPTURE_VALIDATION_CATEGORY.REFERENCE_MISMATCH,
      message: 'Provider transaction reference does not match the internal payment',
    };
  }

  if (
    params.cartPurpose &&
    params.expectedPurpose &&
    params.cartPurpose !== params.expectedPurpose
  ) {
    return {
      ok: false,
      category: CAPTURE_VALIDATION_CATEGORY.PURPOSE_MISMATCH,
      message: 'Provider cart purpose does not match the internal payment purpose',
    };
  }

  return { ok: true };
}
