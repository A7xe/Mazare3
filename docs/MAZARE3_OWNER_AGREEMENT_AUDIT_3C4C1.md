# Mazare3 Owner Agreement — Product & Commercial Alignment Audit

**Phase:** 3C.4C.1  
**Scope:** AUDIT ONLY — no Owner Agreement rewrite; locked customer legal documents untouched; Production untouched.  
**Corpus under audit:** `packages/shared/src/legal-content/owner-agreement.ts`  
**Current version:** `1.0.1-launch-candidate` (`documentType: owner_agreement`)  
**Status:** DRAFT / launch-candidate — **not** counsel-approved — **not** Production-active  
**Audit date:** 2026-09-14  

---

## Architecture snapshot

| Item | Finding |
|------|---------|
| Corpus source | Single file `owner-agreement.ts` (no frozen historical OA corpus siblings) |
| Version | `1.0.1-launch-candidate` via `finalizeLaunchDocument` default |
| Public page | **None** — not in `DOC_TYPE_TO_PUBLIC_SLUG`; in-app / API when ACTIVE |
| Acceptance evidence | `LegalAcceptance` (`owner_onboarding`, `owner_agreement_update`); legacy bridge `PartnerAgreementAcceptance` |
| Commercial terms | Separate `PartnerCommercialTerms` + `CommercialTermsAcceptance` |
| Soft reacceptance | Blocks **new listing create/update** only; payout/history exempt |
| Seed | Bootstrap placeholder `1.0.0-placeholder` ACTIVE; launch seed DRAFT `1.0.1-launch-candidate`; advisor-revised seed **does not** include OA |
| Admin readiness | `owner_agreement` required for activation; soft-gate documented |

---

## Audit matrix

### 1. Parties / acceptance / re-acceptance

| Field | Detail |
|-------|--------|
| Topic | Parties, recorded acceptance, material re-acceptance |
| Current OA wording | §1 — acceptance during onboarding/re-acceptance; material updates may require re-acceptance before listing tools remain fully available |
| Actual product | `LegalAcceptance` + onboarding bridge; `OwnerAgreementGate` soft gate; `assertOwnerListingSoftGate` on listing create/update; payout paths exempt |
| Status | **ALIGNED** |
| Risk | LOW |
| Rewrite direction | Keep soft-gate framing; clarify payout/history remain accessible |
| Sources | `owner-agreement.ts` §1; `legal-reacceptance.service.ts`; `owner-agreement-gate.tsx`; `owner-property.service.ts` |

### 2. Eligibility / authority to list

| Field | Detail |
|-------|--------|
| Topic | Legal capacity; ownership / management authority; permits |
| Current OA wording | §2 — authority via ownership or lawful management; Owner responsible for permits; Mazare3 does not supply permits |
| Actual product | KYC collects identity/authority docs; **no** full title/lease legal verification product; admin KYC review is operational not title guarantee |
| Status | **PARTIAL** |
| Risk | MEDIUM |
| Rewrite direction | Keep Owner warranty of authority; state Mazare3 does **not** certify legal title; mark evidence list **COUNSEL / PRODUCT REVIEW** |
| Sources | `owner-agreement.ts` §2; `partner-onboarding.service.ts`; partner document review FSM |

### 3. KYC / private storage / Prior Consent

| Field | Detail |
|-------|--------|
| Topic | Onboarding KYC; private storage; KYC ≠ platform_verified |
| Current OA wording | §3 — accurate KYC to private storage; basic KYC ≠ Verified / 15% |
| Actual product | Prior Consent `owner_identity_and_authority_verification`; private R2/S3/local; no public KYC URLs; partner approval ≠ `Property.verificationStatus` |
| Status | **ALIGNED** (product); Prior Consent duty only lightly implied |
| Risk | LOW |
| Rewrite direction | Explicit Prior Consent / accuracy / update duties; list only document types product actually collects |
| Sources | `jordan-prior-consent.ts`; `partner-documents/private-storage.ts`; `owner-agreement.ts` §3 |

### 4. Listings / accuracy / media licence

