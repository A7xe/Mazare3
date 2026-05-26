# Mazare3 — Payment policy (Phase 6B.1)

This document describes the **full-payment** model implemented in Phase 6B.1. There is **no deposit (عربون)** flow.

## Full payment

- The customer pays the **entire booking amount** at checkout (plus any customer service fee; currently `CUSTOMER_SERVICE_FEE_PERCENT=0`).
- Amounts are computed **only on the server** from the booked slot/price. The client cannot set payment amounts.
- Currency: **JOD**, rounded to 2 decimal places.
- After successful payment, the booking status becomes **`confirmed`** and payment status **`succeeded`**.

## Platform commission

- `PLATFORM_COMMISSION_PERCENT` (default **12%**) is applied to the **booking total** (not including service fee).
- `platformCommissionAmount = round(bookingTotal × percent / 100, 2)`
- `ownerNetPayoutAmount = bookingTotal − platformCommissionAmount`

## Owner payout timing

- The owner is entitled to their **net payout** after:
  1. The booking period has ended (end of booking day UTC), and
  2. `OWNER_PAYOUT_DELAY_HOURS` (default **24**) have passed.
- `payoutAvailableAt` is stored on the payment record.
- `payoutStatus` progresses: `not_ready` → `pending` → `eligible` (no real bank transfer in this phase).
- Payout is **blocked** if the booking is cancelled with a refund request recorded.

**No real payouts or bank transfers are executed in Phase 6B.1.**

## Cancellation policy

| Time before booking start (UTC) | Refund % | Tier |
|---------------------------------|----------|------|
| ≥ 72 hours | ~100% | free |
| 24–72 hours | 50% | partial |
| < 24 hours | 0% | late |
| Started / past | — | not allowed |

- **`pending_payment`**: customer may cancel; slot returns to **available**; no payment capture.
- **`confirmed` (paid)**: cancellation follows the table above. Refund amounts are stored internally (`refundStatus: pending`); **no refund via payment provider** yet.

## What is NOT implemented (Phase 6B.1)

- Live **CliQ** or **card gateway** connections
- Real money movement or owner bank transfers
- Real refunds through a payment provider
- Card data storage (platform does not store PAN/CVV)

## Configuration (`.env`)

See root `.env.example` for:

`PAYMENT_MODE`, `PAYMENT_CURRENCY`, `PLATFORM_COMMISSION_PERCENT`, `CUSTOMER_SERVICE_FEE_PERCENT`, `OWNER_PAYOUT_DELAY_HOURS`, cancellation hour/percent variables.

Secrets must **not** use the `NEXT_PUBLIC_` prefix.

## Trial / QA payment

When `PAYMENT_SIMULATE_ENABLED=true` (QA/E2E only), checkout offers **card (trial)** and **CliQ (trial)** with simulate success/failure endpoints. This is not a live payment connection.
