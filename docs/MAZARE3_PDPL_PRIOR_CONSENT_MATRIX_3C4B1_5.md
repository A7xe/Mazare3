# Mazare3 — Jordan PDPL Prior Consent Matrix (Phase 3C.4B.1.5)

**INTERNAL ONLY — not a Privacy Policy. Not a public document.**  
Supersedes `docs/MAZARE3_PDPL_PRIOR_CONSENT_MATRIX_3C4B1_4.md` (retained as history).

Contractual package: **`1.1.2-advisor-final`** (unchanged). Privacy Policy: **NOT finalised**.  
`dpoAppointed`: **false**. Production: **not touched**.

SSOT: `packages/shared/src/privacy-processing-inventory.ts` + overlay  
Purposes: `packages/shared/src/jordan-prior-consent.ts`  
Evidence: `DataProcessingConsent` (≠ optional `PrivacyConsent`)

---

## How to read statuses

| Label | Meaning |
|-------|---------|
| **CONFIRMED TECHNICAL GATE** | API (+ usually UI) blocks new processing without active Prior Consent |
| **LEGAL BASIS PENDING COUNSEL** | Status is a candidate / review — **not** counsel-confirmed |
| `PRIOR_CONSENT_CONFIRMED` | Architecture supports collection for this purpose (not “all users consented”) |
| `ARTICLE_6_5_LEGISLATIVE_DUTY_PENDING_COUNSEL` | Art. 6(A)(5) candidate — **not** confirmed |
| `DURATION_REQUIRES_LEGAL_REVIEW` | No invented years / forever; **Production blocker** |

---

## Matrix

| Activity | Purpose | Data categories | Sensitive | Legal basis status | Prior Consent purpose | Art. 6(A)(5) candidate | Collection point | Duration | Withdrawal effect | Re-consent | Runtime gate | Counsel question |
|----------|---------|-----------------|-----------|--------------------|----------------------|------------------------|------------------|----------|-------------------|------------|--------------|------------------|
| Customer account | Account auth/ops | name, email, phone?, hash, locale | No | PRIOR_CONSENT_CONFIRMED | `account_registration_and_authentication` | — | Registration / first-run | DURATION_REQUIRES_LEGAL_REVIEW | Future gated; DSR remains | purpose/version | Account closure vs withdrawal |
| Google OAuth | Federated sign-in | google_sub, email | No | LEGAL_BASIS_COUNSEL_REVIEW_REQUIRED | account purpose after gate | — | First-run (cannot bypass) | DURATION_REQUIRES_LEGAL_REVIEW | Same as account | purpose/version | Minimal **pre-consent** OAuth exchange basis |
| Booking | Marketplace Booking | ids, dates, guests, amounts | Financial | PRIOR_CONSENT_CONFIRMED | `marketplace_booking_processing` | — | Booking panel | DURATION_REQUIRES_LEGAL_REVIEW | No new Bookings; retain economics | purpose/version | Retention after withdrawal |
| Payment/refund metadata | Payments (no PAN/CVV) | amounts, status, refs | Financial | PRIOR_CONSENT_CONFIRMED | `payment_and_refund_processing` | — | Booking/payment | DURATION_REQUIRES_LEGAL_REVIEW | Ledger retained | purpose/version | Retention |
| Saved payment token | Token only | provider token meta | Financial | PRIOR_CONSENT_CONFIRMED | `saved_payment_method_processing` | — | Save-card | DURATION_REQUIRES_LEGAL_REVIEW | Stop future use | purpose/version | Token deletion |
| Owner KYC | Identity/authority | docs | High-risk possible | PRIOR_CONSENT_CONFIRMED | `owner_identity_and_authority_verification` | — | Before upload | DURATION_REQUIRES_LEGAL_REVIEW | No new uploads; retention review | purpose/version | Cross-border + retention |
| Owner IBAN/payout | Settlements | IBAN, bank, beneficiary | Financial sensitive | PRIOR_CONSENT_CONFIRMED | `owner_payout_and_financial_processing` | — | Before IBAN save | DURATION_REQUIRES_LEGAL_REVIEW | Due payouts preserved | purpose/version | Retention |
| Exact Property location | Exact address/coords/arrival | exactAddress, lat/lng exact, arrival | Operational high | PRIOR_CONSENT_CONFIRMED | `property_and_exact_location_processing` | — | Create/update exact fields | DURATION_REQUIRES_LEGAL_REVIEW | No new writes; historic Bookings not hidden solely for missing historic consent | purpose/version | Approx vs exact boundary |
| Public listing media | Listing photos | media | No | PRIOR_CONSENT_REQUIRED | (grouped with location purpose) | — | Listing media | DURATION_REQUIRES_LEGAL_REVIEW | Review | purpose/version | Separate gate vs Owner account |
| Marketplace support/dispute | Support tickets / disputes | free text | Sensitive possible | PRIOR_CONSENT_CONFIRMED | `support_and_dispute_processing` | — | Ticket/dispute create (auth) | DURATION_REQUIRES_LEGAL_REVIEW | Future gated; **DSR separate** | purpose/version | Guest support without account |
| Optional marketing/analytics/cookies | Optional | prefs | No | optional PrivacyConsent | marketing_* / analytics / cookies | — | Preferences (unchecked) | DURATION_REQUIRES_LEGAL_REVIEW | Stop future optional | purpose/version | — |
| Legal acceptance evidence | Terms/Privacy ack | hashes, versions | No | ARTICLE_6_5_LEGISLATIVE_DUTY_PENDING_COUNSEL | — | Yes (pending) | On ack | DURATION_REQUIRES_LEGAL_REVIEW | n/a | n/a | Confirm Art. 6(A)(5) |
| Transactional notifications | Booking/payment/security notices | delivery meta | No | LEGAL_BASIS_COUNSEL_REVIEW_REQUIRED | Map to booking/payment purposes where Prior Consent already valid; security/breach → Art. 6(A)(5) candidate | Security/breach: Yes (pending) | System | DURATION_REQUIRES_LEGAL_REVIEW | n/a | n/a | Map each template; never marketing |
| DSR / privacy complaint | Rights exercise | request meta | Possible | ARTICLE_6_5_LEGISLATIVE_DUTY_PENDING_COUNSEL | — (**must not require Prior Consent**) | Yes (pending) | Privacy portal | DURATION_REQUIRES_LEGAL_REVIEW | Portal stays open after withdrawal | n/a | Confirm statutory duty |
| Security / audit logs | Security measures vs telemetry | actor, actions | No | ARTICLE_6_5_LEGISLATIVE_DUTY_PENDING_COUNSEL (statutory security candidate only; telemetry remains counsel review — minimise) | — | Security Instructions / PDPL candidate | System | DURATION_REQUIRES_LEGAL_REVIEW | n/a | n/a | Split security vs product telemetry |
| Personal-data breach Art. 20 | Breach response | incident meta | High-risk possible | ARTICLE_6_5_LEGISLATIVE_DUTY_PENDING_COUNSEL | — (**no consent checkbox**) | Yes (Art. 20) | Admin breach console | DURATION_REQUIRES_LEGAL_REVIEW | Must continue | n/a | Confirm Art. 20 basis |