| Field | Detail |
|-------|--------|
| Topic | Listing accuracy; content licence |
| Current OA wording | §4 — accuracy; **licence** to host/display (not assignment of ownership); Owner sets price/availability |
| Actual product | Owner creates listings; admin approve/publish; media upload **without** rights attestation checkbox |
| Status | **PARTIAL** |
| Risk | MEDIUM |
| Rewrite direction | Keep limited marketplace licence (do **not** take ownership); add unlawful/infringing/privacy prohibitions; optional product attestation later |
| Sources | `owner-agreement.ts` §4; `property-media/*`; Terms §IP |

### 5. Exact location / access instructions

| Field | Detail |
|-------|--------|
| Topic | Approx vs exact location; when Customer sees exact; Owner consent |
| Current OA wording | §4–5 mention location presentation / access arrangements; **no** Prior Consent / privacy gate detail |
| Actual product | Approx public; exact gated until confirmed+paid; Owner Prior Consent `property_and_exact_location_processing` |
| Status | **PARTIAL** |
| Risk | MEDIUM |
| Rewrite direction | Align with Privacy: accurate exact/access info + Prior Consent; no public exact dump |
| Sources | `location-privacy.ts`; `owner-property.service.ts`; Privacy Policy (locked — do not edit) |

### 6. Booking obligations / approval window

| Field | Detail |
|-------|--------|
| Topic | Honour bookings; instant vs approval; 60-minute response |
| Current OA wording | §5 — honour confirmed; access; instant vs approval must match config; **no** 60-minute expiry obligations |
| Actual product | Non-instant → `pending_owner_approval`; default **60 min**; expiry → `expired` + `timed_out`; payment blocked until accept (`OWNER_APPROVAL_REQUIRED`); **no** reliability incident on timeout (category exists unused) |
| Status | **MISSING** (approval-window duties) / **ALIGNED** (honour confirmed) |
| Risk | MEDIUM |
| Rewrite direction | Add keep-availability-current + respond promptly + acceptance creates obligations; **do not** invent auto-penalty for expiry (not implemented) |
| Sources | `owner-approval-config.ts`; `owner-approval-expiry.service.ts`; `payment.service.ts` |

### 7. Customer payment model (Owner-facing explanation)

| Field | Detail |
|-------|--------|
| Topic | Deposit 30% / full ≤72h / balance −48h / BALANCE_NOT_PAID |
| Current OA wording | Imports SSOT constants but **does not narrate** Customer payment windows to Owner |
| Actual product | SSOT + booking hold auto-cancel retain captured deposit only |
| Status | **MISSING** |
| Risk | HIGH |
| Rewrite direction | Summarise Customer payment/balance rules and Owner earnings impact; point to Booking Terms / Cancellation Policy; do not invent tax |
| Sources | `marketplace-financial-policy.ts`; `booking-hold.service.ts`; locked Booking Terms |

### 8. Customer cancellation economics (Owner effect)

| Field | Detail |
|-------|--------|
| Topic | Retain tiers; captured-funds cap; snap commission split |
| Current OA wording | §6 defers Customer cancel detail to Cancellation Policy; **does not** state Owner share = retained − snap commission, nor captured cap |
| Actual product | 0/30/50/100%; `retained = min(captured, policyCharge)`; split via booking `platformCommissionPercent` |
| Status | **PARTIAL** |
| Risk | HIGH |
| Rewrite direction | Explicit: Owner does **not** automatically receive full policy charge if Customer had not paid that amount; platform/Owner split uses snap |
| Sources | `evaluateCancellationSettlement`; `booking.service.ts` cancel path; locked Cancellation Policy |

### 9. Owner-caused cancellation / penalties

| Field | Detail |
|-------|--------|
| Topic | Full Customer refund; payout 0; commission 0; penalty tiers; settlement adjustment |
| Current OA wording | §6 — matches SSOT tiers, min/max JOD, future settlement deduction, **not** automatic card charge; FM no penalty |
| Actual product | `owner-cancellation.service.ts` + `OwnerFinancialAdjustment` pending → settlement apply |
| Status | **ALIGNED** |
| Risk | LOW |
| Rewrite direction | Keep adjustment-not-debit; clarify reliability incident; no double recovery |
| Sources | `owner-cancellation.service.ts`; `owner-reliability.service.ts`; SSOT penalty helpers |

### 10. Owner no-show / access denied

