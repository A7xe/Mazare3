# Phase 3C.1 — Retention Matrix (Internal)

**Status:** Internal matrix for founder + Jordanian counsel — **not legal advice**.  
**Rule:** Exact statutory periods are **not invented**. Unless an operational period is genuinely known from product behavior, use:

**RETENTION PERIOD REQUIRES JORDANIAN LEGAL REVIEW**

Extends [phase3b-privacy-retention-map.md](./phase3b-privacy-retention-map.md). Categories match the Phase 3C.1 brief.

Related: [phase3c1-jordan-pdpl-compliance-gap.md](./phase3c1-jordan-pdpl-compliance-gap.md), [phase3b-legal-consent-architecture.md](./phase3b-legal-consent-architecture.md).

---

## Matrix

| Category | Purpose | Current technical behavior | Operational need | Deletion / anonymization | Proposed retention category | Exact period |
|----------|---------|----------------------------|------------------|--------------------------|-----------------------------|--------------|
| **Account** | Identify users; marketplace participation | `User` profile (email/name/locale/role); soft/hard delete paths subject to DSR + legal holds | Service delivery; fraud/abuse; support | Erasure via DSR where lawfully required; financial/booking links may block hard-delete | Account life + post-closure archive | **RETENTION PERIOD REQUIRES JORDANIAN LEGAL REVIEW** |
| **Authentication** | Sign-in security | `AuthIdentity` (password / phone / google); `passwordHash`; session cookies / JWT short-lived | Account security | Cascade with account where allowed; password hashes never exported | Same as account / until credential change | Session: short-lived (ops). Credentials: **RETENTION PERIOD REQUIRES JORDANIAN LEGAL REVIEW** |
| **Booking** | Fulfil marketplace bookings | `Booking` + slot/property links; `BookingLegalSnapshot`; reschedule / incident links | Contract performance; disputes; finance | Prefer anonymize over hard-delete when holds apply | Booking + related financial window | **RETENTION PERIOD REQUIRES JORDANIAN LEGAL REVIEW** |
| **Payment** | Capture / status / provider refs | `Payment` amounts, status, PayTabs refs; **no PAN/CVV** in Mazare3 DB | Settlement; refunds; tax/accounting | Anonymize personal fields if legally required while keeping aggregates | Financial / tax archive | **RETENTION PERIOD REQUIRES JORDANIAN LEGAL REVIEW** |
| **Refund** | Customer refunds of captured funds | `RefundRequest` (+ PSP process); durable workflow | Consumer fairness; audit; PSP reconciliation | Keep with payment/booking evidence | Financial / dispute archive | **RETENTION PERIOD REQUIRES JORDANIAN LEGAL REVIEW** |
| **Disputes / incidents** | Arrival problems, reports, evidence | `BookingIncident` and related evidence text | Safety; fairness; admin decisions | Restricted access; delete/anonymize only after counsel rules | Case resolution + archive | **RETENTION PERIOD REQUIRES JORDANIAN LEGAL REVIEW** |
| **Check-in** | Arrival / handover evidence | `checkInCodeHash` + salt; status timestamps; plaintext shown once | Prove arrival for disputes | Hashes may outlive plaintext; no GPS | Booking / dispute window | **RETENTION PERIOD REQUIRES JORDANIAN LEGAL REVIEW** |
| **Support** | Customer/owner help | Support ticket tables / notifications (as implemented) | Service quality; complaints | May contain personal data in free text | Case life + archive | **RETENTION PERIOD REQUIRES JORDANIAN LEGAL REVIEW** |
| **Reviews** | Eligible booking reviews | Review system records; moderation/hide | Trust & safety; moderation | Hide ≠ erase; erasure subject to policy/law | Content + moderation log | **RETENTION PERIOD REQUIRES JORDANIAN LEGAL REVIEW** |
| **Owner KYC** | Partner verification / payout readiness | Private R2 + `OwnerDocument` / owner profile fields | Compliance; fraud; settlement eligibility | Restricted; not for marketing | Verification purpose + archive | **RETENTION PERIOD REQUIRES JORDANIAN LEGAL REVIEW** |
| **Bank / payout** | Owner settlement destination | IBAN / payout proofs (encrypted/fingerprint + private files); admin mark-paid flows | Pay owners; anti-fraud | High sensitivity; minimize access | Settlement / AML-relevant archive | **RETENTION PERIOD REQUIRES JORDANIAN LEGAL REVIEW** |
| **Settlements** | Owner net payouts / adjustments | Payout records; `OwnerFinancialAdjustment`; commission snapshots | Commercial accounting | Prefer retain financial truth; anonymize personal where possible | Financial archive | **RETENTION PERIOD REQUIRES JORDANIAN LEGAL REVIEW** |
| **Legal acceptance evidence** | Prove which version was accepted | Immutable `LegalAcceptance`; never fabricate; no silent mutation of ACTIVE published versions | Contract proof; ETL evidentiary posture | Do not silent-delete without legal basis | Indefinite proof of contract (ops intent) — post-termination archive period | **RETENTION PERIOD REQUIRES JORDANIAN LEGAL REVIEW** |
| **Privacy consents** | Optional purpose consents | `PrivacyConsent` grant/withdraw; re-grant = new row; history retained after withdraw | PDPL consent proof | Proof of grant/withdrawal often must outlive marketing use | Consent evidence archive | **RETENTION PERIOD REQUIRES JORDANIAN LEGAL REVIEW** (marketing use until withdrawn + proof retention) |
| **DSR** | Access / erasure / etc. requests | `DataSubjectRequest` lifecycle + admin notes | Demonstrate rights handling | Admin notes may contain personal data | Request lifecycle + compliance archive | **RETENTION PERIOD REQUIRES JORDANIAN LEGAL REVIEW** |
| **Audit / security logs** | Accountability | `AuditLog` (verification, legal publish, cancel/refund events, etc.); prefer hashed IP only when documented | Security; abuse; legal publish trail | Minimize PII in logs | Security / ops archive | **RETENTION PERIOD REQUIRES JORDANIAN LEGAL REVIEW** |
| **Reliability incidents** | Owner reliability / no-show / cancel outcomes | `OwnerReliabilityIncident` (internal; not public scoring) | Marketplace fairness; penalties | Internal only | Ops + dispute archive | **RETENTION PERIOD REQUIRES JORDANIAN LEGAL REVIEW** |

---

## Principles (non-statutory)

1. Contract evidence (`LegalAcceptance`) is kept to prove what was accepted — distinct from marketing consent.  
2. Privacy acknowledgement ≠ optional processing consent.  
3. Financial and KYC records may lawfully outlive a general erasure request — status may be `rejected_with_reason`.  
4. Do not invent Jordanian tax or company-law retention years in product copy until counsel confirms them.  
5. Cancellation **retention of captured funds** (policy charge) is a **financial policy** concept — not a personal-data retention period.

---

## FOUNDER / COUNSEL INPUT REQUIRED

- Exact periods for each row above under Jordan PDPL No. 24/2023, tax/commercial laws, and Consumer Protection Law No. 7/2017 as applicable.  
- Whether KYC and payout data have longer mandatory holds.  
- Production deletion jobs (if any) must not run until this matrix is counsel-approved.
