# Mazare3 — Privacy Data Map (Phase 3C.4B.1)

> **Superseded for future review by** [`docs/MAZARE3_PRIVACY_DATA_MAP_3C4B1_1.md`](./MAZARE3_PRIVACY_DATA_MAP_3C4B1_1.md) (Phase 3C.4B.1.1). This file is retained as history.

**Classification:** INTERNAL compliance draft only — not legal advice; not a government filing.  
**SSOT:** `packages/shared/src/privacy-processing-inventory.ts`  
**Date:** 2026-09-13  
**Scope:** Engineering + founder-confirmed identity evidence for Jordan PDPL readiness.

### Hard constraints (do not invent)

| Item | Status |
|------|--------|
| Retention periods (statutory) | `LEGAL_RETENTION_PERIOD_REQUIRES_REVIEW` — **UNKNOWN** until counsel |
| Processor countries / regions | Mostly `REGION_REQUIRES_PROVIDER_CONFIRMATION` |
| PayTabs / PSP contractual legal name | `FOUNDER_INPUT_REQUIRED` |
| Formal DPO appointment | `dpoAppointed = false` |
| Public Privacy Policy | **NOT finalised** (corpus note: launch-candidate / published draft) |
| Contractual package (T&Cs / Booking / Cancellation) | **`1.1.2-advisor-final` unchanged** by this phase |
| Secrets / keys / tokens | **Out of scope** — never paste env secrets into this doc |

---

## 1. Executive summary

Phase 3C.4B.1 establishes an internal privacy processing inventory, DSR SLA foundation (`receivedAt` / `dueAt`, 15 working days Asia/Amman Sun–Thu), and rights coverage including `restriction` and `consent_withdrawal`.

**Confirmed strengths:** no PAN/CVV storage; IBAN/bank fields AES-GCM encrypted; KYC on private R2 with auth-gated stream (no signed URLs found); exact location gated; optional consents withdrawable with history; erasure prefers anonymise while retaining legal/financial evidence.

**Open blockers:** formal DPO not appointed; `privacyContactEmail` and `paymentProviderLegalName` still `FOUNDER_INPUT_REQUIRED`; most storage regions unproven; Privacy Policy not finalised; no personal-data breach playbook; DPIA work incomplete for KYC and cross-border.

---

## 2. Controller identity

| Field | Value / status |
|-------|----------------|
| Product brand | Mazare3 Jordan / مزارع الأردن (brand ≠ legal entity) |
| Legal entity (AR) | شركة الرجل الوطواط للتكنولوجيا — **CONFIRMED** (founder) |
| Legal entity (EN) | BATMAN TECHNOLOGY — **FOUNDER_CONFIRMED** (official EN certificate TBD) |
| Legal form | LLC / شركة ذات مسؤولية محدودة — **CONFIRMED** (form separate from name) |
| CR number | 62272 — **CONFIRMED** |
| National establishment no. | 200185304 — **CONFIRMED** |
| Registration date | 17/01/2022 — **CONFIRMED** |
| Country / city | Jordan / Amman — **CONFIRMED** |
| Registered address | Founder/company-provided Amman office address — **CONFIRMED** (detailed source: FOUNDER_COMPANY_PROVIDED) |
| Legal contact email | info@battechno.com — **CONFIRMED** (legal ops; **not** privacy contact) |
| Project operational email | mazare3jo@gmail.com — **CONFIRMED** (ops; **not** privacy contact) |
| `privacyContactEmail` | **FOUNDER_INPUT_REQUIRED** / MISSING |
| `paymentProviderLegalName` | **FOUNDER_INPUT_REQUIRED** / MISSING |
| Tax number | **UNKNOWN** / MISSING unless env set |

Identity SSOT: `packages/shared/src/legal-identity.ts`.

---

## 3. DPO readiness

