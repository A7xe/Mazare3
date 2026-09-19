# Mazare3 — Jordan PDPL Prior Consent Matrix (Phase 3C.4B.1.4)

> **SUPERSEDED** by [`docs/MAZARE3_PDPL_PRIOR_CONSENT_MATRIX_3C4B1_5.md`](./MAZARE3_PDPL_PRIOR_CONSENT_MATRIX_3C4B1_5.md)  
> Kept as history for Phase 3C.4B.1.4. Do not treat this file as current SSOT.

**INTERNAL ONLY — not a Privacy Policy. Not a public document.**

Local / DEV architecture draft. Legal bases and durations are **not** invented as confirmed
except where the product has implemented Prior Consent collection (`PRIOR_CONSENT_CONFIRMED`
= architecture ready, not “all users consented”).

Contractual customer package remains **`1.1.2-advisor-final`**. Privacy Policy remains **NOT finalised**.
`dpoAppointed` remains **false**. Production must **not** be touched.

SSOT inventory: `packages/shared/src/privacy-processing-inventory.ts`  
Purpose defs: `packages/shared/src/jordan-prior-consent.ts`  
Evidence model: `DataProcessingConsent` (distinct from optional `PrivacyConsent`)

---

## Legend

| Column | Meaning |
|--------|---------|
| Prior Consent required? | Whether Arts 4–5 Prior Consent is treated as required pending counsel |
| Article 6 exception review | Jordan statutory exception status — **not** GDPR LI/contract |
| Duration status | Always review until counsel defines fixed/event duration |
| Withdrawal effect | Operational consequence; uncertain items = legal review |

---

## Matrix

| # | Processing activity | Personal-data categories | Sensitive financial/KYC | Prior Consent required? | Article 6 exception review | Consent purpose key | Consent collection point | Duration status | Withdrawal effect | Re-consent trigger | Open legal questions |
|---|---------------------|--------------------------|-------------------------|-------------------------|----------------------------|---------------------|--------------------------|-----------------|-------------------|--------------------|----------------------|
| 1 | Customer account registration & profile | name, email, phone?, password_hash, locale, auth_identities | No | Yes | NOT_APPLICABLE | `account_registration_and_authentication` | Registration / first-run gate | DURATION_REQUIRES_LEGAL_REVIEW | WITHDRAWAL_EFFECT_LEGAL_REVIEW_REQUIRED | purpose/version change | Account closure vs withdrawal interaction |
| 2 | Google OAuth authentication | google_sub, linked email | No | Yes (full marketplace after gate) | Minimal pre-consent exchange: LEGAL_BASIS_COUNSEL_REVIEW_REQUIRED | `account_registration_and_authentication` | First-run legal gate (cannot bypass) | DURATION_REQUIRES_LEGAL_REVIEW | WITHDRAWAL_EFFECT_LEGAL_REVIEW_REQUIRED | purpose/version change | Lawful basis for Google’s minimal identity return **before** Prior Consent UI |
| 3 | Marketplace Booking | booking ids, dates, guests, amounts, status, user link | Financial-sensitive amounts | Yes | NOT_APPLICABLE | `marketplace_booking_processing` | Booking panel (if missing) | DURATION_REQUIRES_LEGAL_REVIEW | STATUTORY_PROCESSING_MAY_CONTINUE_REVIEW_REQUIRED | purpose/version change | Whether completed Booking records may continue under separate statutory basis after withdrawal |
| 4 | Payment / refund metadata (no PAN/CVV) | amounts, status, provider_ref, masked display | Financial-sensitive | Yes | NOT_APPLICABLE | `payment_and_refund_processing` | Booking panel / payment flows | DURATION_REQUIRES_LEGAL_REVIEW | STATUTORY_PROCESSING_MAY_CONTINUE_REVIEW_REQUIRED | purpose/version change | Retention of payment evidence after consent withdrawal |
| 5 | Saved payment method token (not PAN/CVV) | provider token metadata | Financial-sensitive | Yes | NOT_APPLICABLE | `saved_payment_method_processing` | Save-card opt-in | DURATION_REQUIRES_LEGAL_REVIEW | STOPS_FUTURE_CONSENT_DEPENDENT_PROCESSING | purpose/version change | Token deletion vs PSP retention |
| 6 | Owner KYC / authority docs | identity docs, authority docs | HIGH_RISK / sensitive-possible | Yes | NOT_APPLICABLE | `owner_identity_and_authority_verification` | Before KYC upload | DURATION_REQUIRES_LEGAL_REVIEW | STATUTORY_PROCESSING_MAY_CONTINUE_REVIEW_REQUIRED | purpose/version; document category expansion | Cross-border storage geography not finalised; retention period |
| 7 | Owner IBAN / payout | IBAN, bank, beneficiary | SENSITIVE_PERSONAL_DATA_FINANCIAL | Yes | NOT_APPLICABLE | `owner_payout_and_financial_processing` | Before payout profile save | DURATION_REQUIRES_LEGAL_REVIEW | STATUTORY_PROCESSING_MAY_CONTINUE_REVIEW_REQUIRED | purpose/version change | Settlement legal retention vs withdrawal |
| 8 | Exact Property location | coords, arrival instructions | No (high operational risk) | Yes | NOT_APPLICABLE | `property_and_exact_location_processing` | Property create / exact location save (**gate PENDING** — PRIOR_CONSENT_REQUIRED) | DURATION_REQUIRES_LEGAL_REVIEW | WITHDRAWAL_EFFECT_LEGAL_REVIEW_REQUIRED | purpose/version change | Whether listing operation can rely on Owner account consent alone |
| 9 | Public listing media | photos, captions | No | Yes (grouped) | NOT_APPLICABLE | `property_and_exact_location_processing` | Listing create (**gate PENDING**) | DURATION_REQUIRES_LEGAL_REVIEW | WITHDRAWAL_EFFECT_LEGAL_REVIEW_REQUIRED | purpose/version change | Public display vs private processing |
| 10 | Support / disputes / reviews free text | free text, attachments | SENSITIVE_DATA_POSSIBLE | Yes | NOT_APPLICABLE | `support_and_dispute_processing` | Ticket/dispute create (**gate PENDING** — PRIOR_CONSENT_REQUIRED) | DURATION_REQUIRES_LEGAL_REVIEW | WITHDRAWAL_EFFECT_LEGAL_REVIEW_REQUIRED | purpose/version change | Minimisation + sensitive content handling |
| 11 | Owner account / marketplace operation | owner profile fields | Mixed | Yes | NOT_APPLICABLE | `owner_account_and_marketplace_operation` | Become-owner entry (purpose defined; progressive) | DURATION_REQUIRES_LEGAL_REVIEW | WITHDRAWAL_EFFECT_LEGAL_REVIEW_REQUIRED | purpose/version change | Interaction with KYC/payout purposes |
| 12 | Optional marketing / analytics / cookies | email/SMS prefs, analytics flags | No | Optional only | NOT_APPLICABLE | PrivacyConsent: `marketing_email`, `marketing_sms`, `personalized_analytics`, `optional_cookies` | Preferences / signup optional box (unchecked) | DURATION_REQUIRES_LEGAL_REVIEW | STOPS_FUTURE_CONSENT_DEPENDENT_PROCESSING | purpose/version change | Remain unbundled from Prior Consent |
| 13 | Legal acceptance evidence | acceptance hashes, versions | No | No (evidence of notice/Terms) | ARTICLE_6_EXCEPTION_REVIEW_REQUIRED | — | On Terms/Privacy ack | DURATION_REQUIRES_LEGAL_REVIEW | NOT_APPLICABLE | n/a | Statutory retention of acceptance evidence |
| 14 | Transactional notifications | email/SMS delivery metadata | No | No forced consent | ARTICLE_6_EXCEPTION_REVIEW_REQUIRED | — | System | DURATION_REQUIRES_LEGAL_REVIEW | NOT_APPLICABLE | n/a | Distinguish from marketing |
| 15 | DSR / privacy complaint records | request metadata | Possible | No forced consent | ARTICLE_6_EXCEPTION_REVIEW_REQUIRED | — | Rights exercise | DURATION_REQUIRES_LEGAL_REVIEW | NOT_APPLICABLE | n/a | Retention of rights exercise logs |
| 16 | Security / audit logs | actor ids, actions | No | No — do not force consent | ARTICLE_6_EXCEPTION_REVIEW_REQUIRED | — | System | DURATION_REQUIRES_LEGAL_REVIEW | NOT_APPLICABLE | n/a | Security obligation vs Prior Consent default |
| 17 | Personal-data breach response | incident metadata, subject refs | High-risk possible | No — do not force consent | ARTICLE_6_EXCEPTION_REVIEW_REQUIRED | — | Admin breach console | DURATION_REQUIRES_LEGAL_REVIEW | NOT_APPLICABLE | n/a | Art. 20 operational duty |

