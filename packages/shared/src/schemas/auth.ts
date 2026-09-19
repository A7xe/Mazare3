import { z } from 'zod';

export const signupSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100).optional(),
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password is too long'),
  locale: z.enum(['ar', 'en']).optional(),
  /** Explicit Terms acceptance — never bundled with Privacy or Marketing. */
  acceptedTermsVersionId: z.string().min(1),
  /** Privacy notice acknowledgement (not Prior Consent / marketing). */
  acknowledgedPrivacyVersionId: z.string().min(1),
  /**
   * Phase 3C.4B.1.4 — Jordan Prior Consent for account processing.
   * Distinct from Privacy Policy acknowledgement and Terms acceptance.
   */
  priorConsentAccount: z.literal(true),
  priorConsentLanguage: z.enum(['ar', 'en']).optional(),
  /** Optional separate marketing opt-in — never required for signup. */
  marketingConsent: z
    .object({
      email: z.boolean().optional(),
      sms: z.boolean().optional(),
      consentVersion: z.string().min(1).max(64).optional(),
      noticeVersionId: z.string().min(1).optional(),
    })
    .optional(),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

/** Same password rules as signup — authoritative for reset. */
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password is too long');

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(20, 'Invalid reset token').max(512),
  password: passwordSchema,
});

/** UA-2 — Phone OTP (backend). Server re-normalizes to E.164. */
export const phoneOtpStartSchema = z.object({
  phone: z.string().min(8).max(32),
  locale: z.enum(['ar', 'en']).optional(),
  returnUrl: z.string().max(2048).optional().nullable(),
});

export const phoneOtpVerifySchema = z.object({
  challengeId: z.string().min(8).max(64),
  phone: z.string().min(8).max(32),
  code: z.string().min(4).max(12),
  returnUrl: z.string().max(2048).optional().nullable(),
});

export const phoneOtpCompleteSchema = z.object({
  continueToken: z.string().min(20).max(4096),
  phone: z.string().min(8).max(32),
  name: z.string().min(2).max(100),
  locale: z.enum(['ar', 'en']).optional(),
});

/** UA-3 — Future Flutter / mobile Google ID token path (backend ready; no client yet). */
export const googleIdTokenSchema = z.object({
  idToken: z.string().min(20).max(8192),
  locale: z.enum(['ar', 'en']).optional(),
});

/** UA-4 — complete pending IdentityLinkIntent (cookie or body token). */
export const identityLinkCompleteSchema = z.object({
  /** Optional mobile path; Web prefers HttpOnly cookie. */
  linkToken: z.string().min(20).max(4096).optional(),
});

export const identityPhoneLinkStartSchema = z.object({
  phone: z.string().min(8).max(32),
  locale: z.enum(['ar', 'en']).optional(),
});

export const identityPhoneLinkVerifySchema = z.object({
  challengeId: z.string().min(8).max(64),
  phone: z.string().min(8).max(32),
  code: z.string().min(4).max(12),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type PhoneOtpStartInput = z.infer<typeof phoneOtpStartSchema>;
export type PhoneOtpVerifyInput = z.infer<typeof phoneOtpVerifySchema>;
export type PhoneOtpCompleteInput = z.infer<typeof phoneOtpCompleteSchema>;
export type GoogleIdTokenInput = z.infer<typeof googleIdTokenSchema>;
export type IdentityLinkCompleteInput = z.infer<typeof identityLinkCompleteSchema>;
export type IdentityPhoneLinkStartInput = z.infer<typeof identityPhoneLinkStartSchema>;
export type IdentityPhoneLinkVerifyInput = z.infer<typeof identityPhoneLinkVerifySchema>;
