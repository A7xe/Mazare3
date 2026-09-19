# Mazare3 — First-Payment Integrity Preflight (Phase 3C.4E.2B)

**Command:** `pnpm preflight:first-payment-integrity`

**Mode:** Read-only. `mutation: false`. No provider secrets. No Personal Data dump (IDs only in samples).

## Counts

| Key | Meaning |
|-----|---------|
| `unpaidBookingsDepositPlanAndOver72h` | Unpaid Bookings still >72h with deposit plan |
| `unpaidBookingsStillDepositPlanButNowWithin72h` | Unpaid Bookings now ≤72h but depositPercent still <100 (stale plan) |
| `activeSessionsAmountDiffersFromCurrentObligation` | Open deposit/full sessions whose amount ≠ live due |
| `captureMismatchEvents` | Audits categorized `PAYMENT_AMOUNT_MISMATCH` |
| `currencyMismatchEvents` | Audits categorized `PAYMENT_CURRENCY_MISMATCH` |
| `duplicateProviderTransactionRefs` | Same `providerRef` on multiple Bookings |
| `cartIdReuseAcrossBookings` | Idempotency/cart-like keys spanning Bookings |
| `unresolvedCaptureMismatchAudits` | Recent capture/reconcile mismatch audits |

## Operator guidance

1. Run on **local/dev** only.
2. Treat `unpaidBookingsStillDepositPlanButNowWithin72h` as a review queue — next Customer payment path should revalidate via `syncLivePaymentPlanForBooking`.
3. Do not fabricate captures or auto-refund from this report.

## Related

- Design: `docs/MAZARE3_FIRST_PAYMENT_WEBHOOK_INTEGRITY_3C4E2B.md`
- Service: `apps/api/src/services/first-payment-integrity-preflight.service.ts`
