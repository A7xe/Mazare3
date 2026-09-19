# Mazare3 — Customer Legal Acceptance & Pre-Payment Disclosure (Phase 3C.4E.4A)

**Scope:** Customer legal-acceptance evidence architecture, BookingLegalSnapshot hardening, and clear pre-booking / pre-payment cancellation & payment disclosure. LOCAL/DEV only.

**Does NOT:** activate DRAFT legal documents, rewrite legal documents, change financial economics, change cancellation percentages, change payment rules, change no-show lifecycle, or touch Production.

## Root weakness (pre-phase)

Customer Booking legal-version evidence was best-effort:

- `acceptedDocumentVersionIds` optional on create
- client could omit or invent version IDs
- BookingLegalSnapshot / LegalAcceptance could be incomplete or post-hoc soft
- DRAFT advisor-final soft-fallback risk when ACTIVE corpus missing
- pre-payment cancellation/payment disclosure only partial

## Active document resolution

Server-authoritative:

`resolveApplicableCustomerBookingLegalSet(locale)`

Resolves **ACTIVE** versions only for:

- Terms & Conditions
- Booking Terms
- Cancellation & Refund Policy
- Privacy (reference / acknowledgement architecture — not Prior Consent)

Never selects DRAFT. Never falls back to advisor-final DRAFT.

If a required document has no ACTIVE version → blockers:

- `CUSTOMER_BOOKING_TERMS_ACTIVE_VERSION_REQUIRED`
- `CUSTOMER_CANCELLATION_POLICY_ACTIVE_VERSION_REQUIRED`
- `CUSTOMER_BOOKING_TERMS_DOC_ACTIVE_VERSION_REQUIRED`

Public API: `GET /legal/customer-booking-set?lang=ar|en`

## Architecture vs activation

| Mode | Behavior |
|------|----------|
| Production / `CUSTOMER_BOOKING_LEGAL_STRICT=true` | Incomplete ACTIVE corpus → `CUSTOMER_BOOKING_LEGAL_TERMS_UNAVAILABLE` |
| Local/dev without ACTIVE corpus | Booking may proceed for QA; snapshot may be incomplete; **no DRAFT fabricate**; acceptances skipped |

No fake Production activation.

## Commitment point

**New Customer Booking create** (`createBooking`) is the contractual commitment point for request/hold creation (including `pending_owner_approval` before payment).

Legal assert runs **before** the Booking TX. **BookingLegalSnapshot and required Booking-context LegalAcceptance records are written inside the same database transaction as Booking creation** (Phase 3C.4E.4A.1).

Acceptance is **not** recorded from payment return, webhook, query params, redirects, or background jobs.

## Atomic Booking Commitment Evidence

### Previous after-commit gap (3C.4E.4A)

Originally, snapshot was in-TX while LegalAcceptance was persisted **after** commit (relatedBookingId FK caution). That allowed:

- Booking committed
- BookingLegalSnapshot present
- LegalAcceptance missing (if post-commit write failed)

### Final transaction sequence (3C.4E.4A.1)

1. `assertCustomerBookingLegalForCommitment` — resolve ACTIVE set; reject mismatch/stale client IDs
2. Begin Booking TX
3. Create Booking (+ inventory/listing snapshot as before)
4. `finalizeCustomerBookingLegalEvidence(..., { tx, phase: 'all' })`
   - `BookingLegalSnapshot` (ACTIVE FKs when corpus ready)
   - `LegalAcceptance` × contractual docs via `recordAcceptance({ tx, relatedBookingId })`
5. Commit TX (or roll back entirely on any failure)

`recordAcceptance` is transaction-aware (`opts.tx`). Audit logs remain best-effort on the primary client.

### Rollback behavior

If LegalAcceptance insert or BookingLegalSnapshot create fails before commit:

- entire TX rolls back
- no Booking, no inventory hold from that TX, no orphan snapshot, no orphan Booking-context acceptance

Safe Customer error (existing legal unavailable / generic booking failure paths).

### Idempotency

- Snapshot create remains idempotent per `bookingId`
- Booking-context acceptance: if `userId + documentVersionId + relatedBookingId` already exists, reuse (no harmful duplicate)
- Customer retry after full rollback creates a new Booking attempt with fresh evidence

