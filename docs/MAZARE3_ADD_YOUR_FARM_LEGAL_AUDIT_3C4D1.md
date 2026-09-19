# Mazare3 — Add Your Farm Legal / Product Compliance Audit

**Phase:** 3C.4D.1  
**Scope:** AUDIT ONLY — no product, schema, legal, or Production changes  
**Date:** 2026-09-16  
**Locked legal docs (unchanged):** Terms / Cancellation / Booking / Privacy `1.1.2-advisor-final`; Owner Agreement `1.1.1-advisor-final` (all DRAFT / not Production-active)

---

## Executive verdict

The current flow can take a user from public CTA → partner KYC → admin Owner approval → Property draft → admin publish → Bookings. Commercially core pieces (commission SSOT, private KYC, exact-location gating, soft Owner Agreement reacceptance, Booking financial snapshots) are largely in place.

**Critical gap:** regulatory tourism / municipal / pool / insurance compliance is almost entirely **absent** as structured product data. Mazare3 currently relies on Owner self-responsibility in legal text while allowing Bookings after KYC + content approval alone. Identity approval, Property content approval, and platform verification are **conflated in practice** with “ready to operate” even though they are separate concepts in code enums.

---

## Audit matrix

| Topic | Current product behavior | Legal/commercial concern | Status | Risk | Required action | Code reference |
|-------|--------------------------|--------------------------|--------|------|-----------------|----------------|
| Public CTA → Become Owner | CTAs resolve to `/become-owner` or `/owner/properties/new` | Entry is clear | ALIGNED | LOW | Keep | `add-farm-entry.ts`, bottom nav, home |
| Who can start | Guest → auth; customer can create `OwnerProfile`; admin blocked; rejected/suspended locked | Account operator ≠ legal Property owner not distinguished | PARTIAL | HIGH | Model account holder vs authority party | `become-owner-view.tsx`, `partner-onboarding.service.ts` |
| Entity types | `individual` \| `business` only | No authorised representative / company-officer role | PARTIAL | HIGH | COUNSEL + product: representative / legal-entity party | `PartnerEntityType` |
| Authority to list | Required `property_ownership` doc; optional `management_authorization` for individual | Checkbox-free but docs are free-form; **no title verification claim in product** — good. Labels say ownership/management | PARTIAL | HIGH | Clarify evidence types; do not claim title verification | `partner-requirements.config.ts` |
| Regulatory activity type | `allowsOvernight` on Property; day periods via availability; `allowsEvents` in search but **not owner-editable** | Assumes similar path for all farms | MISSING | HIGH | Conceptual activity taxonomy before Booking gate | Property schema; owner schemas |
| Tourism classification / registration | **Not collected** | Reg. 50/2025 framework not represented; risk of misstating “Ministry of Tourism licence” | MISSING | CRITICAL | COUNSEL / REGULATORY CONFIRMATION REQUIRED; do not invent “farm” category | No schema fields |
| Professional / municipal licence | **Not collected** | Amman vs municipality not modeled | MISSING | CRITICAL | Conditional licence capture by location/activity | — |
| Tourism approval ≠ KYC ≠ verification | Only KYC + `Property.status` + `VerificationStatus` | Three concepts exist for KYC/listing/platform badge; **no regulatory status** | CONFLICT | CRITICAL | Separate REGULATORY_COMPLIANCE status | schema enums |
| Swimming pool | Amenity + `poolsCount` sync only | Pool published without health/safety evidence; private vs public pool unclear | MISSING | HIGH | POOL_REGULATORY_SCOPE_COUNSEL_CONFIRMATION_REQUIRED | `photos-amenities-step.tsx` |
| Critical safety data | Free-text rules; amenity flags only | Material hazards can be omitted while published | MISSING | HIGH | Minimal material-disclosure attestation + optional safety prompts | PropertyRule |
| Listing accuracy attestation | **No** explicit accuracy/authority attestation on Add Farm submit | Consumer-protection gap | MISSING | HIGH | Explicit attestation before submit/publish | add-farm wizard |
| Capacity / price validation | Capacity ≥1; `basePrice` positive; no max | Impossible extremes partially blocked; no max price | PARTIAL | MEDIUM | Reasonable bounds | `owner-onboarding` schemas |
| Price / off-platform | JOD default; no listing WhatsApp/bank payment fields found | Circumvention via free-text description still possible | PARTIAL | MEDIUM | Moderate description; policy enforcement | property form |
| Commission disclosure | Review shows resolved % (default 18); 15% via `platform_verified` later | Verified rate not fully explained as qualification path in onboarding | PARTIAL | MEDIUM | Clearer 18/15 + KYC≠15 copy | `partner-wizard-steps.tsx`, SSOT |
| Custom commercial terms | Required for approve if custom terms present | Aligned | ALIGNED | LOW | Keep | commercial-terms services |
| Owner Agreement acceptance | PartnerAgreement + LegalAcceptance bridge when active OA exists; soft reacceptance later | Architecture OK; OA still DRAFT not Production-active | PARTIAL | MEDIUM | Activate only after counsel; keep soft gate | partner accept; `owner-agreement-gate` |
| Prior Consents | KYC, exact location, payout wired; `owner_account_and_marketplace_operation` defined but **not asserted** | Incomplete purpose gating | PARTIAL | HIGH | Wire missing purpose; keep separation | `jordan-prior-consent.ts` |
| Privacy ack / Terms | Registration/clickwrap elsewhere; partner flow focuses PartnerAgreement | Ensure Terms/Privacy still required for account | PARTIAL | MEDIUM | Confirm account-level gates remain | auth / legal middleware |
| KYC storage | Private R2/S3/local; no public URLs; auth download | Aligned | ALIGNED | LOW | Keep private | `partner-documents/*` |
| Payout / IBAN | Encrypted; masked; Prior Consent; post-approval; not required for partner submit | Third-party beneficiary matching not enforced | PARTIAL | HIGH | Beneficiary vs Owner/entity review rule | payout profile |
| Exact location | Approx public; exact gated; API Prior Consent | Add Farm UI may collect exact without checkbox (API enforces) | PARTIAL | MEDIUM | Align UI consent with API | location privacy; owner-property |
| Document inventory | identity, ownership, management_auth, business_reg, payout_proof, other | No tourism/municipal/insurance/pool docs | MISSING | CRITICAL | Regulatory document model | PartnerDocumentType |
| Document expiry | **None** | Expired regulatory docs can continue indefinitely | MISSING | CRITICAL | Expiry + Booking-gate policy (not historical cancel) | OwnerDocument |
| Insurance | Not in product; legal says Mazare3 doesn’t provide | Applicability unknown | MISSING | HIGH | COUNSEL / REGULATORY CONFIRMATION REQUIRED | — |
| Admin RBAC | Any `admin` role for partner/property approve | Coarse but server-side | PARTIAL | MEDIUM | Consider capability split for KYC vs publish | `requireAdmin` |
| Owner vs Property approval | Separated: Owner approve ≠ Property publish | Trusted Owner does not auto-publish Property | ALIGNED | LOW | Keep | partner-admin; FSM |
| Auto-approval | No partner/property auto-approve; instant booking is Booking-only | Aligned | ALIGNED | LOW | Keep | — |
| Publication gate | Admin `approved→published` + media completeness | No regulatory gate | PARTIAL | CRITICAL | Stronger Booking gate than draft | FSM; media guards |
| Booking eligibility | `published` + `owner.approved` | Weakest legal/regulatory gate relative to risk | CONFLICT | CRITICAL | Strongest gate on paid Booking acceptance | `isPropertyCurrentlyBookable` |
| Draft before compliance | Allowed | Acceptable if Booking gated | ALIGNED (draft) | LOW | Keep draft permissive | draft API |
| Platform Verified badge | Separate; policy says not government | Search “verified” includes `platform_reviewed` | PARTIAL | MEDIUM | Align filter with badge meaning | search + badge |
| Safety/pool “certified” badges | Not found | Good | ALIGNED | LOW | Keep | — |
| Rejection / correction UX | changes_requested + status panel; rejected terminal | Rejected cannot self-reopen | PARTIAL | MEDIUM | Clear restore path | partner FSM |
| Data minimisation | KYC + contact + optional bio/farm count | Generally necessary; bio/farm count optional | PARTIAL | LOW | Review optional fields | onboarding |
| Abandoned applications | No purge TTL | Retention unresolved | MISSING | MEDIUM | PRIVACY_RETENTION_DECISION_REQUIRED | — |
| Electronic evidence | LegalAcceptance, PartnerAgreementAcceptance, CommercialTermsAcceptance, audits | PartnerAgreement acceptance lacks content hash on row (hash on agreement) | PARTIAL | MEDIUM | Prefer hash on acceptance | schema |
| Post-Booking listing edits | Core listing locked when published; slot prices mutable; no amenity snapshot | Historical amenity evidence gap | PARTIAL | HIGH | Snapshot material listing facts at Booking | booking + property guards |
| Off-platform payment | No dedicated listing payment fields | Free-text circumvention residual | PARTIAL | MEDIUM | Policy + moderation | — |

