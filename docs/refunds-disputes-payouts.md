# Refunds, disputes & owner payouts (Phase 6C)

Internal operations foundation only. **No live CliQ, Visa, or payment-provider refunds/transfers.**

## Refund requests

- Customers with **confirmed + paid** bookings can `POST /api/v1/me/bookings/:id/refund-request`.
- `policyRefundAmount` and `requestedAmount` are computed **on the server** using the same cancellation tiers as Phase 6B.1:
  - ≥72h before start: ~100%
  - 24–72h: 50%
  - &lt;24h: 0%
- Status flow: `pending` → admin `approved` / `rejected` → optional `processed` (manual bookkeeping).
- **No money** is returned via a payment provider in this phase.
- Duplicate active requests (`pending` / `approved`) are rejected with `409`.

## Disputes

- Customers can open a dispute **after the booking day** (slot date ended).
- Types: `property_mismatch`, `owner_cancelled`, `access_problem`, `cleanliness_issue`, `other`.
- Admin updates status: `open` → `under_review` → `resolved` / `rejected`.
- Not a full ticketing/support product yet — foundation only.

## Owner payouts

- Owners become eligible after **booking day end + `OWNER_PAYOUT_DELAY_HOURS`** (default 24h).
- Admin lists eligible rows at `GET /api/v1/admin/payouts`.
- Admin marks paid manually with `POST /api/v1/admin/payouts/:paymentId/mark-paid` + `manualReference` (no bank API).
- Creates/updates `OwnerPayout` record and sets `Payment.payoutStatus` to `paid`.

## Payout blocking

Payout is **blocked** when either:

- An active **refund request** (`pending` or `approved`), or
- An active **dispute** (`open` or `under_review`).

`Payment.payoutStatus` becomes `blocked`; admin cannot mark paid until resolved.

## Roles & security

| Action | customer | owner | admin | guest |
|--------|----------|-------|-------|-------|
| Request refund | own bookings | — | — | 401 |
| Open dispute | own bookings | — | — | 401 |
| List/update refunds/disputes/payouts | — | — | ✓ | 401 |
| View owner payout summary | — | ✓ | — | 401 |

Owners never see payment provider refs, card data, or raw webhook events.

## Audit log actions

- `refund.requested`, `refund.approved`, `refund.rejected`, `refund.processed_manual`
- `dispute.opened`, `dispute.status_updated`
- `payout.marked_paid`, `payout.blocked`, `payout.eligible`

## QA / E2E

- `pnpm qa:api` runs `scripts/qa-operations-api.mjs` on port **4012** (isolated from E2E **4010**).
- Internal QA routes (non-production): backdate slot, backdate payout eligibility.

## Later (real provider)

When CliQ/Visa go live:

- Map `refund.processed` to provider refund API calls.
- Replace manual payout with treasury/settlement integration.
- Keep `RefundRequest` / `Dispute` as source of truth for admin decisions.
