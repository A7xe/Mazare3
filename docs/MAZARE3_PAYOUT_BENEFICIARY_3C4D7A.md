# Mazare3 — Payout Beneficiary Identity Matching (Phase 3C.4D.7A)

**Status:** Implemented (local/dev). Production untouched.  
**Flag:** `PAYOUT_THIRD_PARTY_BENEFICIARY_COUNSEL_CONFIRMATION_REQUIRED = true`

## Model

Extends existing `OwnerPayoutProfile` (encrypted beneficiary/bank/IBAN):

| Field | Purpose |
| --- | --- |
| `contractingOperatorPartyId` | Contracting OperatorParty at last material save |
| `beneficiaryRelationship` | `operator_self` / `operator_legal_entity` / `authorised_third_party` / `other_review_required` |
| `payoutCountry` | Soft context (default JO) |
| `nameMatchHint` | Heuristic only: `match_likely` / `review_required` / `clear_mismatch` |
| `reviewStatus` | `pending` / `reviewed` / `rejected` / `action_required` / `reassessment_required` |
| `reviewReasonCategory` | Controlled Owner-visible category |

Append-only: `OwnerPayoutBeneficiaryReviewEvent` (masked last4 only — never full IBAN).

## OperatorParty relationship

Primary matching reference = **Contracting OperatorParty.legalName**, not User display name / email / declared Property owner.

Account holder may differ from contracting operator; that alone does not define beneficiary.

## Beneficiary relationships

- **operator_self / operator_legal_entity** — normal paths; Admin review still required for READY.
- **authorised_third_party / other_review_required** — may be captured and Admin-reviewed, but **cannot become payout READY** while counsel flag is true.

## Review lifecycle

Owner save → `pending` (reopens after any material change).  
Admin → `reviewed` / `rejected` / `action_required` / `reassessment_required`.  
OperatorParty material change → `reassessment_required`.

Admin remains authoritative. Name match hint is NOT legal identity proof.

## Payout release gate

Central evaluator: `evaluateOwnerPayoutReadiness(ownerProfileId)`.

Results: `READY` | `NOT_CONFIGURED` | `UNDER_REVIEW` | `ACTION_REQUIRED` | `REJECTED` | `REASSESSMENT_REQUIRED`.

`assertOwnerHasReviewedPayoutDestination` requires **READY** on:

- `markAdminPayoutPaid`
- `markOwnerSettlementPaid`

## Settlement vs payout

| Layer | Behaviour when payout not READY |
| --- | --- |
| Earnings / settlement accounting | Continues — funds stay pending/held in existing state |
| Actual payout release / mark-paid | Blocked |

Do **not** confiscate Owner Earnings, cancel Bookings, or create penalties.

## Bank-change behaviour

Material IBAN / beneficiary / relationship change → status back to `pending` before any future release.  
Already irreversibly submitted provider instructions (if any) remain reconciliation truth — Mazare3 does not invent a disbursement void.

Structural IBAN validity (checksum) means only that format/checksum is valid — **it does not mean Mazare3 verified ownership** of the account.

## Provider edge cases

Design is provider-agnostic (manual mark-paid today). No PayTabs/Stripe Connect beneficiary semantics hard-coded.

## Privacy / security

- IBAN remains AES-GCM encrypted (`PARTNER_DATA_ENCRYPTION_KEY`)
- Owner/public APIs: masked last4 only
- Admin review bundle may decrypt for authorised comparison — do not log full IBAN
- Prior Consent: `owner_payout_and_financial_processing` before save
- Privacy Policy / Owner Agreement **unchanged**

## Legacy behaviour

Existing profiles keep prior `reviewStatus`. Relationship fields are nullable.  
Legacy `reviewed` without third-party relationship remains READY.  
No fabricated OperatorParty match history. Preflight reports gaps.

## Not in scope

- Publication / new Booking gates (still must **not** require payout)
- Resolving `[[OWNER_SETTLEMENT_CYCLE]]`
- Changing 18%/15% commission
- Production activation
