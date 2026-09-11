import { z } from 'zod';
import { PAYMENT_METHODS, PAYMENT_PURPOSES } from '../constants';

export const INITIAL_PAYMENT_CHOICES = ['deposit', 'full'] as const;
export type InitialPaymentChoiceInput = (typeof INITIAL_PAYMENT_CHOICES)[number];

export const createPaymentIntentSchema = z.object({
  bookingId: z.string().min(1),
  method: z.enum(PAYMENT_METHODS),
  purpose: z.enum(PAYMENT_PURPOSES).optional(),
  idempotencyKey: z.string().min(8).max(64).optional(),
  /** JIT payment contact — not an auth identity. Used when User lacks email/phone for PayTabs. */
  contactEmail: z.string().trim().min(3).max(254).optional(),
  contactPhone: z.string().trim().min(8).max(32).optional(),
  /**
   * CB-6 — Deposit vs Full for the FIRST payment only.
   * Server validates and maps to collection mode + PaymentPurpose. Never trusts amount.
   */
  initialPaymentChoice: z.enum(INITIAL_PAYMENT_CHOICES).optional(),
});

export type CreatePaymentIntentInput = z.infer<typeof createPaymentIntentSchema>;

/**
 * CB-4 Managed Form — temporary paylib payment_token only.
 * Amount, currency, purpose, and ownership are server-derived.
 * Never accepts PAN/CVV/expiry.
 */
export const createManagedFormPaymentSchema = z.object({
  bookingId: z.string().min(1),
  /** Temporary PayTabs Managed Form token from paylib.js — never persist long-term. */
  paymentToken: z
    .string()
    .trim()
    .min(8)
    .max(512)
    .regex(/^[A-Za-z0-9._\-+=]+$/, 'Invalid payment token'),
  idempotencyKey: z.string().min(8).max(64).optional(),
  contactEmail: z.string().trim().min(3).max(254).optional(),
  contactPhone: z.string().trim().min(8).max(32).optional(),
  /** CB-5A — explicit save-card opt-in. Default false; never required. */
  saveCard: z.boolean().optional().default(false),
  /** CB-6 — Deposit vs Full for first payment only. */
  initialPaymentChoice: z.enum(INITIAL_PAYMENT_CHOICES).optional(),
});

export type CreateManagedFormPaymentInput = z.infer<typeof createManagedFormPaymentSchema>;

/**
 * CB-5B — pay with a vaulted saved card.
 * Server resolves token/amount/purpose; never accepts providerToken/CVV/amount.
 */
export const createSavedCardPaymentSchema = z.object({
  bookingId: z.string().min(1),
  savedPaymentMethodId: z.string().min(1).max(64),
  idempotencyKey: z.string().min(8).max(64).optional(),
  contactEmail: z.string().trim().min(3).max(254).optional(),
  contactPhone: z.string().trim().min(8).max(32).optional(),
  /** CB-6 — Deposit vs Full for first payment only. */
  initialPaymentChoice: z.enum(INITIAL_PAYMENT_CHOICES).optional(),
});

export type CreateSavedCardPaymentInput = z.infer<typeof createSavedCardPaymentSchema>;