| Field | Value |
|-------|-------|
| `dpoAppointed` | **false** (must remain false until formal appointment) |
| Candidate | `INTERNAL_DPO_CANDIDATE` only |
| Appointment status | `NOT_FORMALLY_RECORDED` |
| Conflict-of-interest review | `PENDING` |
| Specialised knowledge evidence | `PENDING` |
| Accreditation applicability | `REQUIRES_SCOPE_CHECK` |
| Public DPO contact | `NOT_PUBLISHED` |
| Production blocker | **true** |

**Rule:** Do not publish an appointed/accredited DPO, store candidate national ID / private address / personal phone / private email, or set `dpoAppointed=true` without founder + suitability verification.

---

## 4. Customer data map

| Category | Fields (evidence) | Collection | Systems | Access | Notes |
|----------|-------------------|------------|---------|--------|-------|
| Account / profile | name, email, phone (optional), locale, password hash | Registration / profile / Google OAuth | Neon `User`, `AuthIdentity` | self, admin | Password bcrypt cost 12 |
| Sessions | JWT session cookie | Auth flows | App + cookie | self | `passwordChangedAt` invalidation |
| Bookings | booking ids, dates, guests, amounts, status, user link | Checkout / booking APIs | Neon `Booking` + related | self, property owner, admin | Financial + contract |
| Payment metadata | amounts, currency, status, provider refs, masked display | PSP callbacks / vault | Neon `Payment`, `SavedPaymentMethod`; PayTabs | limited self, admin, jobs | **No PAN/CVV** |
| Optional consents | purpose, status, version, withdrawnAt, source | Account privacy / cookies | Neon `PrivacyConsent` | self, admin | Unbundled from Terms |
| Legal evidence | document/version acceptances; booking snapshots | Gates / checkout | `LegalAcceptance`, `BookingLegalSnapshot` | system, admin | Erasure-retained |
| Reviews / support | comments, ticket contact, free text | In-product forms | Review, SupportTicket, Dispute, Incident | parties, admin | May contain excess PII |
| DSR meta | type, email, description, status, dueAt | Privacy tools / admin | `DataSubjectRequest` | requester, admin | SLA fields in 3C.4B.1 |

---

## 5. Owner / KYC data map

| Category | Fields | Collection | Storage | Access | Risk |
|----------|--------|------------|---------|--------|------|
| KYC / authority docs | identity docs, authority docs, original file name, storage key | Partner onboarding upload | Neon `OwnerDocument` + **private R2** | owner self, admin | Sensitive — DPIA required |
| Payout / IBAN | ibanCipher, bankNameCipher, beneficiaryNameCipher, ibanLast4 | Payout profile form | Neon `OwnerPayoutProfile` | owner self, admin | AES-GCM (`PARTNER_DATA_ENCRYPTION_KEY`) |
| Exact location | exact address, coordinates, arrival instructions | Owner property forms | Neon `Property` | owner; eligible customer after paid booking; admin | Gated via `location-privacy.ts` |
| Listing media | property images | Owner uploads | Public R2 | public | Faces in photos = possible indirect PII |

**KYC delivery:** auth-gated stream download; `Cache-Control: private, no-store`; **no signed URL pattern found** in audit.

---

## 6. Financial-data map

| Data | Stored by Mazare3? | Where | Notes |
|------|--------------------|-------|-------|
| PAN / CVV | **No** | — | Processed by PSP only |
| Payment amounts / status / refs | Yes | Neon `Payment` (+ refunds) | Metadata only |
| Masked card display | Yes (if provided) | Payment / saved method display fields | Not full PAN |
| Saved card token | Cipher only | `SavedPaymentMethod.providerTokenCipher` | AES-GCM when used |
| Owner IBAN / bank / beneficiary | Cipher + last4 | `OwnerPayoutProfile` | AES-GCM |
| Settlements / payouts | Yes | Settlement records | Retention period **UNKNOWN** (legal review) |
| PSP legal entity / MoR | **UNKNOWN** | Contract | `paymentProviderLegalName` FOUNDER_INPUT_REQUIRED |

---

## 7. Technical-data map

