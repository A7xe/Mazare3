# Mazare3 — Customer Payment Flow Map
## Phase 3C.4E.1

AUDIT ONLY. Provider implementation traced: **PayTabs** (+ test/dev simulate gates).

---

## 1. Deposit path (>72 hours until start)

```
Quote (resolveBookingPricing)
  → createBooking (stores depositAmount / remainingAmount / balanceDueAt / commission snapshot)
  → [optional] Owner accept
  → getCheckoutBooking (syncLivePaymentPlanForBooking)
  → Customer chooses deposit | full
  → createPaymentIntent(purpose derived from choice; amount server-side)
  → PayTabs session (HPP / managed form / saved card)
  → Customer browser return (ack only)
  → Webhook OR reconcile → finalizePaymentSuccess
  → Booking confirmed; paymentState deposit_paid (or fully_paid if full)
```

**Idempotency boundary:** `mazare3_pay_{paymentId}_{purpose}`; purpose already `succeeded` → blocked.

---

## 2. Full-payment path

### A. Customer selects full while >72h
Same as deposit path with purpose/installment = full payable.

### B. Start ≤72h
`resolvePaymentPlan` forces `depositPercent=100`, `remainingAmount=0` (economic full via deposit_balance mode).  
Customer cannot lawfully choose 30% **when plan is live-synced**.

**Gap:** `createPaymentIntent` does not itself re-run live plan sync — see audit HIGH.

---

## 3. Balance-payment path

```
confirmed + deposit_paid + remaining > 0
  → Customer CTA
  → createPaymentIntent(purpose=balance)
  → [skips evaluatePropertyBookability — 3C.4D.4B]
  → PayTabs → webhook/reconcile
  → fully_paid
```

Guards: deposit must be paid; cannot exceed remaining; cannot double-succeed balance.

---

## 4. Payment-provider flow

| Step | Authoritative? |
|------|----------------|
| Create payment row + gateway cart | Server |
| Redirect / SDK / managed form | Customer UX |
| Return URL / browser ack | **Not** capture |
| Webhook HMAC (raw body) | Required for IPN trust |
| Reconcile query (admin/job) | Verifies amount+currency+tran_ref+profile |
| `finalizePaymentSuccess` | Booking/payment state machine |

---

## 5. Return URL

- Web: checkout return page + `apps/web/src/app/api/payment-return/[paymentId]/...`
- API: `acknowledgeBrowserPaymentReturn` — informational
- Forging query params **cannot** mark payment succeeded

---

## 6. Webhook

```
POST /payments/webhooks/:provider
  → verify signature (HMAC-SHA256 raw body)
  → profile_id check
  → normalize event
  → dedupe providerEventId
  → finalize success/failure
```

**Gap:** success path does not compare amount/currency to local Payment (reconcile does).

---

## 7. Reconciliation

Used by: admin tools, scheduled jobs, auto-cancel pre-check.

`reconcileOpenBalancePaymentsBeforeAutoCancel` runs before `BALANCE_NOT_PAID` cancel.

---

## 8. Refund flow

```
Cancel / FM / Owner fault / reschedule negative delta
  → evaluate settlement
  → ensureSystem*Refund / createRefundRequest (durable)
  → admin or system PSP refund (idempotency key per RefundRequest)
  → webhook/retry may re-enter
```

**CRITICAL gap:** obligation amount may exceed a single capture; refunds currently target latest succeeded Payment.

---

## 9. Failure / retry

| Event | Result |
|-------|--------|
| Decline / Customer cancel at PSP | Payment failed/cancelled; Booking remains payable if status allows |
| Timeout / unknown | Stay pending until webhook/reconcile |
| Abandoned session | Hold expiry job may expire unpaid Booking |
| Double click / two tabs | Idempotency + purpose guard |

---

## 10. Session vs thresholds

| Crossing | Current behavior |
|----------|------------------|
| Approval 60m vs pay | Pay blocked until accept; accept requires unexpired |
| Hold expiry vs late capture | May revive if slot free |
| 72h crossing after quote/create | Checkout GET syncs; **intent API may not** |
| Balance deadline vs in-flight pay | Reconcile before auto-cancel |

---

## 11. Idempotency boundaries (summary)

1. Payment create / gateway idempotency key per payment+purpose  
2. Webhook event id dedupe  
3. `finalizePaymentSuccess` conditional updates  
4. RefundRequest blocking statuses + provider refund idempotency key  
5. Coupon redeem on first successful deposit/full capture  

---

## 12. Key files

- `apps/api/src/services/payment.service.ts`
- `apps/api/src/services/payment-webhook.service.ts`
- `apps/api/src/services/payment/paytabs-payment-gateway.ts`
- `apps/api/src/services/paytabs-reconciliation.service.ts`
- `apps/api/src/services/booking-hold.service.ts`
- `apps/api/src/services/refund-request.service.ts`
- `packages/shared/src/marketplace-financial-policy.ts`
- `packages/shared/src/booking-financials.ts`
