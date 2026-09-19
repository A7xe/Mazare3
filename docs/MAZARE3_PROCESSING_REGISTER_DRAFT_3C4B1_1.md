# Mazare3 — Processing Register Draft (Phase 3C.4B.1.1)

**Classification:** INTERNAL draft register — not a Ministry submission.  
**Status:** Supersedes `docs/MAZARE3_PROCESSING_REGISTER_DRAFT_3C4B1.md` for future review (prior file retained as history).  
**SSOT:** `packages/shared/src/privacy-processing-inventory.ts` (`PRIVACY_PROCESSING_ACTIVITIES`, `PRIVACY_PROCESSORS`)  
**Date:** 2026-09-14

---

## 1. Controller

| Field | Value |
|-------|-------|
| Legal entity (AR) | شركة الرجل الوطواط للتكنولوجيا |
| Legal entity (EN) | BATMAN TECHNOLOGY |
| Product brand | Mazare3 Jordan / مزارع الأردن |
| Role | Controller for Mazare3 marketplace processing (counsel to confirm per activity) |

---

## 2. DPO / contact readiness

| Field | Status |
|-------|--------|
| Appointed | `dpoAppointed = false` |
| Internal candidate | `INTERNAL_DPO_CANDIDATE` (not published) |
| Requirement | `DPO_APPOINTMENT_REQUIRED_PENDING_FORMALISATION` |
| Accreditation | `REQUIRES_SCOPE_CHECK` (ICT sector listed; entity-specific applicability pending) |
| Public contact | `NOT_PUBLISHED` until formalisation |

---

## 3. Processing activities (summary)

| Key | Sensitive classification | Notes |
|-----|--------------------------|-------|
| `customer_account` | NOT_SENSITIVE | Account / auth |
| `authentication_google_oauth` | NOT_SENSITIVE | Optional OAuth; role pending |
| `customer_booking` | **SENSITIVE_PERSONAL_DATA_FINANCIAL** | Amounts / financial linkage |
| `payment_metadata` | **SENSITIVE_PERSONAL_DATA_FINANCIAL** | No PAN/CVV |
| `saved_payment_token_metadata` | **SENSITIVE_PERSONAL_DATA_FINANCIAL** | Provider token cipher only |
| `owner_kyc_documents` | **HIGH_RISK_PERSONAL_DATA_SENSITIVE_POSSIBLE** | Restricted; DPIA required |
| `owner_payout_iban` | **SENSITIVE_PERSONAL_DATA_FINANCIAL** | IBAN/bank/beneficiary encrypted |
| `exact_property_location` | NOT_SENSITIVE | Reveal-gated |
| `public_listing_media` | **SENSITIVE_DATA_POSSIBLE** | Incidental people possible; no biometrics |
| `optional_privacy_consent` | NOT_SENSITIVE | Optional only |
| `legal_acceptance_evidence` | NOT_SENSITIVE | Immutable evidence |
| `transactional_notifications` | **SENSITIVE_DATA_POSSIBLE** | Email when provider enabled |
| `data_subject_requests` | **SENSITIVE_DATA_POSSIBLE** | Includes `privacy_complaint` |
| `security_audit_logs` | **SENSITIVE_DATA_POSSIBLE** | Minimise metadata |
| `reviews_support_disputes` | **SENSITIVE_DATA_POSSIBLE** | Free text |

Retention for all rows: `LEGAL_RETENTION_PERIOD_REQUIRES_REVIEW` (or technical-only for optional consent history behavior). Exact years: **UNKNOWN**.

Cross-border: `CROSS_BORDER_POSSIBLE` / `UNKNOWN` — `LEGAL_REVIEW_REQUIRED`; do not claim Jordan-only.

---

## 4. Recipients / providers (neutral roles)

| Key | contractualRoleStatus | Cross-border |
|-----|----------------------|--------------|
| `neon_postgres` | ROLE_REQUIRES_CONTRACT_REVIEW | CROSS_BORDER_POSSIBLE |
| `cloudflare_r2_public_media` | ROLE_REQUIRES_CONTRACT_REVIEW | CROSS_BORDER_POSSIBLE |
| `cloudflare_r2_private_kyc` | ROLE_REQUIRES_CONTRACT_REVIEW | CROSS_BORDER_POSSIBLE |
| `paytabs` | ROLE_REQUIRES_CONTRACT_REVIEW | UNKNOWN (JOR endpoint evidenced) |
| `google_oauth` | INDEPENDENT_CONTROLLER_ROLE_PENDING | CROSS_BORDER_POSSIBLE |
| `resend_email` | PROCESSOR_ROLE_PENDING | CROSS_BORDER_POSSIBLE |
| `app_hosting` | ROLE_REQUIRES_CONTRACT_REVIEW | UNKNOWN |

Do **not** guess roles from industry practice.

---

## 5. DSR / complaint handling

- Rights: access (incl. copy), correction, objection, consent_withdrawal, erasure, restriction, portability (separate), privacy_inquiry, **privacy_complaint**
- SLA: 15 working days from day after receipt (Asia/Amman; Sun–Thu; configurable official holidays)
- Empty holiday list → provisional + `HOLIDAY_CALENDAR_VERIFICATION_REQUIRED`
- Admin urgency: `DUE_SOON` / `OVERDUE`

---

## 6. Security notes (register)

- KYC: private object storage; authenticated stream; owner-scoped + admin-gated; `Cache-Control: private, no-store`
- Exact location: `canRevealExactLocation` for eligible confirmed bookings only
- Financial: IBAN AES-GCM; no PAN/CVV in schema
- Listing media: incidental PII possible; Owner Agreement / content rules for lawful upload (separate workstream)
- **Phase 3C.4D.6:** `BookingPropertySnapshot` is contractual listing evidence (amenities/rules/capacity/safety disclosures/media refs). Retention follows Booking evidence (unresolved — counsel). Soft-removed listing media retained when referenced by snapshots. Privacy Policy unchanged.

---

## 7. DPIA readiness (open)

KYC, financial/IBAN/payment metadata, cross-border, free-text channels: still require legal/DPIA completion before Production claims.

---

## 8. Confirmations

- Prior draft `MAZARE3_PROCESSING_REGISTER_DRAFT_3C4B1.md` kept as history.  
- Privacy Policy **not** finalised.  
- Production **not** touched.  
- Customer contractual corpus **`1.1.2-advisor-final`** unchanged.