| Category | Evidence | Notes |
|----------|----------|-------|
| Password hashes | bcrypt cost **12** | Not reversible |
| Auth sessions | JWT cookies | Session invalidation on password change |
| Federated identity | Google OAuth → `AuthIdentity` | Optional |
| Audit logs | `AuditLog` actor / action / entity refs | Append-oriented; no automated purge found |
| Abuse / rate limits | Hashed identifiers (`LoginAbuseState`, `RateLimitBucket`) | Raw IP persistence **not confirmed** — confirm before claims |
| Request metadata at host | Hosting logs | Hosting provider/region **UNKNOWN** |
| Exact location reveal rules | `location-privacy.ts` | Public payloads strip exact keys |

---

## 8. Processor / service inventory

| Key | Service | Purpose | Contractual entity | Region evidence | Cross-border |
|-----|---------|---------|--------------------|-----------------|--------------|
| `neon_postgres` | Neon PostgreSQL | Primary DB | PROVIDER_CONTRACT_REQUIRED | REGION_REQUIRES_PROVIDER_CONFIRMATION | CROSS_BORDER_POSSIBLE |
| `cloudflare_r2_public_media` | Cloudflare R2 (public) | Listing media | PROVIDER_CONTRACT_REQUIRED | `CLOUDFLARE_R2_REGION=auto` unproven | CROSS_BORDER_POSSIBLE |
| `cloudflare_r2_private_kyc` | Cloudflare R2 (private) | KYC / partner docs | PROVIDER_CONTRACT_REQUIRED | auto / unproven | CROSS_BORDER_POSSIBLE |
| `paytabs` | PayTabs (configured PSP) | Card payments | FOUNDER_INPUT_REQUIRED (legal name) | **TECHNICALLY_CONFIRMED** JOR endpoint (`secure-jordan.paytabs.com`) | Full geography **UNKNOWN** |
| `google_oauth` | Google OAuth | Optional sign-in | PROVIDER_CONTRACT_REQUIRED | Not proven in-repo | CROSS_BORDER_POSSIBLE |
| `resend_email` | Resend / SMTP (optional) | Transactional email | PROVIDER_CONTRACT_REQUIRED | Unknown when enabled; default often `EMAIL_PROVIDER=none` | CROSS_BORDER_POSSIBLE if enabled |
| `app_hosting` | Web/API hosting | Serve app | FOUNDER_INPUT_REQUIRED | Hosting **UNKNOWN** | UNKNOWN |

Do **not** invent Stripe, SMS vendor, or monitoring SaaS unless evidenced in Production config.

---

## 9. Storage / region evidence

| Store | In-repo evidence | Status |
|-------|------------------|--------|
| Neon DB | Host pattern may hint AWS region; Production region not proven | REGION_REQUIRES_PROVIDER_CONFIRMATION |
| R2 public / private | Region `auto` / unproven | REGION_REQUIRES_PROVIDER_CONFIRMATION |
| PayTabs API | `PAYTABS_REGION=JOR` / Jordan secure endpoint | TECHNICALLY_CONFIRMED (endpoint only — not full processing map) |
| Google OAuth | Not proven | REGION_REQUIRES_PROVIDER_CONFIRMATION |
| Resend | Not proven when enabled | REGION_REQUIRES_PROVIDER_CONFIRMATION |
| App hosting | Not confirmed by Production env in-repo | FOUNDER_INPUT_REQUIRED |

---

## 10. Cross-border transfer findings

| Finding | Status |
|---------|--------|
| Multiple processors with unproven regions | CROSS_BORDER_POSSIBLE |
| PayTabs Jordan endpoint | Technically evidenced; transfer completeness **UNKNOWN** |
| Hosting geography | **UNKNOWN** |
| Transfer legal mechanism / adequacy | LEGAL_REVIEW_REQUIRED |
| Public Privacy Policy transfer disclosures | Blocked until regions + PSP name confirmed |

**No** claim of “Jordan-only processing” is permitted on current evidence.

---

## 11. Consent inventory

