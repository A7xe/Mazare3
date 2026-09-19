# Mazare3 — Property Gate Matrix (Regulatory Readiness Design)

**Phase:** 3C.4D.2 — DESIGN ONLY  
**Date:** 2026-09-16  
**Prerequisite:** 3C.4D.1 Add Your Farm audit  
**Non-actions:** No schema migration · No live Booking-gate change · No locked legal edits · No Production

---

## Design principles

1. **Three gates, not one:** Draft ≠ Publication ≠ Paid Booking.
2. **Fail closed on paid Booking:** unresolved *applicable required* regulatory requirements block paid Bookings.
3. **Do not invent Jordan licence law:** applicability is review-driven; activity profile is an *input*, not a hard-coded licence map.
4. **No self-certification** of `verified` / `not_applicable_confirmed` by Owner alone.
5. **Platform verification (`platform_verified`) ≠ regulatory readiness ≠ Owner KYC.**

### Current production behavior (baseline — unchanged this phase)

| Gate | Today (code) |
|------|----------------|
| Draft | Approved Owner (+ soft Owner Agreement when active) |
| Publish | Admin Property FSM + media completeness |
| Paid Booking | `Property.status === published` **and** `OwnerStatus === approved` |

---

## Legend for matrix cells

| Cell | Meaning |
|------|---------|
| **REQ** | Required / blocking for that stage |
| **REC** | Recommended / soft (UX or admin preference; not hard-block) |
| **OPT** | Optional |
| **N/A** | Not applicable at that stage |
| **DERIVED** | Computed from other rows |
| **COUNSEL** | Legal basis / applicability needs counsel — product holds a slot only |

**Blocking?** = whether failure of the requirement must stop that gate when the requirement is in scope.

---

## Final gate matrix