---

## Critical risks

1. **Paid Bookings without structured regulatory compliance status** (tourism/municipal/activity-specific).  
2. **No tourism / municipal / insurance document model** while legal text assigns compliance to Owner.  
3. **Pool amenity publishable without any compliance/safety capture** (`POOL_REGULATORY_SCOPE_COUNSEL_CONFIRMATION_REQUIRED`).  
4. **Conflation risk:** KYC + Property publish treated as operational readiness without REGULATORY layer.  
5. **Document expiry non-existent** — stale evidence can underpin ongoing Bookings.

---

## High risks

- Account holder ≠ Property authority not modeled.  
- No listing accuracy attestation.  
- No amenity/safety snapshot on Booking.  
- Payout to unmatched third-party beneficiary possible without strong matching rule.  
- Prior Consent purpose `owner_account_and_marketplace_operation` unwired.  
- Activity types (day-use / overnight / events) incomplete for regulatory branching.

---

## Medium risks

- Commission verified-rate UX under-explained at onboarding.  
- Soft OA reacceptance (correctly) doesn’t block payouts — ensure Owners still see OA.  
- Coarse admin RBAC.  
- Abandoned draft retention undecided.  
- Free-text off-platform circumvention.

---

## Recommended remediation phases (do not implement in 3C.4D.1)

| Phase | Focus |
|-------|--------|
| 3C.4D.2 | Gate matrix product design: draft permissive; publish content+identity; **Booking = strongest** regulatory/commercial gate |
| 3C.4D.3 | Authority + Owner-type (representative/entity) + attestation UX |
| 3C.4D.4 | Regulatory document model + expiry + activity taxonomy (counsel-led) |
| 3C.4D.5 | Pool/safety material disclosure (counsel-scoped) |
| 3C.4D.6 | Booking listing snapshot for amenities/rules/capacity |
| 3C.4D.7 | Payout beneficiary matching + Prior Consent completeness |

---

## Explicit non-actions (this phase)

- No code/schema/legal changes for remediation  
- Locked legal documents untouched  
- Production untouched  
- No migrations
