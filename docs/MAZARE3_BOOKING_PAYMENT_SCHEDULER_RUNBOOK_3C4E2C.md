# Mazare3 — Booking/Payment Scheduler Runbook (Phase 3C.4E.2C)

**Status:** Deployment-readiness only. **Do NOT configure live Production scheduler in this phase.**

Hosting context (from `docs/staging-deploy-runbook.md`): API on **Railway or Render**; Web on **Vercel or Railway**. Prefer platform cron / scheduled HTTP hitting authenticated ops routes, or CLI one-shot on a worker.

## Job table

| Job | Purpose | Entrypoint | Recommended cadence | Deadline semantics | Idempotent? | Provider reconcile? | Concurrency | Required env | Expected runtime | Alert condition | Launch required? |
|-----|---------|------------|---------------------|--------------------|-------------|---------------------|-------------|--------------|------------------|-----------------|------------------|
| `expire-owner-approval-requests` | Expire pending Owner approvals past snapshotted `ownerApprovalExpiresAt` | `pnpm jobs:run -- expire-owner-approval-requests` **or** `POST /api/v1/ops/jobs/expire-owner-approval-requests/run` | **~5 min** | Accept uses `ownerApprovalExpiresAt > now` (exact instant = expired). Cron may run late; accept still blocked. | Yes (conditional update + `FOR UPDATE`) | No | PG advisory lock + row lock | `DATABASE_URL` | < 60s typical (batch 50) | No success > 20 min; growing expired-pending backlog | **YES** |
| `expire-unpaid-booking-holds` | Expire stale payment intents + unpaid holds + due reschedules | CLI / `POST .../expire-unpaid-booking-holds/run` | **~5 min** | Local `expiresAt` / `holdExpiresAt` inclusive (`lte`) | Yes | No (local expiry only) | Advisory + row locks | `DATABASE_URL` | < 90s (batches 50) | No success > 20 min | **YES** |
| `auto-cancel-unpaid-balances` | `BALANCE_NOT_PAID` after `balanceDueAt` | CLI / `POST .../auto-cancel-unpaid-balances/run` | **~5 min** | `balanceDueAt <= now` due. NEW balance checkout blocked at deadline. | Yes | **Yes — reconcile-first**; defer if uncertain | Advisory + `FOR UPDATE` | `DATABASE_URL`, PayTabs query creds | < 120s (batch 50) | No success > 20 min; growing overdue backlog; rising `deferred` | **YES** |
| `reconcile-pending-payments` | Recover missed/delayed webhooks (72h lookback, batch 40) | CLI / `POST .../reconcile-pending-payments/run` | **~5–10 min** | N/A (recovery) | Yes | Yes (PayTabs query) | Advisory lock | PayTabs server/profile | < 120s | No success > 30 min; rising deferred/failed | **YES** |
| `reconcile-pending-refunds` | Safe retry of **pending** refund allocations; failed = manual | CLI / `POST .../reconcile-pending-refunds/run` | **~15–30 min** | N/A | Yes (no double-refund on succeeded) | Provider refund / already-refunded reconcile | Advisory + allocation lock | PayTabs | < 180s | Growing pending/failed allocation backlog | REQUIRED_OPERATIONAL |
| `expire-reschedule-requests` | Expire due reschedule holds | CLI / HTTP (also nested in unpaid-holds) | **~10–15 min** | `expiresAt` / `targetSlotHeldUntil` `lte` | Yes | No | Advisory + row lock | `DATABASE_URL` | < 60s | Optional | REQUIRED_OPERATIONAL |
| `generate-due-settlement-cycles` | Owner settlement periods | CLI / HTTP | **Daily** (after UTC midnight or platform TZ) | Settlement cycle config | Yes | No | Advisory | `DATABASE_URL` | Variable | Missed daily run | REQUIRED_OPERATIONAL |
| `maintain-availability-horizon` | Extend published availability | CLI / HTTP | **Daily** | Horizon days config | Yes | No | Advisory | `DATABASE_URL` | Variable | Horizon gaps | REQUIRED_OPERATIONAL |
| `reconcile-regulatory-document-expiry` | Persist expired regulatory status | CLI / HTTP | **Daily** | Readiness also derived on read — **not** the only NEW Booking gate | Yes | No | Advisory | `DATABASE_URL` | Variable | Optional backlog | REQUIRED_OPERATIONAL (not launch-security-critical) |

## Authentication (HTTP)

- Header: `Authorization: Bearer <INTERNAL_JOB_SECRET>` **or** `X-Mazare3-Job-Secret: <secret>`
- Secret **not** in query string; constant-time compare; never logged
- Env: `INTERNAL_JOB_SECRET` (min 16 chars) — see `.env.example`
- Unauthorized → `401`; missing config → `503 JOB_AUTH_NOT_CONFIGURED`

## Expected success response

```json
{ "data": { "name": "auto-cancel-unpaid-balances", "success": true, "summary": { "processed": 3, "cancelled": 1, "deferred": 0 }, "durationMs": 412 } }
```

Partial multi-job: `POST /api/v1/ops/jobs/run-critical` → `200` if all ok, else `207`.

## Health

- `GET /api/v1/ops/jobs/health` — last success/failure from `AuditLog` (`job.run_success` / `job.run_failed`)
- Alert when `stale: true` for launch-critical jobs

## Future Production setup steps (DO NOT RUN IN THIS PHASE)

1. Set `INTERNAL_JOB_SECRET` in API host secret manager (Railway/Render).
2. Confirm PayTabs LIVE credentials + callback URL already validated separately.
3. Create platform cron / scheduled tasks:
   - Every 5 min: `POST https://<api>/api/v1/ops/jobs/run-critical` with Bearer secret (timeout ≥ 120s).
   - Every 15–30 min: `reconcile-pending-refunds`.
   - Daily: settlement, availability horizon, regulatory expiry.
4. Optionally prefer CLI worker: `pnpm jobs:run -- <name>` on a single scheduled container.
5. Wire host logs/alerts on HTTP 5xx, `success:false`, and stale health.
6. Run `pnpm preflight:booking-payment-jobs` (read-only) before enabling crons; review backlogs.
7. Enable one critical job at a time; watch deferred/cancel counts.

## Classification inventory

| Area | Classification |
|------|----------------|
| Owner approval expiry | CRITICAL_FOR_LAUNCH |
| Unpaid hold / session expiry | CRITICAL_FOR_LAUNCH |
| Balance auto-cancel | CRITICAL_FOR_LAUNCH |
| Payment reconciliation | CRITICAL_FOR_LAUNCH |
| Refund reconciliation | REQUIRED_OPERATIONAL |
| Reschedule expiry | REQUIRED_OPERATIONAL |
| Settlement / availability | REQUIRED_OPERATIONAL |
| Regulatory expiry job | REQUIRED_OPERATIONAL (gate is read-time) |
| Booking reminders / marketing | OPTIONAL_NOTIFICATION (not built as launch jobs) |
| Inline lifecycle refresh on read/pay | NOT_SCHEDULER_DEPENDENT (safety net) |

## Startup

`apps/api/src/index.ts` does **not** run destructive job backlogs on boot.