| Field | Detail |
|-------|--------|
| Topic | Customer report → admin confirm → full refund; 20% adjustment |
| Current OA wording | §6 bundles with ≤24h / confirmed Owner no-show / unjustified denied access at 20% clamp |
| Actual product | Separate incident types; payout block; full refund; adjustments `owner_no_show_penalty` / `access_denied_penalty` |
| Status | **ALIGNED** |
| Risk | LOW |
| Rewrite direction | Distinguish clearly from Customer no-show; evidence/admin confirmation |
| Sources | `no-show.service.ts` |

### 11. Customer no-show

| Field | Detail |
|-------|--------|
| Topic | Owner report; 60-min grace; admin confirm; no refund; normal earnings |
| Current OA wording | **Not explained** (only Owner-side no-show) |
| Actual product | Grace `CUSTOMER_NO_SHOW_GRACE_MINUTES=60`; admin confirm; refund 0; normal commission/payout |
| Status | **MISSING** |
| Risk | HIGH |
| Rewrite direction | Owner reporting duties + evidence; distinguish from Owner no-show |
| Sources | `no-show.service.ts`; SSOT grace constant |

### 12. Check-in

| Field | Detail |
|-------|--------|
| Topic | PIN proves handover only |
| Current OA wording | §6 — Check-in PIN proves handover only |
| Actual product | Time-windowed PIN verify |
| Status | **ALIGNED** |
| Risk | LOW |
| Rewrite direction | Optional: window hours from SSOT |
| Sources | `check-in.service.ts` |

### 13. Reschedule

| Field | Detail |
|-------|--------|
| Topic | Mutual acceptance; Owner cannot force higher Customer price |
| Current OA wording | §6 — mutual acceptance; cannot force Customer to pay more solely because Owner requested move |
| Actual product | Modes include `owner_price_freeze` / FM equivalent; owner absorbs upgrade delta; cheaper → refund; counterparty accept required |
| Status | **PARTIAL** |
| Risk | MEDIUM |
| Rewrite direction | Spell Customer-requested vs Owner-requested vs FM-equivalent; cheaper replacement refund; Customer election for FM |
| Sources | `reschedule.service.ts`; `computeReschedulePricing` |

### 14. Force majeure

| Field | Detail |
|-------|--------|
| Topic | Penalty 0; Customer full refund default; voluntary equivalent reschedule |
| Current OA wording | §6 — FM: no penalty (thin on Customer choice / no forced reschedule / ordinary weather) |
| Actual product | Penalty 0; admin classify; Customer chooses FULL_REFUND or EQUIVALENT_RESCHEDULE; admin cannot force |
| Status | **PARTIAL** |
| Risk | MEDIUM |
| Rewrite direction | Align with locked Cancellation/Terms FM choice model; exclude ordinary rain/preference |
| Sources | `force-majeure.service.ts`; locked customer docs |

### 15. Commission model

| Field | Detail |
|-------|--------|
| Topic | 18% / 15% platform_verified; snapshot; custom terms |
| Current OA wording | §7 — SSOT-aligned; KYC alone ≠ 15%; snapshot; custom PartnerCommercialTerms |
| Actual product | `resolveCommissionPercentForListing`; custom terms require acceptance before activation; 12% blocked/audit-flagged only |
| Status | **ALIGNED** |
| Risk | LOW |
| Rewrite direction | Keep; optionally name acceptance gate for custom terms |
| Sources | `marketplace-financial-policy.ts`; `commercial-terms.service.ts`; `payment-policy.config.ts` |

### 16. Commercial terms acceptance

| Field | Detail |
|-------|--------|
| Topic | Default/verified display; custom acceptance; no silent Booking rate change |
| Current OA wording | §7 mentions accepted PartnerCommercialTerms |
| Actual product | Activation requires `CommercialTermsAcceptance`; Booking snap preserves rate |
| Status | **ALIGNED** (product) / **PARTIAL** (OA depth) |
| Risk | LOW |
| Rewrite direction | Explicit: no silent change to already-created Bookings; acceptance evidence |
| Sources | `commercial-terms-acceptance.service.ts` |

### 17. Settlement / payouts / holds

| Field | Detail |
|-------|--------|
| Topic | Settlement cycle; eligibility; holds; adjustments |
| Current OA wording | §8 — eligible earnings after rules/refunds/disputes/adjustments; delay/hold for fraud/chargeback/incidents — not arbitrary confiscation; **no** weekly promise; PSP review comment |
| Actual product | `DEFAULT_SETTLEMENT_CYCLE_DAYS = 21`; payout delay hours (default 24 after slot EOD); adjustments deduct when settlement can cover full item |
| Status | **PARTIAL** |
| Risk | MEDIUM |
| Rewrite direction | **SETTLEMENT_TIMING_REQUIRES_FOUNDER_DECISION** for any published cadence promise; until then keep non-numeric timing; optionally disclose code default as operational not contractual |
| Sources | `settlement-cycle-config.ts`; `payment-policy.service.ts`; `owner-settlement.service.ts` |

