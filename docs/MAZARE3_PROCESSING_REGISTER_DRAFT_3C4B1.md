# Mazare3 — Processing Register Draft (Phase 3C.4B.1)

> **Superseded for future review by** [`docs/MAZARE3_PROCESSING_REGISTER_DRAFT_3C4B1_1.md`](./MAZARE3_PROCESSING_REGISTER_DRAFT_3C4B1_1.md) (Phase 3C.4B.1.1). This file is retained as history.

**Classification:** INTERNAL compliance draft only — preparation aid for future Jordan controller / processor / DPO registration.  
**Not** a government form. **Not** for external submission by engineering.  
**Human-only external submission:** OUT OF SCOPE of this document and of Phase 3C.4B.1 automation.  
**SSOT:** `packages/shared/src/privacy-processing-inventory.ts`  
**Companion:** [MAZARE3_PRIVACY_DATA_MAP_3C4B1.md](./MAZARE3_PRIVACY_DATA_MAP_3C4B1.md)  
**Date:** 2026-09-13

### Rules

- Do **not** invent retention periods, processor countries, PSP legal name, or DPO appointment.
- `dpoAppointed = false`; candidate label **`INTERNAL_DPO_CANDIDATE`** only.
- Privacy Policy **NOT finalised**.
- Contractual package **`1.1.2-advisor-final`** unchanged by this privacy phase.
- Mark unknowns explicitly. No secrets.

---

## A. Document purpose checklist

| # | Item | Done? |
|---|------|-------|
| A1 | Internal processing register draft exists | [x] |
| A2 | Aligns to SSOT inventory / activities / processors | [x] |
| A3 | Explicitly excludes auto-filing / bot submission | [x] |
| A4 | External Ministry/portal submission assigned to **human counsel/founder only** | [ ] pending assignment |
| A5 | Counsel reviewed legal bases under Jordan PDPL (not GDPR copy-paste) | [ ] LEGAL_REVIEW_REQUIRED |

---

## B. Controller registration readiness

| Key | Checklist item | Evidence status | Ready for human pack? |
|-----|----------------|-----------------|----------------------|
| `controller_identity` | Controller legal identity | CONFIRMED | [x] draft ready |
| `company_details` | CR / address / form | CONFIRMED | [x] draft ready |
| `processing_activities` | Processing activities inventory | TECHNICALLY_CONFIRMED | [x] draft; counsel review [ ] |
| `processors` | Processor / service inventory | TECHNICALLY_CONFIRMED | [x] draft; contracts [ ] |
| `dpo_status` | DPO formal appointment / accreditation | FOUNDER_INPUT_REQUIRED | [ ] **blocked** |
| `data_categories` | Data categories per activity | TECHNICALLY_CONFIRMED | [x] draft |
| `purposes` | Purposes per activity | TECHNICALLY_CONFIRMED | [x] draft |
| `transfers` | Cross-border transfer assessment | LEGAL_REVIEW_REQUIRED | [ ] |
| `security_controls` | Security / organisational measures mapping | TECHNICALLY_CONFIRMED | [x] draft |
| `privacy_contact` | Public privacy contact email | FOUNDER_INPUT_REQUIRED | [ ] |
| `psp_legal_name` | Payment provider legal name | FOUNDER_INPUT_REQUIRED | [ ] |

### B.1 Controller snapshot (internal pack fields)

| Field | Value / status |
|-------|----------------|
| Entity AR | شركة الرجل الوطواط للتكنولوجيا |
| Entity EN | BATMAN TECHNOLOGY |
| Form | LLC / ذات مسؤولية محدودة (separate from name) |
| CR | 62272 |
| Establishment no. | 200185304 |
| Country | Jordan |
| City | Amman |
| Address | Founder/company-provided (see legal-identity SSOT) |
| Legal email | info@battechno.com (**not** privacy contact) |
| Privacy email | **FOUNDER_INPUT_REQUIRED** |
| DPO appointed | **false** |
| DPO candidate | INTERNAL_DPO_CANDIDATE — not published |

---

## C. DPO / privacy-contact pack (human completion)

| # | Task | Status |
|---|------|--------|
| C1 | Keep `dpoAppointed=false` until formal record | [x] enforced in SSOT |
| C2 | Record INTERNAL_DPO_CANDIDATE role (no private PII in repo) | [ ] founder |
| C3 | Conflict-of-interest / independence review | [ ] PENDING |
| C4 | Specialised knowledge / suitability evidence | [ ] PENDING |
| C5 | Accreditation / registration scope check vs Jordan rules | [ ] REQUIRES_SCOPE_CHECK |
| C6 | Decide public label: `privacy_contact` vs `dpo` (only if appointed) | [ ] blocked on C1–C5 |
| C7 | Set publishable `privacyContactEmail` | [ ] FOUNDER_INPUT_REQUIRED |
| C8 | Publish DPO/privacy contact on Privacy Policy when finalised | [ ] Privacy Policy NOT finalised |