| Requirement | Owner onboarding | Draft | Submit review | Public publication | Paid Booking | Payout | Reassessment trigger | Blocking? | Source of truth |
|-------------|------------------|-------|---------------|--------------------|--------------|--------|----------------------|-----------|-----------------|
| Authentication (logged-in User) | REQ | REQ | REQ | REQ | REQ (session/Customer) | REQ | — | Yes | Session / User |
| Account Terms acceptance (when active) | REQ | REQ | REQ | REQ | REQ (Customer+Owner roles per policy) | Soft (history readable) | Material Terms reacceptance | Yes for contractual actions | `LegalAcceptance` |
| Privacy acknowledgement (when active) | REQ | REC | REQ | REQ | REQ (Customer path) | Soft | Material Privacy reacceptance | Soft/Yes per first-run policy | `LegalAcceptance` |
| Prior Consent: `account_registration_and_authentication` | REQ | REQ | REQ | REQ | REQ | REQ | Purpose text change | Yes | `DataProcessingConsent` |
| Prior Consent: `owner_account_and_marketplace_operation` | **COUNSEL** — wire or reclassify (today unwired) | COUNSEL | COUNSEL | COUNSEL | COUNSEL | COUNSEL | Purpose change | TBD counsel | Inventory purpose (unwired) |
| Prior Consent: KYC `owner_identity_and_authority_verification` | REQ before KYC upload | N/A (already done) | REQ (must remain valid) | REQ | REQ | N/A | KYC category expansion | Yes | `DataProcessingConsent` |
| Prior Consent: exact location `property_and_exact_location_processing` | N/A | REQ when collecting exact fields | REQ if exact present | REQ if exact retained | REQ for reveal path | N/A | Location/consent text change | Yes for exact processing | `DataProcessingConsent` |
| Prior Consent: payout `owner_payout_and_financial_processing` | OPT (post-approve) | N/A | N/A | REC | **REC→REQ before first payout**; not before Booking if funds can be held | REQ | Purpose change | Yes for payout write/disburse | `DataProcessingConsent` |
| Optional marketing / analytics consent | OPT | OPT | OPT | OPT | OPT | OPT | Preference change | No | `PrivacyConsent` |
| Owner Agreement acceptance (when ACTIVE release exists) | REQ (PartnerAgreement bridge / LegalAcceptance) | Soft gate on create | Soft/REQ | REQ | REQ | Soft (payouts exempt from soft lockout) | Material OA reacceptance | Yes for listing/Booking offer | `LegalAcceptance` / PartnerAgreement |
| Commercial terms acceptance | If custom terms: before Owner approve | N/A | N/A | REQ (resolved terms) | REQ (snapshot on Booking) | N/A | New custom terms activation | Yes when custom | `CommercialTermsAcceptance` + Booking snapshot |
| Owner identity / KYC completeness | REQ | REQ (Owner approved chain) | REQ | REQ | REQ | REQ | Entity/identity change | Yes | `OwnerVerificationProfile` + `OwnerDocument` |
| Authority-to-list evidence | REQ (ownership / management docs) | REC | REQ (reviewed or under review) | REQ reviewed for blocking authority | REQ | N/A | Operator / authority change | Yes | Authority docs + later Operator profile |
| Owner legal-capacity profile (entity / representative) | Partial today (`individual`/`business`) | REC | REQ (declared) | REQ assessed | REQ | REQ (beneficiary match) | Entity/operator change | Yes once model lands | Future Operator capacity model |
| Owner approval (`OwnerStatus.approved`) | Outcome of onboarding | REQ | REQ | REQ | REQ | REQ | Suspend/reject | Yes | `OwnerStatus` |
| Property content completeness (title, media floor, city/area, approx, price) | N/A | OPT (partial OK) | REQ (listing completeness) | REQ | REQ | N/A | Material listing change | Yes | Property + media guards |
| Activity profile (multi-select) | N/A | REC | REQ | REQ | REQ | N/A | Activity add/remove | Yes for applicability | Future `PropertyActivityProfile` |
| Regulatory requirement set (instances) | N/A | OPT | REC (seeded from profile) | REQ assessed | REQ readiness = READY | N/A | Activity/location/operator | Yes on Booking | Future requirement instances |
| Regulatory readiness (derived) | N/A | N/A | May be INCOMPLETE | Prefer READY; allow preview mode if defined | **REQ = READY** | N/A | Any applicable req change | **Yes on Booking** | Derived from instances |
| Regulatory document expiry (blocking docs) | N/A | N/A | Warn | Block publish if expired blocking | **Block new paid Booking** | N/A | Calendar expiry | Yes (new Bookings) | Evidence `expiresAt` |
| Exact location data quality | N/A | OPT | REQ for submit if policy | REQ for publish | REQ for post-Booking reveal | N/A | Location change | Yes for reveal | Property location fields |
| Admin Property content approval | N/A | N/A | Pending | REQ (`approved`→`published`) | REQ (published) | N/A | Content rejection | Yes | `PropertyStatus` |
| Platform verification (`platform_verified`) | N/A | N/A | N/A | OPT (commission only) | **Not required** for Booking | N/A | Revoke (future commission) | No for bookability | `VerificationStatus` |
| Payout profile (IBAN / beneficiary) | OPT | N/A | N/A | REC | **C: complete before first payout** (see policy); hold funds OK | REQ + reviewed | Beneficiary/entity mismatch | Yes for disburse | `OwnerPayoutProfile` |
| Suspension (Owner or Property) | Blocks progress | Blocks | Blocks | Blocks | Blocks | Blocks disburse | Admin suspend | Yes | Owner/Property status |
| Listing accuracy attestation | N/A | OPT | REQ | REQ | REQ (evidence retained) | N/A | Material edit | Yes once shipped | Future attestation records |
| Regulatory evidence authenticity attestation | N/A | OPT | REQ if docs uploaded | REQ | REQ | N/A | Doc renew | Soft/Yes | Future attestation |

---

## Recommended three-gate baseline

### A. Draft creation — **permissive**

**Minimum prerequisites**

- Authenticated User  
- Account not admin-blocked  
- Owner applicant path: `OwnerProfile` exists **or** approved Owner  
- Prefer: Owner `approved` for `/owner/properties/new` (current product); applicants without approval stay on become-owner  
- Soft Owner Agreement gate when OA active and reacceptance required  
- Exact-location Prior Consent **only if** exact fields are written  

**Must not:** be publicly discoverable · accept Bookings · imply regulatory approval  

### B. Submit for review — **content + declaration complete; regulatory may be incomplete**

**Minimum prerequisites**

