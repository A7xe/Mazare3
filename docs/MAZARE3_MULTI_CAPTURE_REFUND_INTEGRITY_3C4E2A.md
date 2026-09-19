# Mazare3 — Multi-Capture Refund Integrity (Phase 3C.4E.2A)

**Status:** Implemented (local/dev). Production untouched. Locked legal docs unchanged.

## Previous critical failure mode (`MULTI_CAPTURE_REFUND_CRITICAL`)

Refund obligations were durable at Booking level via `RefundRequest`, but **execution selected a single Payment** (typically the newest succeeded capture) and called the PSP refund for the **full Booking obligation** against that one capture.

Example failure:

| Capture | Amount |
|---------|--------|
| Payment A (deposit) | 60 JOD |
| Payment B (balance) | 140 JOD |
| Required refund | 200 JOD |

Pre-fix behaviour attempted **200 JOD against Payment A** (or whichever single row was selected), causing:

- partial / wrong-capture refunds
- amounts exceeding one capture
- stranded refundable balance
- incorrect aggregate refund status
- retry/double-refund risk on the wrong path

## Final model

| Layer | Role |
|-------|------|
| `RefundRequest` | Booking-level refund **obligation** (unchanged architecture) |
| `RefundPaymentAllocation` | Per-capture **execution** rows (additive) |
| `RefundRequest.refundedAmount` | Aggregate succeeded refund total |

Rule: a refund belongs to the **Booking financial obligation**, not blindly to one arbitrary Payment.

## Allocation algorithm

1. `getRefundableCapturedPayments(bookingId)` — authoritative inventory of succeeded captures with remaining refundable fils (subtracts succeeded allocations + legacy processed requests without allocations).
2. `allocateRefundAcrossCaptures` — deterministic plan.
3. **Ordering: `NEWEST_CAPTURE_FIRST`** — matches the prior single-payment selection convention and prefers refunding the latest capture first (typically balance before deposit).
4. Never allocate more than a capture’s remaining refundable amount.
5. Cap obligation to allocatable captured funds (never invent money never captured).

## Aggregate state

Customer/admin aggregate labels:

- `pending`
- `partially_refunded`
- `refunded`
- `action_required`

Full completion requires:

`sum(successful allocation refunds) >= required refund amount` (fils precision).

A single allocation success must **not** mark the whole `RefundRequest` processed.

## Partial-failure behaviour

If Payment A refund succeeds and Payment B fails:

- A remains recorded as succeeded (never re-refunded)
- `RefundRequest` stays pending / actionable (`PARTIAL_REFUND_ACTION_REQUIRED`)
- Only unresolved allocations are retried
- No rollback of provider truth

## Idempotency

- Unique `RefundPaymentAllocation.idempotencyKey` = `mazare3_refund_{refundRequestId}_{paymentId}`
- Row-level `FOR UPDATE` before attempt
- Succeeded allocations skipped on every retry path (customer cancel, admin, worker, double-click)
- Provider called with the same cart/idempotency key per allocation

## Reconciliation

- Provider “already refunded” / duplicate-refund style errors mark the allocation succeeded via `refund.allocation_reconciled` (no second refund)
- Pending provider results leave allocation pending with reconcile-before-blind-retry guidance
- Webhooks (`refund_succeeded` / `refund_failed`) map to the matching open allocation for that Payment via `applyProviderRefundEventToAllocations`; aggregate completion only when obligation satisfied

## Customer / Admin behaviour

- Customer sees aggregate: refunded / remaining / total — not “completed” after one capture
- Admin sees required, refunded, remaining, per-allocation status, provider refs, retry for remaining allocations

## Legacy handling

- Historical `RefundRequest` rows without allocations are not fabricated into provider refunds
- Inventory subtracts legacy processed amounts keyed by `paymentId`
- Preflight flags multi-capture bookings whose legacy refunds look incomplete for review
- No retroactive rewrite of completed historical Payment truth

## Provider assumptions

- PayTabs (and gateways) refund **per original capture `tran_ref`**
- Refund amount for each call must be ≤ that capture’s remaining refundable
- Same idempotency/`cart_id` must not create duplicate provider refunds for one allocation

## Economics unchanged

- Cancellation tiers 0/30/50/100 unchanged
- Commission policy unchanged
- Booking financial snapshot remains authoritative
- Allocation is **merely execution** across Payment captures — no per-allocation commission rule

## Out of scope (other 3C.4E.1 findings)

Not modified in this phase: 72h intent revalidation, webhook capture amount validation, DB slot uniqueness, legal-version optionality, no-show status, scheduler configuration, quote/session staleness.

## Production

**Production untouched.** Local/dev migration only. No live refunds, no deployment, no activation of locked legal documents.