---

## D. Processing activities register (draft rows)

Use for future controller filing annexes. Legal basis = **LEGAL_REVIEW_REQUIRED** for all rows — do not import GDPR “legitimate interest” mechanically.

| Activity key | Name (EN) | Subject | Financial? | Sensitive possible? | Region | Cross-border | Retention | DPIA | Minimisation |
|--------------|-----------|---------|------------|---------------------|--------|--------------|-----------|------|--------------|
| `customer_account` | Customer account & profile | customer | No | No | REGION_REQUIRES_PROVIDER_CONFIRMATION | POSSIBLE | LEGAL_REVIEW | Pending review | KEEP |
| `customer_booking` | Booking lifecycle | customer | Yes | No | REGION_REQUIRES_PROVIDER_CONFIRMATION | POSSIBLE | LEGAL_REVIEW | Pending review | KEEP |
| `payment_metadata` | Payment metadata (no PAN/CVV) | customer | Yes | No | PayTabs JOR endpoint + DB unproven | UNKNOWN | LEGAL_REVIEW | Recommended | KEEP |
| `owner_kyc_documents` | Owner KYC / authority docs | owner_partner | No | **Yes** | REGION_REQUIRES_PROVIDER_CONFIRMATION | POSSIBLE | LEGAL_REVIEW | **Required** | RESTRICT_ACCESS |
| `owner_payout_iban` | Owner payout / IBAN | owner_partner | Yes | No | REGION_REQUIRES_PROVIDER_CONFIRMATION | POSSIBLE | LEGAL_REVIEW | Recommended | RESTRICT_ACCESS |
| `exact_property_location` | Exact location & arrival | owner_partner | No | No | REGION_REQUIRES_PROVIDER_CONFIRMATION | POSSIBLE | LEGAL_REVIEW | Recommended | RESTRICT_ACCESS |
| `optional_privacy_consent` | Optional consents | customer | No | No | same as primary DB | POSSIBLE | TECHNICAL_BEHAVIOR_ONLY | Pending review | KEEP |
| `data_subject_requests` | DSR handling | mixed | No | No | same as primary DB | POSSIBLE | LEGAL_REVIEW | Pending review | KEEP |
| `security_audit_logs` | Security / audit logs | mixed | No | No | REGION_REQUIRES_PROVIDER_CONFIRMATION | POSSIBLE | LEGAL_REVIEW | Recommended | MINIMISE |
| `reviews_support_disputes` | Reviews / support / disputes | mixed | No | No | REGION_REQUIRES_PROVIDER_CONFIRMATION | POSSIBLE | LEGAL_REVIEW | Pending review | MINIMISE |

### D.1 Per-activity human checklist

| Activity key | Categories OK? | Purpose OK? | Recipients OK? | Legal basis counsel? | Retention counsel? | Transfer counsel? |
|--------------|----------------|-------------|----------------|----------------------|--------------------|-------------------|
| `customer_account` | [x] tech | [x] tech | [x] tech | [ ] | [ ] | [ ] |
| `customer_booking` | [x] | [x] | [x] | [ ] | [ ] | [ ] |
| `payment_metadata` | [x] | [x] | [x] | [ ] | [ ] | [ ] |
| `owner_kyc_documents` | [x] | [x] | [x] | [ ] | [ ] | [ ] |
| `owner_payout_iban` | [x] | [x] | [x] | [ ] | [ ] | [ ] |
| `exact_property_location` | [x] | [x] | [x] | [ ] | [ ] | [ ] |
| `optional_privacy_consent` | [x] | [x] | [x] | [ ] | [ ] | [ ] |
| `data_subject_requests` | [x] | [x] | [x] | [ ] | [ ] | [ ] |
| `security_audit_logs` | [x] | [x] | [x] | [ ] | [ ] | [ ] |
| `reviews_support_disputes` | [x] | [x] | [x] | [ ] | [ ] | [ ] |

---

## E. Processor / recipient register (draft)