- `OwnerStatus.approved`  
- Activity profile declared (multi-activity)  
- Authority-to-list information present (docs uploaded; need not be finally verified to *submit*)  
- Listing completeness (city, area, approx + exact per current rules, base price, ≥1 media)  
- Owner attestations (authority, accuracy, genuine evidence) — design for later  
- Required Prior Consents for data already collected  
- Regulatory requirement instances may be `not_assessed` / Owner uploads pending  

**Must not require:** full `regulatory readiness = READY` merely to enter admin queue  

### C. Public publication — **identity + content + regulatory assessment complete**

**Safest practical publication gate**

- Owner approved and not suspended  
- Property content approved by admin  
- Authority evidence reviewed (approved for blocking authority docs)  
- Activity profile present  
- Every applicable required regulatory requirement is `verified` **or** `not_applicable_confirmed`  
  - i.e. derived readiness = `ready`  
- No expired *blocking* regulatory evidence  
- No open `action_required` / `rejected` on applicable required requirements  
- Exact-location consent valid if exact stored  
- Owner Agreement + resolved commercial terms accepted when those releases/terms are active  

**Optional separate mode:** `public_preview` / discoverable-but-not-bookable — **only if** product explicitly introduces a status distinct from normal `published`. Do **not** silently treat today’s `published` as legally READY.

### D. Paid Booking — **strongest / fail-closed**

Conceptual `canAcceptPaidBooking(propertyId)` requires:

- Owner `approved`, not suspended  
- Property published (or explicit bookable status), not suspended  
- Admin content approval path satisfied  
- Owner Agreement accepted when active  
- Commercial terms resolved + accepted (default or custom)  
- Required Prior Consents for Owner operational / KYC / exact-location (as applicable) valid  
- **Regulatory readiness = `ready`**  
- No blocking expired requirement  
- Operational availability (slots / not blocked by operations)  
- Platform verification **not** required  

**Fail-closed rule (explicit):** for each *applicable required* regulatory requirement, only `verified` or `not_applicable_confirmed` satisfies.  
`not_assessed` · `under_review` · `action_required` · `expired` · `rejected` · unknown → **block paid Booking**.

### E. Payout — **before first disbursement (recommended)**

See Bookability Policy § payout. Complete + reviewed payout profile + payout Prior Consent + beneficiary reasonably matches contracting Owner/operator. **Not** required for draft/submit; **not** preferred as a hard Booking blocker if platform can hold funds safely.

---

## Consent gate matrix (detail)

| Consent / acceptance | Onboarding | Draft | Submit | Publish | Paid Booking | Payout |
|----------------------|------------|-------|--------|---------|--------------|--------|
| Terms | REQ | REQ | REQ | REQ | REQ | Soft read |
| Privacy ack | REQ | REC | REQ | REQ | REQ (Customer) | Soft |
| Owner Agreement | REQ when active | Soft create | Soft/REQ | REQ | REQ | Soft (exempt lockout) |
| Commercial terms | Custom: pre-approve | — | — | REQ | REQ + snapshot | — |
| KYC Prior Consent | REQ pre-upload | — | valid | valid | valid | — |
| Exact-location Prior Consent | — | if exact write | if exact | if exact | for reveal | — |
| Payout Prior Consent | OPT | — | — | REC | REC | REQ |
| Marketing optional | OPT | OPT | OPT | OPT | OPT | OPT |
| `owner_account_and_marketplace_operation` | **COUNSEL_REVIEW_REQUIRED** | same | same | same | same | same |

---

## Implementation roadmap (dependency order)

| Phase | Scope |
|-------|--------|
| **3C.4D.3** | Owner/entity/authority & operator capacity model + attestations hooks |
| **3C.4D.4** | Regulatory requirement/evidence model + expiry + derived readiness + admin decision audit |
| **3C.4D.5** | Pool/safety conditional assessment (`pool_regulatory_assessment`) |
| **3C.4D.6** | Listing + regulatory-reference Booking snapshots |
| **3C.4D.7** | Payout beneficiary matching + Prior Consent closure (`owner_account_…` counsel-led) |

Then: wire `canAcceptPaidBooking` / publication policy **after** 3C.4D.4 data exists (separate activation phase).

---

## Locked documents

Unchanged: Terms / Cancellation / Booking / Privacy `1.1.2-advisor-final`; Owner Agreement `1.1.1-advisor-final`.
