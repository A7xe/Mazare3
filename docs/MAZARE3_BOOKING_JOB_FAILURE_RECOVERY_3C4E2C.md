# Mazare3 — Booking Job Failure / Recovery (Phase 3C.4E.2C)

**Do not configure live Production scheduler in this phase.**

## Scheduler stopped

**Symptom:** `GET /api/v1/ops/jobs/health` shows `stale: true` for launch-critical jobs; preflight shows growing `expiredPendingOwnerApprovalsNotTransitioned` / `overdueUnpaidBalances`.

**Safe restart:**
1. Run read-only `pnpm preflight:booking-payment-jobs`.
2. Invoke `POST /api/v1/ops/jobs/run-critical` (or CLI) — bounded batches resume from oldest due rows.
3. Repeat until backlogs converge. Deadlines are **not** rewritten to restart time.
4. Accept/balance rules remain enforced on request paths even while cron was down.

## PayTabs unavailable

- Balance auto-cancel **defers** (`booking.balance_cancel_deferred`) when provider outage / open providerRef payments remain.
- Payment reconcile marks deferred/failed; does **not** invent unpaid cancellation.
- Confirmed Bookings stay financially safe until provider truth is known.
- Alert on rising `deferred` counts; retry when PayTabs recovers.

## Webhook outage

- `reconcile-pending-payments` recovers missed IPN within 72h lookback (batch 40).
- Capture validation from Phase 3C.4E.2B still applies on finalize.
- Do not treat browser return as payment truth.

## Large overdue backlog

- Jobs use `take: 40–100` batches + ascending deadline order.
- Multiple invocations converge; advisory lock prevents duplicate overlapping workers.
- Prefer run-critical every 5 minutes until counts near zero; avoid unbounded one-shot scripts.

## Partial job run / timeout

- Per-Booking / per-Payment work is independently recoverable.
- Next run resumes remaining candidates; conditional updates prevent double cancel / double slot release / double finance.

## Uncertain payment

- Do **not** cancel as unpaid.
- State: deferred cancel + keep Booking confirmed until reconcile succeeds or provider proves unpaid.
- Admin may use existing PayTabs reconcile tools when action_required.

### In-flight balance after deadline

If Customer started checkout **before** `balanceDueAt` and capture completes **after**:
- Reconcile-first + successful provider capture **preserves** the Booking (not BALANCE_NOT_PAID).
- NEW balance intents after deadline are rejected (`BALANCE_PAYMENT_DEADLINE_PASSED`).
- Existing in-flight sessions may be reused until local expiry.
- This resolves the edge case without a Customer penalty. No separate product decision ticket required for launch; document as accepted ops behavior.

## Refund reconciliation backlog

| Status | Action |
|--------|--------|
| `pending` (provider_pending / low attempts) | Safe automated job retry |
| `succeeded` | Never re-refund |
| `failed` | **Manual** / action_required — job skips blind retry |

## When admin/manual review is required

- Failed refund allocations
- Reconcile `mismatch` / `manual_intervention`
- Prolonged provider outage with deferred balance cancels
- Preflight shows large unresolved provider payment counts after recovery window

## Safe restart checklist

1. Preflight read-only
2. Confirm `INTERNAL_JOB_SECRET` PRESENT (config preflight)
3. Run critical jobs
4. Re-check health + preflight counts
5. Only then enable/resume external cron (future Production step)