| Purpose key | Type | Withdrawable | History | Notes |
|-------------|------|--------------|---------|-------|
| `marketing_email` | Optional | Yes | Retained | Unbundled from Terms |
| `marketing_sms` | Optional | Yes | Retained | Marketing infra may be inactive |
| `personalized_analytics` | Optional | Yes | Retained | Product analytics shipping **not confirmed** |
| `optional_cookies` | Optional | Yes | Retained | Align with cookie audit / policy draft |

Model: `PrivacyConsent` — withdrawal sets `status=withdrawn` + `withdrawnAt`.  
Also: `LegalAcceptance` (contractual acceptance — **not** optional marketing consent).  
DSR type `consent_withdrawal` supported alongside withdraw API.

---

## 12. DSR rights coverage

| Right | Architecture | Status |
|-------|--------------|--------|
| Access | `DataSubjectRequestType.access` | TECHNICALLY_CONFIRMED |
| Copy of personal data | Via access and/or portability (admin-driven) | LEGAL_REVIEW_REQUIRED |
| Correction | `correction` | TECHNICALLY_CONFIRMED |
| Objection | `objection` | TECHNICALLY_CONFIRMED |
| Consent withdrawal | PrivacyConsent withdraw API + `consent_withdrawal` | TECHNICALLY_CONFIRMED |
| Erasure | `erasure` — anonymise preferred | TECHNICALLY_CONFIRMED |
| Restriction | `restriction` | TECHNICALLY_CONFIRMED |
| Portability | `portability` | TECHNICALLY_CONFIRMED |
| Privacy inquiry | `privacy_inquiry` | TECHNICALLY_CONFIRMED |

**Erasure retain categories:** `legal_acceptance`, `booking_legal_snapshot`, `bookings`, `payments`.

---

## 13. DSR 15-working-day readiness

| Element | Status |
|---------|--------|
| Statutory target (Ministry guidance referenced in SSOT) | **15 working days** from **day after receipt** |
| Calendar / TZ | Asia/Amman; working week **Sun–Thu** |
| Schema foundation | `DataSubjectRequest.receivedAt`, `dueAt` (3C.4B.1) |
| Computation | `computeDsrDueAtFromReceivedAt` in SSOT |
| Overdue detection | Open statuses `requested` / `under_review` vs `dueAt` |
| Public holidays exclusion | **NOT implemented** — LEGAL_REVIEW_REQUIRED |
| Admin fulfilment playbooks (per right) | Partial / admin-driven — process maturity LEGAL_REVIEW + ops |
| Auto-fulfilillment of erasure | Not claimed; anonymise policy described, admin status updates |

---

## 14. Retention map

Exact statutory periods: **UNKNOWN** — do not invent. Technical behavior only:

| Category | Start event (technical) | Current technical behavior | Exact legal period |
|----------|-------------------------|----------------------------|--------------------|
| User accounts | Creation / activity TBD | No automated purge found | LEGAL_REVIEW |
| Owner KYC docs | Upload / verification | Private R2 + metadata; no purge found | LEGAL_REVIEW |
| Bookings | Booking creation | Durable; erasure-retained | LEGAL_REVIEW |
| Payments / refunds | Payment initiation | Durable metadata; no PAN/CVV | LEGAL_REVIEW |
| Settlements | Settlement close | Durable | LEGAL_REVIEW |
| LegalAcceptance | Acceptance event | Immutable / erasure-retained | LEGAL_REVIEW |
| BookingLegalSnapshot | Booking legal freeze | Erasure-retained | LEGAL_REVIEW |
| Audit / security logs | Event time | Append-only; no purge found | LEGAL_REVIEW |
| Support / disputes | Open | Durable | LEGAL_REVIEW |
| Reviews | Publish | Durable | LEGAL_REVIEW |
| Exact location | Property save | Stored; public reveal gated | LEGAL_REVIEW |
| PrivacyConsent history | Grant / withdraw | History rows retained | TECHNICAL_BEHAVIOR_ONLY |

---

## 15. DPIA readiness

