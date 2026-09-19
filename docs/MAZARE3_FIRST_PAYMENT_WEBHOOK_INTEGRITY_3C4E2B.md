# Mazare3 — First-Payment Revalidation & Webhook Capture Integrity (Phase 3C.4E.2B)

**Status:** Implemented (local/dev). Production untouched. Locked legal docs unchanged. Financial policy unchanged.

## Original HIGH gaps (3C.4E.1)

1. **First-payment plan:** `createPaymentIntent` did not revalidate the live >72h vs ≤72h payment-plan rule. Checkout GET synced amounts, but a direct intent (or stale session reuse) could open a **30% deposit** PayTabs session after the Booking had crossed into full-payment-only.
2. **Webhook capture:** PayTabs HMAC was verified, but IPN success did **not** compare provider amount/currency to the local Payment (reconciliation did). A signed wrong-amount IPN could still finalize.

## Authoritative 72h rule (unchanged)

| Hours until Booking Start | First payment |
|---------------------------|---------------|
| `> 72` | Deposit (30%) **or** full |
| `<= 72` (exact boundary included) | **Full only** |

Uses Booking Start Instant + `resolvePaymentPlan` / `FULL_PAYMENT_WITHIN_HOURS`. Frontend `paymentPlan` is never trusted.

**Distinction:** commercial snapshot (price, commission, merchant value) stays authoritative. Only the permitted **payment plan / due-now** may change before first capture when the 72h boundary is crossed.

## Payment-plan revalidation

`syncLivePaymentPlanForBooking` (exported) runs immediately before first-payment intent creation:

- Recalculates deposit%/due-now/remaining/`balanceDueAt` from live hours
- Audits `booking.payment_plan_revalidated` (`DEPOSIT_ELIGIBLE_TO_FULL_REQUIRED_BEFORE_FIRST_CAPTURE`)
- Expires open deposit/full sessions when plan amounts change
- **No-op after any successful capture** (confirmed deposit Bookings keep balance architecture)

Stale deposit API choice after crossing → `409 PAYMENT_PLAN_UPDATED` with clear Customer message (not a penalty).

## Stale session behaviour

Reuse is allowed only when active Payment **amount + currency + purpose** still match the live installment. Otherwise the local row is expired (superseded). Remote PayTabs session is not claimed deleted.

## Old session completes after crossing (edge case)

If a 60 JOD deposit session completes after Mazare3 requires 200 JOD full:

- Provider capture is **recorded** as succeeded Payment
- Remaining shortfall is written onto the Booking (`remainingAmount`, `balanceDueAt=now`)
- Audit `payment.stale_session_shortfall` / `FIRST_PAYMENT_OBLIGATION_SHORTFALL`
- Booking confirmed as deposit_paid with remaining due — **not** fully paid
- No auto-refund in this phase

## Balance-payment exception

72h first-payment revalidation does **not** apply to balance payments on Bookings that already captured a valid deposit while >72h.

## Webhook validation (after HMAC)

Shared helper: `validateProviderCaptureAgainstPayment` (`packages/shared/src/payment-capture-validation.ts`).

On `payment_succeeded`:

- Amount (fils) must match Payment.amount → else `PAYMENT_AMOUNT_MISMATCH`
- Currency must match → else `PAYMENT_CURRENCY_MISMATCH`
- Provider ref must match when local ref exists → `PAYMENT_REFERENCE_MISMATCH`
- Cart purpose vs Payment.purpose → `PAYMENT_PURPOSE_MISMATCH`

Mismatch: event/audit recorded; Payment **not** finalized as satisfied.

## Webhook / reconciliation consistency

`paytabs-reconciliation.service` `validateQuery` uses the **same** shared helper for amount/currency/reference.

## Duplicate / out-of-order

- Already-succeeded + success → idempotent ignore
- Already-succeeded + failure → stale failure ignored (no downgrade)

## Return URL

Unchanged: UX acknowledgement only; never marks paid.

## Customer UX

EN: “This Booking is now within 72 hours of the start time, so full payment is required.”  
AR: “أصبح الحجز ضمن 72 ساعة من موعد البداية، لذلك يلزم الآن دفع المبلغ كاملاً.”

Shown before redirect / on `PAYMENT_PLAN_UPDATED`; due-now refreshed from server.

## Reschedule reference finding

`parsePaytabsCartId` now accepts `reschedule_difference` (previously only deposit|balance|full). Unique `paymentId` in cart_id prevents cross-Booking collision. **No larger reschedule redesign.** If further cart mapping issues appear: `RESCHEDULE_PAYMENT_REFERENCE_FOLLOWUP_REQUIRED`.

## Schema

No migration — existing Payment / PaymentEvent / AuditLog suffice.

## Out of scope

Scheduler, DB slot uniqueness, legal acceptance, no-show, multi-capture refunds (unchanged from 3C.4E.2A).

## Production

**Production untouched.** No deploy, no live charges, no activation.
