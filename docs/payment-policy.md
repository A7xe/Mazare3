# Mazare3 — Payment policy (Phase 1)

SSOT: `packages/shared/src/marketplace-financial-policy.ts`

## Commission

- Standard listing: **18%**
- `Property.verificationStatus === platform_verified`: **15%**
- Partner KYC alone does **not** grant 15%
- Commission is snapshotted on booking create (`Booking.platformCommissionPercent`)
- Custom `PartnerCommercialTerms` override when present

## Deposit + balance

- Default deposit: **30%** of booking total (`DEFAULT_DEPOSIT_PERCENT` / `DEPOSIT_PERCENT`)
- Optional per-property override: `Property.depositPercent`
- If booking start is **> 72 hours** away: customer may choose **30% deposit** or **100%**
- If **≤ 72 hours**: **full payment mandatory** (no deposit option)
- Balance due: **48 hours before actual booking start** (`bookingStartAt`, Asia/Amman semantics via stored UTC instant)
- Legacy untimed slots fall back to slot calendar date 00:00 UTC

## Unpaid balance

At balance due with unpaid remainder on a deposit booking → auto-cancel (`cancellationReasonCode=BALANCE_NOT_PAID`), release slot, retain captured deposit only, block payout until financial finalization.

## Customer cancellation (confirmed bookings)

Charge % applies to **merchant booking value**. Retained = `min(captured, policyCharge)`. Refund = `max(0, captured - retained)`.

| Hours before start | Charge on merchant value |
| --- | --- |
| > 72 | 0% |
| 48–72 | 30% |
| 24–48 | 50% |
| 0–24 | 100% |
| ≤ 0 | not cancellable |

Retained split: platform = retained × snapshotted commission %; owner = retained − platform.

## Refunds

Paid customer cancel with refund > 0 creates a durable `RefundRequest` automatically (idempotent). PSP refund attempted when safe; failures stay pending with admin note.

## Configuration (`.env`)

`PLATFORM_COMMISSION_PERCENT=18`, `PLATFORM_VERIFIED_COMMISSION_PERCENT=15`, `DEFAULT_DEPOSIT_PERCENT=30`, `FULL_PAYMENT_WITHIN_HOURS=72`, `BALANCE_DUE_HOURS_BEFORE_START=48`, cancellation hour boundaries.