| Topic | Status | Notes |
|-------|--------|-------|
| Owner KYC identity documents | DPIA_REQUIRED_LEGAL_REVIEW | Sensitive docs + possible cross-border object storage |
| Financial / IBAN | DPIA_RECOMMENDED | Field encryption confirmed; transfer/retention open |
| Exact location disclosure | DPIA_RECOMMENDED | Gating exists; residual risk assessment needed |
| Cross-border storage/processing | DPIA_REQUIRED_LEGAL_REVIEW | Multiple unproven regions |
| Fraud / security processing | DPIA_RECOMMENDED | Confirm log / IP contents |
| Future profiling / analytics | DPIA_NOT_COMPLETED | Consent purpose exists; shipping unconfirmed |

---

## 16. Security controls confirmed

| Control | Evidence status |
|---------|-----------------|
| No PAN/CVV in Mazare3 schema | CONFIRMED |
| Saved-card `providerTokenCipher` only | TECHNICALLY_CONFIRMED |
| IBAN/bank AES-GCM (`PARTNER_DATA_ENCRYPTION_KEY`) | TECHNICALLY_CONFIRMED |
| KYC private R2 + auth stream; no signed URLs found | TECHNICALLY_CONFIRMED |
| Exact location gating (`location-privacy.ts`) | TECHNICALLY_CONFIRMED |
| Password bcrypt 12 | TECHNICALLY_CONFIRMED |
| JWT sessions + password-change invalidation | TECHNICALLY_CONFIRMED |
| Google OAuth via `AuthIdentity` | TECHNICALLY_CONFIRMED |
| Optional consent withdraw + history | TECHNICALLY_CONFIRMED |
| BookingLegalSnapshot / LegalAcceptance evidence | TECHNICALLY_CONFIRMED |
| DSR audit on create/status update | TECHNICALLY_CONFIRMED |
| Personal-data breach playbook | **Missing** — gap |
| Encryption key rotation runbook | **UNKNOWN** / not evidenced here |
| Production secrets management | Out of scope of this doc (no secrets) |

---

## 17. Privacy gaps

1. `privacyContactEmail` — FOUNDER_INPUT_REQUIRED.  
2. Formal DPO appointment / accreditation — `dpoAppointed=false`; INTERNAL_DPO_CANDIDATE only.  
3. `paymentProviderLegalName` / MoR role — FOUNDER_INPUT_REQUIRED + legal review.  
4. Processor regions (Neon, R2, Google, Resend, hosting) — unproven.  
5. Privacy Policy **not finalised**; transfer/processor disclosures incomplete.  
6. Statutory retention periods unset.  
7. DPIAs not completed (KYC, cross-border mandatory-path).  
8. No personal-data breach notification / response playbook.  
9. DSR holiday calendar not modelled.  
10. “Copy” right mapping vs access/portability — LEGAL_REVIEW_REQUIRED.  
11. Confirm whether raw IP is ever persisted outside hashed abuse keys.  
12. Marketing / analytics may be consent-ready but inactive — avoid overclaiming processing.

---

## 18. Production blockers

| Blocker | Severity | Owner |
|---------|----------|-------|
| Formal DPO appointment (or documented non-appointment decision with counsel) | **Production blocker** (SSOT `productionBlocker: true`) | Founder + counsel |
| Publishable `privacyContactEmail` | High | Founder |
| PSP legal name + role language | High | Founder + counsel |
| Processor region confirmation + transfer assessment | High | Ops + counsel |
| Privacy Policy finalisation (without mutating `1.1.2-advisor-final` contractual package) | High | Counsel + product |
| KYC / cross-border DPIA path | High | Counsel |
| Breach playbook | Medium–High | Ops + counsel |
| Retention schedule counsel sign-off | Medium–High | Counsel |
| DSR ops: holiday calendar + fulfilment SLAs | Medium | Ops + counsel |

**Non-blockers for this phase (do not regress):** contractual corpus **`1.1.2-advisor-final`** remains unchanged; PAN/CVV non-storage; KYC private streaming; consent unbundling from Terms.

---

*End of INTERNAL Privacy Data Map — Phase 3C.4B.1.*