| Processor key | Service | Role flag (counsel) | Contractual legal entity | Region | Cross-border | DPA / contract | Notes |
|---------------|---------|---------------------|--------------------------|--------|--------------|----------------|-------|
| `neon_postgres` | Neon PostgreSQL | Likely processor | **UNKNOWN** — PROVIDER_CONTRACT_REQUIRED | REGION_REQUIRES_PROVIDER_CONFIRMATION | POSSIBLE | [ ] | Do not infer country from HQ |
| `cloudflare_r2_public_media` | Cloudflare R2 public | Likely processor | **UNKNOWN** | REGION_REQUIRES_PROVIDER_CONFIRMATION | POSSIBLE | [ ] | `region=auto` unproven |
| `cloudflare_r2_private_kyc` | Cloudflare R2 private | Likely processor | **UNKNOWN** | REGION_REQUIRES_PROVIDER_CONFIRMATION | POSSIBLE | [ ] | Auth stream; no signed URLs found |
| `paytabs` | PayTabs | Controller and/or processor — LEGAL_REVIEW | **FOUNDER_INPUT_REQUIRED** | JOR endpoint TECHNICALLY_CONFIRMED | Full map UNKNOWN | [ ] | No PAN/CVV at Mazare3 |
| `google_oauth` | Google OAuth | Often independent controller for Google account + Mazare3 link data | PROVIDER_CONTRACT_REQUIRED | UNKNOWN | POSSIBLE | [ ] | Optional login |
| `resend_email` | Resend / SMTP | Likely processor **if enabled** | PROVIDER_CONTRACT_REQUIRED | UNKNOWN | POSSIBLE if on | [ ] | May be inactive (`EMAIL_PROVIDER=none`) |
| `app_hosting` | Web/API host | Likely processor(s) | FOUNDER_INPUT_REQUIRED | **UNKNOWN** | UNKNOWN | [ ] | Do not assert host name without Production env |

### E.1 Processor human checklist

| # | Task | Status |
|---|------|--------|
| E1 | Confirm Production region for each active processor | [ ] |
| E2 | Obtain contractual legal entity names | [ ] |
| E3 | Execute DPA / Jordan-equivalent terms | [ ] |
| E4 | Resolve PayTabs MoR / facilitator language | [ ] FOUNDER + counsel |
| E5 | List subprocessors in **final** Privacy Policy | [ ] Policy NOT finalised |
| E6 | Exclude inactive vendors from “active processing” claims | [x] noted |

---

## F. Categories of personal data (summary checklist)

| Category group | In register? | Special care |
|----------------|--------------|--------------|
| Identity / account | [x] | Passwords hashed only |
| Contact (email/phone) | [x] | |
| Auth federated IDs | [x] | Google |
| Booking / transaction metadata | [x] | Financial |
| Payment metadata (no PAN/CVV) | [x] | |
| Saved PSP token cipher | [x] | Restrict access |
| Owner KYC documents | [x] | Sensitive — DPIA |
| IBAN / bank ciphers | [x] | Financial encryption |
| Exact property location | [x] | Reveal gating |
| Consents / withdrawals | [x] | |
| Legal acceptance / booking legal snapshot | [x] | Erasure-retained |
| DSR request content | [x] | |
| Audit / security logs | [x] | Minimise; IP TBD |
| Reviews / support free text | [x] | Minimise |

---

## G. Purposes checklist

| Purpose | Linked activities | Counsel OK? |
|---------|-------------------|-------------|
| Account administration & authentication | `customer_account` | [ ] |
| Marketplace booking performance | `customer_booking` | [ ] |
| Payments, refunds, reconciliation | `payment_metadata` | [ ] |
| Owner verification / listing authority | `owner_kyc_documents` | [ ] |
| Owner settlement | `owner_payout_iban` | [ ] |
| Post-confirmation arrival | `exact_property_location` | [ ] |
| Optional marketing / analytics / cookies | `optional_privacy_consent` | [ ] |
| Data-subject rights handling | `data_subject_requests` | [ ] |
| Security, fraud, accountability | `security_audit_logs` | [ ] |
| Quality, support, fairness | `reviews_support_disputes` | [ ] |

---

## H. Cross-border / transfer annex checklist

| # | Item | Status |
|---|------|--------|
| H1 | Inventory flags CROSS_BORDER_POSSIBLE where region unproven | [x] |
| H2 | PayTabs JOR endpoint documented without overclaiming geography | [x] |
| H3 | Hosting region confirmed | [ ] UNKNOWN |
| H4 | Transfer mechanism / safeguards under Jordan PDPL | [ ] LEGAL_REVIEW |
| H5 | DPIA for cross-border path | [ ] DPIA_REQUIRED_LEGAL_REVIEW |
| H6 | Public disclosure only after confirmation | [x] rule |

---

## I. Retention annex checklist

| Category key | Technical behavior captured? | Statutory period entered? |
|--------------|------------------------------|---------------------------|
| accounts | [x] | [ ] LEGAL_REVIEW — **do not invent** |
| kyc | [x] | [ ] |
| bookings | [x] | [ ] |
| payments_refunds | [x] | [ ] |
| settlements | [x] | [ ] |
| legal_acceptances | [x] | [ ] |
| audit_security_logs | [x] | [ ] |
| support_disputes | [x] | [ ] |
| reviews | [x] | [ ] |
| exact_location | [x] | [ ] |
| uploaded_documents | [x] | [ ] |

