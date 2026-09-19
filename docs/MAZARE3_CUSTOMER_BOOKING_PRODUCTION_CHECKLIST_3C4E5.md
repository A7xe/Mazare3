# Mazare3 — Customer Booking Production Checklist (Phase 3C.4E.5)

Executable later. Do **not** execute in the audit phase.

## A. Legal activation (counsel)

- [ ] Confirm advisor-final bodies: Terms / Cancellation / Booking Terms / Privacy `1.1.2-advisor-final`
- [ ] Counsel sign-off recorded
- [ ] Activate ACTIVE versions in Production (AR + EN) — **not** placeholder
- [ ] Verify `GET /legal/customer-booking-set` corpusReady with advisor-final version IDs
- [ ] Confirm DRAFT advisor-final no longer selectable as ACTIVE

## B. Database migrations (ordered)

Before slot unique index:

- [ ] Run `pnpm preflight:booking-slot-integrity` on Production target → **0** `duplicateActiveCanonicalSlots`
- [ ] If duplicates > 0: MANUAL_REVIEW resolve holding conflicts

Then apply (order relative to already-deployed base):

- [ ] Regulatory / authority / pool / listing snapshot / payout migrations as required by environment gap
- [ ] `phase3c4e2a_multi_capture_refund`
- [ ] `phase3c4e3_booking_slot_integrity` (partial unique)
- [ ] `phase3c4e4b_booking_visit_outcome`

- [ ] Re-run slot + refund + visit + legal preflights (read-only)

## C. Scheduler

- [ ] Set `INTERNAL_JOB_SECRET` (secret manager; never commit)
- [ ] Wire external scheduler to ops job routes or CLI `jobs:run`
- [ ] Schedule **LAUNCH_CRITICAL**:
  - expire-owner-approval-requests (~5m)
  - expire-unpaid-booking-holds (~5m)
  - auto-cancel-unpaid-balances (~5m)
  - reconcile-pending-payments (~5–10m)
- [ ] Schedule **REQUIRED_OPERATIONAL**:
  - reconcile-pending-refunds (~15–30m)
  - expire-reschedule-requests (~10–15m)
  - reconcile-regulatory-document-expiry
  - maintain-availability-horizon (daily)
  - **complete-verified-visits** (~10–15m)
- [ ] Confirm job health / last-success audit visible
- [ ] Alerting on consecutive job failures

## D. Payment provider

- [ ] PayTabs Production profile (`PAYTABS_PROFILE_MODE=live` under `APP_ENV=production`)
- [ ] Profile ID / server key / callback URL / return URL (HTTPS)
- [ ] Webhook HMAC validation verified in staging
- [ ] Counsel/Founder confirm provider commercial identity disclosure

## E. Go-live gates

- [ ] `pnpm preflight:customer-booking-launch` overall acceptable for Production mirror
- [ ] No CRITICAL product-code findings open
- [ ] Customer Booking legal activation READY
- [ ] Scheduler LAUNCH_CRITICAL healthy for ≥24h in staging
- [ ] Founder: `[[OWNER_SETTLEMENT_CYCLE]]` decided **before Owner payout commercial launch** (can trail Customer Booking go-live)

## F. Explicit non-goals at Customer Booking go-live

- Do not require settlement-cycle decision to ship Customer Booking if Owner payouts remain held.
- Do not mass-complete legacy visits without check-in.
- Do not backfill historical legal acceptance gaps.