---

## Runtime gate summary (3C.4B.1.5)

| Gate | Status |
|------|--------|
| Registration account Prior Consent | **CONFIRMED TECHNICAL GATE** |
| Google first-run Prior Consent | **CONFIRMED TECHNICAL GATE** (pre-consent OAuth = LEGAL BASIS PENDING COUNSEL) |
| Booking + payment Prior Consent | **CONFIRMED TECHNICAL GATE** |
| KYC upload | **CONFIRMED TECHNICAL GATE** |
| Payout IBAN | **CONFIRMED TECHNICAL GATE** |
| Exact location create/update | **CONFIRMED TECHNICAL GATE** |
| Marketplace support / dispute | **CONFIRMED TECHNICAL GATE** (authenticated) |
| DSR / privacy complaint | **GATE_NOT_REQUIRED** (statutory; Art. 6(A)(5) pending) |
| Breach Art. 20 | **GATE_NOT_REQUIRED** (statutory; Art. 6(A)(5) pending) |
| Public listing media | **GATE_PENDING** |
| Consent duration (Art. 5) | **Production blocker** until counsel defines |

Approximate / public location (city, area, approximateAddress, approx coords) does **not** require exact-location Prior Consent.

---

## Withdrawal (summary)

Stops future consent-dependent processing. Does **not** block: refunds/due payouts, DSR/privacy complaints, breach investigation, lawful retention evidence. Unresolved retention = `LEGAL_REVIEW_REQUIRED`.

---

## Production readiness blockers (explicit)

1. Unresolved Prior Consent **duration** for required purposes  
2. Missing technical gates (`GATE_PENDING` activities)  
3. Privacy Policy **not finalised**  
4. Unresolved legal bases where processing would begin without Prior Consent or confirmed Art. 6  
5. Do **not** block DSR/breach solely because Prior Consent is absent  

---

## Remaining counsel questions

1. Google OAuth minimal pre-consent identity exchange  
2. Confirm Art. 6(A)(5) for DSR, privacy complaints, Art. 20 breach, security measures  
3. Consent duration / event-based validity per purpose  
4. Withdrawal vs retention for Booking/payment/KYC/IBAN/exact location  
5. Whether listing media needs a separate gate beyond exact-location / owner account consent  
6. Guest (unauthenticated) general support lawful basis  

---

*End of internal matrix — Phase 3C.4B.1.5*