### 18. Owner financial adjustments

| Field | Detail |
|-------|--------|
| Topic | What creates adjustments; Owner visibility |
| Current OA wording | §8 mentions adjustments including penalties |
| Actual product | Types: owner_cancel / no_show / access_denied / other; pending→applied/waived; **no** Owner UI listing found |
| Status | **PARTIAL** |
| Risk | MEDIUM |
| Rewrite direction | Documented adjustments under agreed rules; Owner may view in settlement history when product exposes; no arbitrary fines |
| Sources | schema `OwnerFinancialAdjustment`; `owner-reliability.service.ts` |

### 19. No double recovery

| Field | Detail |
|-------|--------|
| Topic | Same loss not recovered twice |
| Current OA wording | **Silent** |
| Actual product | Retain ≤ captured; idempotent system refunds; adjustment apply-once; no DB unique on (booking, adjustment type) |
| Status | **MISSING** (legal) / **PARTIAL** (code guards) |
| Risk | HIGH |
| Rewrite direction | Explicit no double recovery clause; counsel on residual gaps |
| Sources | cancel/refund helpers; settlement apply |

### 20. Promotions / coupons

| Field | Detail |
|-------|--------|
| Topic | Platform vs owner-funded |
| Current OA wording | §9 — follows rules shown; coupons change Customer price only if accepted |
| Actual product | Platform coupon vs owner promo paths exist |
| Status | **ALIGNED** (high level) |
| Risk | LOW |
| Rewrite direction | Keep high-level; avoid inventing fee tax treatment |
| Sources | coupon / platform-coupon services |

### 21. Reviews / verification badge

| Field | Detail |
|-------|--------|
| Topic | Eligible reviews; Verified meaning; no forced positive |
| Current OA wording | §10 — eligible reviews under Community policy; Verified ≠ government cert; may suspend/revoke |
| Actual product | Customer reviews; admin hide/restore; **no** Owner reply; Owner cannot hide |
| Status | **PARTIAL** |
| Risk | LOW |
| Rewrite direction | No guaranteed rating; no removal merely because Owner dislikes; no Owner reply unless product adds it |
| Sources | `review.service.ts`; community-reviews policy |

### 22. Platform verification authority

| Field | Detail |
|-------|--------|
| Topic | Grant/refuse/suspend/revoke platform_verified |
| Current OA wording | §3 + §10 — not permanent if revoked; platform review only |
| Actual product | Admin `patchAdminPropertyVerification`; commission uses status at quote/create snap |
| Status | **ALIGNED** |
| Risk | LOW |
| Rewrite direction | Non-arbitrary / non-discriminatory policy grounds; not safety/title guarantee |
| Sources | `admin.service.ts`; VerificationStatus enum |

### 23. Taxes / licences

| Field | Detail |
|-------|--------|
| Topic | Owner tax & licence responsibility |
| Current OA wording | §11 — Owner responsible; does not invent Jordan tax rules; COUNSEL comment |
| Actual product | No tax classification engine |
| Status | **LEGAL_REVIEW_REQUIRED** |
| Risk | MEDIUM |
| Rewrite direction | Cautious wording only; **COUNSEL_REVIEW_REQUIRED** |
| Sources | `owner-agreement.ts` §11 |

### 24. Data / privacy / confidentiality

| Field | Detail |
|-------|--------|
| Topic | Customer PD use limits |
| Current OA wording | §12 — only to host Bookings + Privacy/law; keep non-public contact confidential |
| Actual product | Owner inbox exposes **customerName** primarily; Privacy architecture locked separately |
| Status | **PARTIAL** |
| Risk | MEDIUM |
| Rewrite direction | Align with Privacy: no export/resell/marketing without basis; incident evidence duties; DSR cooperation where required — **do not edit Privacy** |
| Sources | `owner.service.ts` booking inbox; locked Privacy Policy |

### 25. Security

