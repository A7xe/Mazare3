# Mazare3 — Successful Visit Completion (Phase 3C.4E.4C)

**Scope:** Normal happy-path `checked_in → completed` after authoritative visit end. LOCAL/DEV only.

**Does NOT:** change financial policy, settlement cycle, no-show economics, legal documents, or Production.

## Previous gap

Verified visits could remain `visitOutcome = checked_in` indefinitely after the visit ended. My Bookings could still treat them as active/upcoming-ish via status `confirmed`, and no completion job existed.

## Authoritative visit end

Prefer, in order:

1. `Booking.bookingEndAt` (timed / rescheduled current slot)
2. `AvailabilitySlot.endAt`
3. Else calendar-day end via platform timezone (`slotDate` before today in Asia/Amman) — same convention as review `visitHasEnded`

Do not invent a visit duration beyond repository data.

## Completion eligibility

`visitOutcome = completed` only when:

- `Booking.status = confirmed`
- valid check-in (`checkInStatus = verified` and/or `visitOutcome = checked_in`)
- authoritative visit end has passed (inclusive at exact end Instant)
- no open Owner-fault / FM / no-show / check-in dispute incident
- no open Dispute
- no terminal visit outcome / reason code already set

**No check-in + past end** → remains reviewable under 3C.4E.4B — never fabricate success.

## Transition

Idempotent conditional `updateMany`:

`checked_in` (or verified + null/pending) → `completed`

Audit: `booking.visit_completed` (lifecycle only — **no financial mutation**).

## Settlement / economics

Completion does **not**:

- create refunds/charges
- change commission
- call payout release
- decide `[[OWNER_SETTLEMENT_CYCLE]]`

Existing payout delay / dispute holds remain authoritative.

## Projection (before job)

`resolveVisitLifecycleProjection` shows `completed` for ended checked-in visits even before the job persists, so UX does not stay “upcoming”.

## Automation

Job: `complete-verified-visits` (bounded batch, advisory-lock registry, not launch-critical). Do not configure Production scheduler here.

## Customer / Owner UX

- Customer My Bookings: `Visit completed` / `تمت الزيارة`; leaves Upcoming.
- Owner Bookings: same lifecycle badge; completed visits leave Upcoming inbox; check-in / no-show actions gated off.

## Reviews

Review eligibility now requires positive visit evidence (`completed` / `checked_in` / verified check-in) and blocks no-show / Owner-fault / FM outcomes.

## Legacy

No mass-complete of historical confirmed Bookings without check-in.

## Commands

- `pnpm preflight:successful-visit-completion`
- `pnpm qa:phase3c4e4c-successful-visit-completion`