---

## Entry-point audit (processing start vs consent)

| Entry point | When processing begins today (post-3C.4B.1.4) |
|-------------|-----------------------------------------------|
| Registration | After Terms + Privacy ack + **Prior Consent** (`account_registration_and_authentication`) |
| Google OAuth | Minimal identity may arrive **before** first-run Prior Consent UI → counsel review; marketplace gated |
| Profile | After account Prior Consent (existing users: MISSING until next gated action) |
| Booking | After purpose Prior Consents (booking + payment) if missing |
| Payment / saved method | Payment purpose at booking; saved-method purpose defined (token save gate architecture) |
| Reviews / support | Inventory: PRIOR_CONSENT_REQUIRED — progressive gate **not yet enforced** |
| Check-in | Tied to Booking lifecycle — counsel on exception vs Booking consent |
| Owner onboarding | Account/owner purposes; KYC gated before upload; payout gated before IBAN |
| Auth/session, fraud, audit, breach | Mapped to Article 6 **review** — no artificial consent |

---

## Existing users

- **No fabricated** `DataProcessingConsent` rows.
- Validity = `MISSING_PRIOR_CONSENT` until explicit grant.
- Do **not** block refunds, due payouts, historical record access, or privacy rights solely for missing historic consent.

---

## Blocking / open counsel questions

1. Lawful basis for Google OAuth minimal pre-consent identity exchange.
2. Confirmed Article 6 exceptions for security/audit/breach/DSR/transactional notices.
3. Consent **duration** / event-based validity per purpose (no fabricated years).
4. Withdrawal effect on completed Booking / payment / KYC / IBAN retention.
5. Whether Property exact-location / listing media need separate Prior Consent gates beyond Owner account consent.
6. Support/dispute free-text Prior Consent gate timing.
7. Final Privacy Policy drafting (deferred — Phase 3C.4B.2+).

---

*End of internal matrix — Phase 3C.4B.1.4*