| Field | Detail |
|-------|--------|
| Topic | Credentials; compromise reporting; shared accounts |
| Current OA wording | **Missing** |
| Actual product | Standard auth; no Owner enterprise API security product |
| Status | **MISSING** |
| Risk | LOW |
| Rewrite direction | Reasonable account-security duties only |
| Sources | auth middleware |

### 26. Liability / indemnity

| Field | Detail |
|-------|--------|
| Topic | Indemnity breadth; one-sided liability |
| Current OA wording | §13 — points to Terms marketplace limitations; mandatory rights preserved; **no** standalone Owner indemnity |
| Actual product | N/A (legal) |
| Status | **LEGAL_REVIEW_REQUIRED** |
| Risk | HIGH |
| Rewrite direction | Commercially protective, not abusive; avoid unlimited indemnity for Mazare3 negligence; **do not rewrite in this phase** |
| Sources | `owner-agreement.ts` §13; locked Terms liability |

### 27. Platform role

| Field | Detail |
|-------|--------|
| Topic | Marketplace intermediary; not Property operator |
| Current OA wording | Relies on Terms via §13; OA itself thin on role |
| Actual product / locked Terms | Marketplace; not escrow; not insurer; not government verifier |
| Status | **PARTIAL** |
| Risk | MEDIUM |
| Rewrite direction | Mirror Terms role language in OA; **never** claim escrow/travel-agency without counsel |
| Sources | locked Terms §platform role |

### 28. Insurance / property damage

| Field | Detail |
|-------|--------|
| Topic | Damage deposit; insurance; auto card charge |
| Current OA wording | **Silent** |
| Actual product | **None** — no deposit hold / insurance / auto damage charge |
| Status | **MISSING** (and should stay non-promising) |
| Risk | HIGH if invented |
| Rewrite direction | Explicitly: no platform insurance/damage-deposit product; disputes via support — no guaranteed recovery; no auto Customer card charge |
| Sources | locked Terms (no damage-deposit hold); absence of product services |

### 29. Reliability / suspension / termination

| Field | Detail |
|-------|--------|
| Topic | Incidents; suspension; exit |
| Current OA wording | §6 reliability may apply; §14 terminate prospectively; surviving financial duties |
| Actual product | Incidents + financial adj; **no** auto warning/delist ladder; admin partner suspend (bookings/properties unchanged flag); property suspend/unpublish; no Owner self-serve exit unwind |
| Status | **PARTIAL** |
| Risk | MEDIUM |
| Rewrite direction | Grounds + notice + emergency exception; treatment of open Bookings / due payouts; no arbitrary confiscation; no invented auto-delisting |
| Sources | `partner-admin.service.ts`; `property-status-fsm.ts`; `owner-reliability.service.ts` |

### 30. Consistency with locked customer documents

| Field | Detail |
|-------|--------|
| Topic | Terms / Cancellation / Booking / Privacy `1.1.2-advisor-final` |
| Current OA wording | Older launch-candidate; commercially closer on commission/penalties; thinner on Customer payment/cancel economics, Customer no-show, FM choice, Privacy Prior Consent |
| Actual product | Locked docs are customer SSOT; OA must not contradict |
| Status | **PARTIAL** / mismatch findings only |
| Risk | HIGH for economic mismatches until rewrite |
| Rewrite direction | Phase 3C.4C.2+ rewrite against this matrix — **do not modify locked docs** |
| Sources | locked corpora versions; this matrix |

---

## Highest-risk gaps (summary)

1. **Customer payment & cancellation economics** not explained to Owner (captured-funds cap / snap split).  
2. **Customer no-show** Owner duties missing.  
3. **60-minute approval window** obligations missing (and timeout has no reliability penalty in code — do not invent).  
4. **No double recovery** clause missing.  
5. **Insurance/damage** silence could be misread — must later disclaim.  
6. **Liability/indemnity** under-specified relative to commercial risk — counsel.  
7. **Settlement timing** — code default 21 days; contractual promise still **SETTLEMENT_TIMING_REQUIRES_FOUNDER_DECISION**.  
8. **Tax/licence** — COUNSEL_REVIEW_REQUIRED.

---

## Explicit non-actions (this phase)

- Owner Agreement **not** rewritten.  
- Locked Terms / Cancellation / Booking / Privacy **not** modified.  
- Commission / financial SSOT **not** changed.  
- Production **not** touched.
