# Mazare3 Owner Commercial Facts — Phase 3C.4C.1

**Purpose:** Factual / concise SSOT for future Owner Agreement rewrite.  
**Source of truth:** Code + `marketplace-financial-policy.ts` — not legal prose.  
**Owner Agreement corpus version (unchanged):** `1.0.1-launch-candidate` DRAFT  

---

## Commission

| Fact | Value |
|------|-------|
| STANDARD | **18%** |
| PLATFORM_VERIFIED | **15%** |
| Qualifier for 15% | `Property.verificationStatus === 'platform_verified'` only |
| Basic KYC alone → 15%? | **No** |
| `platform_reviewed` / `owner_uploaded` / `unverified` | **18%** |
| Custom override | Active accepted `PartnerCommercialTerms` (property then owner scope) |
| Snapshot | Yes — Booking `platformCommissionPercent` (+ amounts) at create; not re-resolved from verification on later events except financial rebuild paths that preserve/reuse snap rules |
| Obsolete 12% | Not an active rate; env `12` blocked; custom 12% audit-flagged `obsoleteLegacy12` |

---

## Custom commercial terms

| Fact | Value |
|------|-------|
| Model | `PartnerCommercialTerms` (`commissionBps`, optional payout delay, window, status) |
| Activation | Requires `CommercialTermsAcceptance` evidence |
| Silent change to existing Bookings | **No** — Booking snap preserved |
| Acceptance evidence | `acceptedAt`, `acceptedByUserId`, `evidenceSource`, optional hash/admin issuer |

---

## Customer payment windows

| Rule | Value |
|------|-------|
| Deposit | **30%** (property may override via resolver) |
| Start > 72h | Deposit **or** full allowed |
| Start ≤ 72h | **Full payment required** |
| Balance due | Booking start **− 48h** |
| Unpaid balance | Auto-cancel `BALANCE_NOT_PAID`; **retain captured only** (typically deposit); no extra Customer collection |

---

## Customer cancellation → Owner economics

| Hours until start | Policy charge % of merchant value |
|-------------------|-----------------------------------|
| > 72h | 0% |
| > 48h and ≤ 72h | 30% |
| > 24h and ≤ 48h | 50% |
| ≤ 24h (and > 0) | 100% |

| Constraint | Value |
|------------|-------|
| Retained | `min(captured, policyCharge)` |
| Platform share | Retained × **Booking commission snap** |
| Owner share | Retained − platform share |
| Implication | Owner does **not** get “full policy charge” if Customer had not paid that much |

---

## Owner-caused cancellation

| Effect | Value |
|--------|-------|
| Customer | Full refund of refundable captured |
| Owner payout for Booking | **0** |
| Platform commission on refunded amount | **0** |
| Reliability | Incident recorded |
| Force majeure | Penalty **0**; reliability category `force_majeure` |

### Owner penalty tiers (ordinary Owner fault)

| Condition | % of merchant | Clamp |
|-----------|---------------|-------|
| > 72h | 0% | — |
| > 24h and ≤ 72h | 10% | min **10** / max **50** JOD |
| ≤ 24h | 20% | same |
| Owner no-show / access denied (confirmed) | 20% | same |

| Mechanism | Value |
|-----------|-------|
| Collection | `OwnerFinancialAdjustment` → future settlement deduction |
| Automatic Owner card/bank debit? | **No** |

---

## No-show

### Owner no-show / access denied

| Step | Value |
|------|-------|
| Report | Customer |
| Confirm | Admin |
| Customer refund | Full (refundable captured) |
| Owner payout | 0 |
| Commission | 0 |
| Adjustment | 20% clamped |
| Reliability | Yes |

### Customer no-show

| Step | Value |
|------|-------|
| Report | Owner |
| Grace | **60 minutes** after start |
| Confirm | Admin |
| Preconditions (product) | Paid; no check-in; no Owner fault; no FM (as gated in service) |
| Customer refund | **0** |
| Owner earnings | Normal |
| Platform commission | Normal |

