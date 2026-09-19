# Mazare3 — Privacy Data Map (Phase 3C.4B.1.1)

**Classification:** INTERNAL compliance draft only — not legal advice; not a government filing.  
**Status:** Supersedes `docs/MAZARE3_PRIVACY_DATA_MAP_3C4B1.md` for future review (prior file retained as history).  
**SSOT:** `packages/shared/src/privacy-processing-inventory.ts`  
**Business calendar:** `packages/shared/src/jordan-privacy-business-calendar.ts`  
**Date:** 2026-09-14  
**Scope:** Jordan PDPL mapping corrections + DSR hardening (no Privacy Policy rewrite; no breach platform).

### Hard constraints (unchanged)

| Item | Status |
|------|--------|
| Retention periods (statutory) | `LEGAL_RETENTION_PERIOD_REQUIRES_REVIEW` / **UNKNOWN** — do not invent years |
| Processor countries / regions | `CROSS_BORDER_POSSIBLE` / `REGION_REQUIRES_PROVIDER_CONFIRMATION` / `LEGAL_REVIEW_REQUIRED` |
| PayTabs / PSP contractual legal name | `FOUNDER_INPUT_REQUIRED` |
| Formal DPO appointment | `dpoAppointed = false` |
| Public Privacy Policy | **NOT finalised** |
| Contractual package (T&Cs / Booking / Cancellation) | **`1.1.2-advisor-final` unchanged** |
| Production | **NOT touched** by this phase |
| Secrets / keys / tokens | **Out of scope** |

---

## 1. What changed in 3C.4B.1.1

| Topic | Correction |
|-------|------------|
| Financial personal data | Classified `SENSITIVE_PERSONAL_DATA_FINANCIAL` (IBAN/bank/beneficiary/payout, payment/refund metadata, settlements, saved provider token metadata, booking amounts) |
| KYC | `HIGH_RISK_PERSONAL_DATA_SENSITIVE_POSSIBLE` — may contain sensitive fields depending on document contents; restricted access; DPIA/legal review required |
| Free-text channels | `SENSITIVE_DATA_POSSIBLE` + `MINIMISE` (support, disputes, incidents, DSR description, reviews) |
| DPO readiness | `DPO_APPOINTMENT_REQUIRED_PENDING_FORMALISATION` — Production readiness requirement; still not appointed; candidate not published |
| Accreditation | Remains `REQUIRES_SCOPE_CHECK` (ICT listed by Ministry; entity-specific applicability not automatic) |
| Access / copy | Access includes obtaining a copy; portability remains a separate right |
| Privacy complaint | New `privacy_complaint` type (distinct from `privacy_inquiry`) |
| Working-day SLA | Configurable official non-working dates; empty list → provisional + `HOLIDAY_CALENDAR_VERIFICATION_REQUIRED` + admin `DUE_SOON` |
| Processor roles | Neutral (`ROLE_REQUIRES_CONTRACT_REVIEW` / `PROCESSOR_ROLE_PENDING` / `INDEPENDENT_CONTROLLER_ROLE_PENDING`) — no “likely processor” wording |
| Listing media | Incidental identifiable people possible; no biometric/face recognition |
| Security QA | KYC IDOR isolation + exact-location gating + PAN/CVV absence + IBAN encryption verified statically |

---

## 2. Financial-sensitive corrections

Under the Jordan privacy framework, financial information is sensitive personal data. Inventory rows now use `SENSITIVE_PERSONAL_DATA_FINANCIAL` for at least:

- Owner IBAN / bank / beneficiary / payout profile
- Payment transaction & refund metadata (no PAN/CVV held by Mazare3)
- Saved payment-provider token metadata
- Settlement / payout financial records
- Booking amount / financial linkage

**Explicit non-claim:** PAN/CVV are **not** Mazare3-held data.

---

## 3. KYC classification result

KYC documents are **high-risk personal data** and **may contain sensitive personal data depending on contents** (e.g. identity details, photograph, national identifier, date of birth, signatures).  

Not classified as automatically legally “sensitive” for every document without content examination. Access remains restricted; DPIA/legal review required.

---

## 4. Free-text sensitive-data result