### Legacy distinction

Do **not** backfill the historical bookings-without-snapshot / incomplete-snapshot population. Atomicity applies to **NEW** Booking creation only. Preflight separates:

- `legacyBookingsWithoutSnapshot` / incomplete snapshots (historical limitation)
- `completeSnapshotMissingAcceptanceEvidence` / `historicalAfterCommitGapMissingAcceptance` — complete snapshots that lack Booking-linked LegalAcceptance (includes **pre-3C.4E.4A.1 after-commit gap leftovers**; **not backfilled**; NEW creates cannot add to this class)

## Acceptance evidence

`LegalAcceptance` (immutable create):

- userId
- document type + exact version id / version string / hash
- acceptedAt (server `new Date()` at write time)
- context (`checkout`) + sourceSurface (`booking.create.*`)
- relatedBookingId
- metadata: `acceptancePresentationKey` = `customer_booking_ack_v1_terms_cancellation_booking_terms`

Not a bare `accepted=true`.

## BookingLegalSnapshot

For every NEW Booking (when corpus ready): immutable FKs for Terms, Booking Terms, Cancellation (+ Privacy when available). Financial SSOT hash/rules stored alongside. Later document updates do **not** rewrite historical snapshots (create is idempotent).

## Acceptance vs snapshot

| Concept | Role |
|---------|------|
| LegalAcceptance | Customer accepted/acknowledged a version |
| BookingLegalSnapshot | Which versions govern that Booking |

Both are kept. Listing (`BookingPropertySnapshot`) and financial snapshot fields remain separate.

## Reacceptance

Existing `legal-reacceptance` architecture still gates material updates for new Booking/checkout actions. Historical Bookings remain governed by their snapshot. Amount-only live revalidation (3C.4E.2B) does **not** by itself require legal reacceptance.

## Direct API enforcement

Server resolves expected ACTIVE IDs. Client-submitted IDs must match exactly when corpus is ready. Mismatch / missing → safe generic error. Client cannot:

- omit required acceptance when corpus ready
- submit arbitrary / DRAFT / superseded-as-active versions
- claim another user's acceptance
- force older superseded versions for NEW commitments

## Pre-booking disclosure

Booking panel shows concise summary: amounts (when quoted), deposit/owner-approval notes, cancellation tiers from SSOT, legal links, one contractual ack checkbox.

## Pre-payment disclosure

Checkout shows server-authoritative due-now, remaining balance + balance due datetime for deposit, full-payment disclosure when applicable, live plan revalidation notice (3C.4E.2B), cancellation tiers, capture-limit plain note.

## Deposit / full disclosure

Deposit: pay 30% now; remaining due by 48h-before-start; unpaid → cancel under policy.

Full / ≤72h: full amount due now (including after live plan change before redirect).

## Cancellation summary

UI tiers derive from shared SSOT constants: 0 / 30 / 50 / 100 with 72 / 48 / 24 hour windows. Policy document body not rewritten.

## Owner-approval disclosure

When approval required: owner has 60 minutes; payment not collected before accept; expired/rejected ≠ confirmed.

## Booking status wording

`pending_owner_approval` → awaiting owner approval (not confirmed).  
`pending_payment` → awaiting payment.  
`confirmed` → confirmed.

## Privacy separation

LegalAcceptance ≠ DataProcessingConsent (Prior Consent) ≠ optional marketing. Privacy Policy not modified. No blanket privacy consent.

## Legacy

Incomplete historical snapshots are **not** backfilled. No fabricated acceptance for legacy Bookings.

## Activation readiness

Blockers listed under `acceptanceFlows.customerBookingCorpusBlockers` in legal activation readiness. Documents remain DRAFT until counsel-approved activation (out of scope).

## Counsel flag

If product disclosure gaps remain after architecture hardening: `CUSTOMER_LEGAL_COUNSEL_REDLINE_REQUIRED` (no new legal version created in this phase).

## Preflight / QA

- `pnpm preflight:customer-legal-acceptance`
- `pnpm qa:phase3c4e4a-customer-legal-acceptance`

See `docs/MAZARE3_CUSTOMER_LEGAL_ACCEPTANCE_PREFLIGHT_3C4E4A.md`.