**Erasure policy note (technical):** anonymise preferred; retain `legal_acceptance`, `booking_legal_snapshot`, `bookings`, `payments`.

---

## J. Security measures annex checklist

| Control | Confirmed in audit? | Include in human pack? |
|---------|---------------------|------------------------|
| No PAN/CVV storage | [x] | [x] |
| `providerTokenCipher` only for saved methods | [x] | [x] |
| IBAN/bank AES-GCM | [x] | [x] (no key material) |
| KYC private bucket + auth stream | [x] | [x] |
| Exact location gating | [x] | [x] |
| bcrypt 12 + JWT sessions | [x] | [x] |
| Consent withdrawal history | [x] | [x] |
| DSR SLA due dates (15 WD) | [x] foundation | [x] ops process [ ] |
| Breach playbook | [ ] **Missing** | [ ] must draft |
| Org policies / access reviews | [ ] UNKNOWN | [ ] |

---

## K. DSR / rights annex checklist

| Right | Tech support | Ops playbook | Counsel OK? |
|-------|--------------|--------------|-------------|
| Access | [x] | [ ] | [ ] |
| Copy | LEGAL_REVIEW mapping | [ ] | [ ] |
| Correction | [x] | [ ] | [ ] |
| Objection | [x] | [ ] | [ ] |
| Consent withdrawal | [x] | [ ] | [ ] |
| Erasure (anonymise preferred) | [x] | [ ] | [ ] |
| Restriction | [x] | [ ] | [ ] |
| Portability | [x] | [ ] | [ ] |
| Privacy inquiry | [x] | [ ] | [ ] |

| SLA item | Status |
|----------|--------|
| 15 working days from day after receipt | [x] coded foundation |
| Asia/Amman Sun–Thu | [x] |
| `receivedAt` / `dueAt` persisted | [x] 3C.4B.1 |
| Public holiday exclusion | [ ] LEGAL_REVIEW |
| Overdue admin surfacing | [x] helper; UI/process maturity [ ] |

---

## L. Consent / notice annex checklist

| # | Item | Status |
|---|------|--------|
| L1 | Optional purposes: marketing_email, marketing_sms, personalized_analytics, optional_cookies | [x] |
| L2 | Consents unbundled from Terms acceptance | [x] tech rule |
| L3 | Withdrawal + history | [x] |
| L4 | Privacy Policy final text | [ ] NOT finalised |
| L5 | Contractual package versions remain `1.1.2-advisor-final` | [x] must not mutate |
| L6 | Cookie / tracker disclosures aligned to final policy | [ ] |

---

## M. DPIA register checklist

| Topic key | Status | Human action |
|-----------|--------|--------------|
| `owner_kyc` | DPIA_REQUIRED_LEGAL_REVIEW | [ ] commission |
| `financial_iban` | DPIA_RECOMMENDED | [ ] assess |
| `exact_location` | DPIA_RECOMMENDED | [ ] assess |
| `cross_border` | DPIA_REQUIRED_LEGAL_REVIEW | [ ] commission |
| `fraud_security` | DPIA_RECOMMENDED | [ ] assess |
| `future_profiling_analytics` | DPIA_NOT_COMPLETED | [ ] if product ships |

---

## N. Pre-submission gate (HUMAN ONLY)

External controller / processor / DPO registration or Ministry portal filing is **out of scope** for engineering automation.

| Gate | Required before any human external submission |
|------|-----------------------------------------------|
| N1 | Counsel signs off register completeness | [ ] |
| N2 | Founder confirms privacy contact + DPO appointment decision | [ ] |
| N3 | PSP legal name + role language confirmed | [ ] |
| N4 | Processor regions / contracts attached | [ ] |
| N5 | Retention schedule counsel-approved | [ ] |
| N6 | Transfer / DPIA outcomes recorded | [ ] |
| N7 | Privacy Policy finalised (separate from contractual `1.1.2-advisor-final`) | [ ] |
| N8 | Breach playbook exists | [ ] |
| N9 | Designated human submitter named | [ ] |
| N10 | No secrets / env values in filing pack | [x] rule |

**Stop rule:** If any of N1–N9 is unchecked, do **not** submit externally.

---

## O. Version / corpus lock

| Item | Value |
|------|-------|
| Privacy phase | 3C.4B.1 |
| Contractual customer package | **`1.1.2-advisor-final` — unchanged** |
| Privacy Policy corpus | Launch-candidate / draft — **NOT finalised** |
| SSOT module | `packages/shared/src/privacy-processing-inventory.ts` |
| Identity SSOT | `packages/shared/src/legal-identity.ts` |

---

*End of INTERNAL Processing Register Draft — Phase 3C.4B.1. External submission = human counsel/founder only.*