---

## Owner approval window

| Fact | Value |
|------|-------|
| Status | `pending_owner_approval` |
| Default expiry | **60 minutes** |
| On expiry | Booking `expired`; `OwnerDecisionOutcome.timed_out` |
| Payment before accept | Blocked (`OWNER_APPROVAL_REQUIRED`) |
| Reliability incident on timeout? | **Not implemented** (category exists unused) |

---

## Reschedule

| Mode aspect | Fact |
|-------------|------|
| Counterparty acceptance | Required |
| Owner/FM higher replacement | Must **not** raise Customer contracted price (Owner absorbs) |
| Cheaper replacement | Customer difference refunded where applicable |
| FM equivalent | Customer **elects**; cannot be forced; full refund remains default entitlement |

---

## Force majeure

| Fact | Value |
|------|-------|
| Owner penalty | **0** |
| Customer default | Full refund entitlement |
| Equivalent reschedule | Voluntary Customer election |
| Ordinary rain/preference | Not automatic FM |

---

## Settlement / payout

| Fact | Value |
|------|-------|
| Code default cycle | **21 days** (`DEFAULT_SETTLEMENT_CYCLE_DAYS`) |
| Weekly promise in code? | **No** |
| Contractual timing for OA | **SETTLEMENT_TIMING_REQUIRES_FOUNDER_DECISION** |
| Payout delay (config) | Default **24h** after slot end-of-day UTC (env) |
| States | Settlement item pending / available / paid (see settlement services) |
| Holds | Dispute / fraud / blocking statuses can delay |
| Adjustments | Pending deductions applied when net can cover full adjustment |
| Owner UI for adjustments | **UNKNOWN / LIMITED** — no dedicated Owner adjustments surface found |

---

## KYC / approval / verification

| Fact | Value |
|------|-------|
| KYC storage | Private R2 / S3 private / local private |
| Public KYC URLs | **No** |
| Prior Consent (KYC) | Required gate |
| Owner approval | Partner KYC + `OwnerStatus` |
| Platform Verified | Separate `Property.verificationStatus` |
| Verified means | Platform review badge / commission — **not** government / safety / title guarantee |

---

## Owner Agreement acceptance / reacceptance

| Fact | Value |
|------|-------|
| Corpus version | `1.0.1-launch-candidate` DRAFT |
| Public OA page | **None** |
| Evidence | `LegalAcceptance` (+ legacy PartnerAgreement bridge) |
| Soft reacceptance | Blocks **new listing** actions |
| Blocks payout / history? | **No** (product gate exempts) |
| Custom commercial terms | Separate acceptance; required to activate |

---

## Insurance / damage

| Fact | Value |
|------|-------|
| Platform damage deposit | **None** |
| Platform insurance | **None** |
| Auto charge Customer card for damage | **None** |

---

## Tax / licence

| Fact | Value |
|------|-------|
| Product classification | **None** |
| OA / future wording | Owner responsible for applicable obligations |
| Exact regulatory text | **COUNSEL_REVIEW_REQUIRED** / **ACCOUNTANT / COUNSEL REVIEW REQUIRED** |

---

## Unknowns / decisions still open

| ID | Status |
|----|--------|
| Settlement cadence as **contractual** promise | **SETTLEMENT_TIMING_REQUIRES_FOUNDER_DECISION** |
| Exact authority evidence checklist (title/lease/management) | **COUNSEL / PRODUCT REVIEW** |
| Jordan tax / tourism licensing wording | **COUNSEL_REVIEW_REQUIRED** |
| Owner indemnity package | **LEGAL_REVIEW_REQUIRED** (rewrite phase) |
| Auto reliability ladder / delisting | **Not implemented** — do not invent |
| Owner self-serve account exit unwind | **MISSING** as product flow |
