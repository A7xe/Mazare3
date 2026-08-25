# Mazare3 — Payment policy (Phase 10A)

New bookings use a **deposit + remaining balance** model. Legacy bookings created before this phase stay on **full payment** (`paymentCollectionMode=full`).

## Deposit (عربون)

- `DEFAULT_DEPOSIT_PERCENT` (test default **30**) is the platform rate. Optional per-property override: `Property.depositPercent`.
- Deposit is a **share of booking total**, not a separate fee.
- Commission is always calculated on the **full booking total**, never on the deposit alone.
- Customer service fee (if `CUSTOMER_SERVICE_FEE_PERCENT` > 0) is collected with the **first installment**.
- Amounts are rounded to 2 decimal places using integer fils (1 JOD = 100 fils).

## Remaining balance

- `remainingAmount = bookingTotal − depositAmount` (snapshot at booking create).
- `BALANCE_DUE_HOURS_BEFORE_START` (default **24**, **0 allowed**) sets `balanceDueAt` relative to the **slot calendar date at 00:00 UTC**, not a real morning/evening/overnight start time.
- AvailabilitySlot currently stores `date` + `period` only. Real `startAt`/`endAt` is deferred to **Phase 10B**.
- After the due time without full payment, `paymentState` becomes `balance_overdue`. No automatic refund, forfeiture, or cancellation in this phase.

## Confirmation and payout

- Successful **deposit** confirms the booking (`status=confirmed`) and holds the slot. **No owner payout.**
- Successful **balance** (or legacy **full**) sets `paymentState=fully_paid`. Owner payout may become eligible after the visit day + `OWNER_PAYOUT_DELAY_HOURS`, unless a refund/dispute is blocking.

## Hold expiry

`holdExpiresAt` lives on the **booking**. If the customer never starts payment (no intent required), the booking expires and the slot returns to available.

## Configuration (`.env`)

`DEFAULT_DEPOSIT_PERCENT`, `BALANCE_DUE_HOURS_BEFORE_START`, `PAYMENT_CURRENCY`, `PLATFORM_COMMISSION_PERCENT`, `CUSTOMER_SERVICE_FEE_PERCENT`, `OWNER_PAYOUT_DELAY_HOURS`, cancellation hour/percent variables.

Secrets must **not** use the `NEXT_PUBLIC_` prefix.

## Trial / QA payment

When `PAYMENT_SIMULATE_ENABLED=true` (QA/E2E only), checkout offers **card (trial)** and **CliQ (trial)** with simulate success/failure. This is not a live payment connection.