Support tickets, disputes, incident evidence, DSR free-text descriptions, and review free text: `SENSITIVE_DATA_POSSIBLE` with minimisation guidance. The activity is **not** labelled always-sensitive in full.

---

## 5. DPO readiness

| Field | Value |
|-------|-------|
| `dpoAppointed` | `false` |
| Candidate label | `INTERNAL_DPO_CANDIDATE` (internal only; not published) |
| Requirement status | `DPO_APPOINTMENT_REQUIRED_PENDING_FORMALISATION` |
| Production blocker | `true` |
| Still required before formalisation | conflict-of-interest review; specialised-knowledge review; founder/company appointment; accreditation scope check; publish official contact only after formalisation |

---

## 6. DPO accreditation scope

`REQUIRES_SCOPE_CHECK` retained. Ministry lists ICT among critical-infrastructure sectors for DPO accreditation, but **BATMAN TECHNOLOGY is not automatically concluded to be critical infrastructure** merely because it is an IT company.

---

## 7. Access / copy & portability

- **Access:** Customer may request access to **and obtain a copy of** their personal data (`includesObtainingCopy: true`).
- **Portability:** Separate right/process for a portable/transferable copy in the legally applicable form.
- Technical export may support both operationally; legal concepts remain separate.
- Unresolved “copy = access and/or portability” mapping removed.

---

## 8. Privacy complaint

| | |
|--|--|
| Type | `privacy_complaint` |
| EN | Personal data / privacy complaint |
| AR | شكوى تتعلق بحماية البيانات الشخصية |
| Distinct from | `privacy_inquiry` |
| Audit fields | `receivedAt`, `status`, `dueAt`, response/`adminNote`, `completedAt`/`resolvedAt` |
| Authority | Does **not** block contacting the competent Jordanian authority |

---

## 9. DSR holiday-calendar handling

- Time zone: Asia/Amman  
- Week: Sun–Thu working; Fri/Sat excluded  
- Official holidays: `JORDAN_PRIVACY_OFFICIAL_NON_WORKING_DATES` (configurable; **empty by default — no invented dates**)  
- Empty list → provisional deadline + `HOLIDAY_CALENDAR_VERIFICATION_REQUIRED` + admin warning  
- Warning threshold: `DUE_SOON` (default 3 calendar days before due)  
- Legal rule remains **15 working days from the day after receipt**

---

## 10. Processor-role corrections

Speculative “often independent controller” / “likely processor” wording removed. Roles use neutral pending statuses pending contract review for Neon, Cloudflare, PayTabs, Google OAuth, Resend, hosting.

---

## 11. Processing inventory additions / mappings

Focused rows added where not safely covered alone:

- `authentication_google_oauth`
- `saved_payment_token_metadata`
- `public_listing_media`
- `legal_acceptance_evidence`
- `transactional_notifications` (covers email delivery when enabled)

---

## 12. Security authorization QA (static)

| Check | Result |
|-------|--------|
| Owner A cannot retrieve Owner B KYC (ownerProfileId-scoped lookup) | PASS (static) |
| Customer cannot use owner/admin KYC file routes | PASS (static) |
| Non-admin cannot use admin KYC route (`requireAdmin`) | PASS (static) |
| Private R2 / no public signed URL pattern on KYC stream | PASS (static) |
| Exact location not for ineligible public/unpaid | PASS (`canRevealExactLocation`) |
| Exact location for eligible confirmed paid Booking | PASS |
| PAN/CVV absent from schema | PASS |
| IBAN/bank fields encrypted (AES-GCM) | PASS |

**No CRITICAL IDOR discovered** in this static review. If a live IDOR is later found: STOP and treat as CRITICAL.

---

## 13. Retention / cross-border

- Retention: still UNKNOWN / `LEGAL_RETENTION_PERIOD_REQUIRES_REVIEW` (risk categories updated for financial / KYC / free-text).  
- Cross-border: conservative statuses retained; cross-border DPIA readiness remains a Production blocker.  
- Do not claim Jordan-only processing.

---

## 14. Confirmations

- Privacy Policy was **NOT** finalised in this phase.  
- Production was **NOT** touched.  
- Do **not** proceed to Phase 3C.4B.1.2 or Privacy Policy rewrite from this draft alone.
