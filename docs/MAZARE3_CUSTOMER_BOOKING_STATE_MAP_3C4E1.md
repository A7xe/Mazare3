# Mazare3 — Customer Booking State Map
## Phase 3C.4E.1

AUDIT ONLY. States are those in Prisma / services — no invented statuses.

**Enums**

- `BookingStatus`: `pending` (legacy), `pending_owner_approval`, `pending_payment`, `confirmed`, `cancelled`, `expired`
- `BookingPaymentState`: `unpaid`, `deposit_pending`, `deposit_paid`, `balance_pending`, `fully_paid`, `balance_overdue`, `partially_refunded`, `refunded`
- `OwnerDecisionOutcome`: `accepted`, `rejected`, `timed_out`
- `PaymentCollectionMode`: typically `deposit_balance` on create (100% deposit when ≤72h)

---

## Happy paths

### A. Instant book (no Owner approval)

| Step | Actor | Booking status | Payment state | Notes |
|------|-------|----------------|---------------|-------|
| Create | Customer | `pending_payment` | `unpaid` / → deposit_pending on intent | Slot → `booked`; listing snapshot created |
| Pay deposit or full | Customer + PSP | `pending_payment` → `confirmed` | `deposit_paid` or `fully_paid` | Webhook/reconcile authoritative |
| Balance (if deposit) | Customer | `confirmed` | `balance_pending` → `fully_paid` | Bookability **not** re-gated |
| Complete / visit | — | stays `confirmed` | `fully_paid` | No separate `completed` status in enum |

### B. Owner approval required

| Step | Actor | Booking status | Payment state | Notes |
|------|-------|----------------|---------------|-------|
| Create | Customer | `pending_owner_approval` | `unpaid` | `ownerApprovalExpiresAt` = now+60m; **payment intents blocked** |
| Accept | Owner | → `pending_payment` | unpaid | Re-asserts bookability `owner_accept`; payment hold timer |
| Decline | Owner | → `cancelled` | — | Slot released; outcome `rejected` |
| Timeout | Job/lazy | → `expired` | — | Outcome `timed_out`; slot released |
| Pay | Customer | → `confirmed` | as above | Same payment finalize |

---

## Timeout / job transitions

| Trigger | From | To | Payment | Slot |
|---------|------|----|---------|------|
| Owner approval expiry | `pending_owner_approval` | `expired` | none captured | release if unheld |
| Unpaid payment hold expiry | `pending_payment` | `expired` | open intents cancelled | release |
| Late PSP capture after hold expiry | `expired` | may revive → `pending_payment` → `confirmed` | capture | only if slot free (`recoverHoldExpiredBookingForCapture`) |
| Balance unpaid at `balanceDueAt` | `confirmed` | `cancelled` reason `BALANCE_NOT_PAID` | retain captured; no refund | release |

---

## Cancellation / fault transitions

| Event | Booking | Payment / money | Next |
|-------|---------|-----------------|------|
| Customer cancel (unpaid pending) | → `cancelled` | none | Slot release |
| Customer cancel (confirmed, paid) | → `cancelled` | RefundRequest; retained=min(captured, policy %) | Slot release |
| Owner cancel confirmed | → `cancelled` | Full eligible Customer refund; Owner payout 0 | Adjustment separate |
| Force majeure full refund | → `cancelled` (refund path) | Full refundable captured | Customer election if reschedule |
| Customer no-show (admin) | **stays `confirmed`** | No refund | Reliability / reason code |
| Owner no-show / access denied | → `cancelled` | Full refund; payout 0 | 20% adjustment |

---

## Failure / retry paths

| Situation | Booking | Customer action |
|-----------|---------|-----------------|
| Provider decline / cancel | stays payable status | Retry payment if still `pending_payment` / balance due |
| Unknown PSP result | pending until webhook/reconcile | Refresh return page; do not trust URL |
| Duplicate Pay click | same Payment / idempotency | No second capture for same purpose |
| Quote stale / PRICING_CHANGED | create fails | Re-quote |
| Slot taken | create 409 | Pick another slot |
| Regulatory block at first pay | intent fails | Cannot confirm new paid Booking |

---

## Customer-visible meaning (summary)

| Status | Typical Customer meaning |
|--------|--------------------------|
| `pending_owner_approval` | Waiting for Owner; not charged |
| `pending_payment` | Accepted / instant — pay to confirm |
| `confirmed` | Booking held; pay balance if needed |
| `cancelled` | Ended; see refund/reason |
| `expired` | Request or unpaid hold timed out |

---

## Ambiguity / impossible notes

- **`pending`**: in enum / hold set; create path does not write it (legacy).  
- **No `completed` / `no_show` BookingStatus** — no-show uses reason codes while status may remain `confirmed`.  
- **`balance_overdue`**: payment-state signal; auto-cancel moves Booking to `cancelled`.
