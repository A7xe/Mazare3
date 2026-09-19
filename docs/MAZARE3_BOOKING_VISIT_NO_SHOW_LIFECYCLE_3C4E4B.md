# Mazare3 — Booking Visit / No-Show Lifecycle (Phase 3C.4E.4B)

**Scope:** Check-in, Customer no-show, Owner no-show, access denied, 60-minute grace, review, terminal visit outcome, financial integration. LOCAL/DEV only.

**Does NOT:** redesign pricing, payments, refunds architecture, cancellation tiers, Owner approval, legal acceptance, regulatory gates, or settlement cycle.

## Previous gap

Customer no-show confirmation stamped `cancellationReasonCode = CUSTOMER_NO_SHOW` but left `Booking.status = confirmed`. My Bookings still looked like an upcoming/confirmed visit. Absence of check-in alone risked being treated as a soft final state without a clear visit outcome projection.

## Final visit outcome model

Additive `Booking.visitOutcome` (`BookingVisitOutcome` enum), orthogonal to `Booking.status`:

| Outcome | Typical Booking.status | Economics |
|---------|------------------------|-----------|
| `customer_no_show` | **confirmed** | Refund 0; normal Owner earnings; snapshotted commission |
| `owner_no_show` / `access_denied` | cancelled | Full eligible refund; Owner 0; commission 0; separate penalty adjustment |
| `force_majeure` | cancelled | Full eligible refund default; Owner adjustment 0 |
| `checked_in` | confirmed | Visit verified |
| `disputed` | confirmed | Open report — under review (not final fault) |
| null | legacy | Do not fabricate |

## Check-in

Existing PIN model retained:

- Opens **2h before** authoritative Booking start
- Expires **120 min after** start
- Customer fetches code; Owner verifies PIN
- On verify → `checkInStatus=verified` + `visitOutcome=checked_in`
- No GPS / biometrics

## 60-minute grace

`Booking Start + 60 minutes` (SSOT `CUSTOMER_NO_SHOW_GRACE_MINUTES`).

- `start + 59:59` → not eligible
- exactly `start + 60m` → review-eligible (`>=`)

Server enforces deadline; scheduler latency does not change truth.

## Review rules (Customer no-show)

Admin finalization requires:

- Booking `confirmed` (paid visit state)
- Grace elapsed
- Check-in not verified
- No open Owner-fault / Force Majeure / check-in dispute incident
- No open Dispute
- Not `BALANCE_NOT_PAID`
- Visit not already terminal

**Owner report ≠ finalization.** Owner cannot self-award funds.

## Automation

Job `mark-visit-review-eligible` is **advisory only** (audit markers). It does **not** finalize Customer no-show financially.

## Force Majeure

Open/confirmed FM blocks Customer no-show. FM full-refund path sets `visitOutcome=force_majeure`. Reschedule still requires explicit Customer election.

## Settlement / refund

- Customer no-show → `syncPayoutStatusForPayment` (normal path after visit)
- Owner fault → existing `ensureSystemOwnerFaultRefund` + penalty adjustment (idempotent helpers)
- Open incidents continue to block payout via existing operations-blocking

## UX projection

API exposes `visitLifecycle` (`displayKey`, `terminal`, `graceDeadlineAt`). My Bookings shows visit outcome badges (e.g. «لم يتم الحضور» / «تم إلغاء الزيارة بسبب مشكلة من جهة المالك»). Pending review uses neutral wording.

## Legacy

Null `visitOutcome` preserved. Stale confirmed Bookings are listed in preflight for manual review — never mass-classified.

## Preflight / QA

- `pnpm preflight:booking-visit-lifecycle`
- `pnpm qa:phase3c4e4b-booking-visit-lifecycle`
