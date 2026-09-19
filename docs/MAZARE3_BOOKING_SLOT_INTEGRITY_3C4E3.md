# Mazare3 — Booking Slot Integrity (Phase 3C.4E.3)

**Scope:** Database-level double-booking protection. LOCAL/DEV only. Do NOT apply to Production without the documented rollout. Do NOT modify locked legal documents.

## Slot model

**DISCRETE AvailabilitySlot** (`propertyId` + `date` + `period`), unique per Property calendar cell.

Bookings always reference `availabilitySlotId`. Optional `startAt`/`endAt` on the slot (and Booking snapshots) support timed overlap checks, but inventory ownership is **one holding Booking per AvailabilitySlot row**, not free-form time ranges.

## Inventory-holding statuses

Authoritative set (`BOOKING_INVENTORY_HOLDING_STATUSES` / `SLOT_HOLDING_STATUSES`):

- `pending_owner_approval`
- `pending_payment`
- `pending`
- `confirmed`

Non-holding (do not block new Bookings): `cancelled`, `expired`.

Application availability queries and the DB partial unique index use the **same** set.

## Previous race

App-level protection (Property `FOR UPDATE`, holding-status check, `available`→`booked` CAS) could still lose races across instances / timing windows. No DB invariant prevented two holding Bookings on one slot.

## DB invariant

PostgreSQL **partial unique index** (SQL migration; not Prisma `@@unique`):

```sql
CREATE UNIQUE INDEX "Booking_one_holding_per_availability_slot"
ON "Booking" ("availabilitySlotId")
WHERE status IN (
  'pending_owner_approval',
  'pending_payment',
  'pending',
  'confirmed'
);
```

Answer to “Can two inventory-holding Bookings own the same Property time slot?” → **NO**.

Migration refuses to apply if duplicate active holders exist (`BOOKING_SLOT_LEGACY_CONFLICT_MANUAL_REVIEW_REQUIRED`).

## Booking creation transaction

Defense in depth (unchanged order + DB final authority):

1. Availability / pricing / bookability (outside or before TX)
2. `Property` `FOR UPDATE` (retained — reduces conflict rate; not a substitute for the index)
3. Holding-status read check
4. Optional timed overlap SQL
5. Slot CAS `available` → `booked`
6. `Booking` insert (partial unique enforces exclusivity)
7. Listing snapshot in same TX
8. Commit

Loser → `BOOKING_SLOT_UNAVAILABLE` (409). No Payment session. TX rollback removes local Booking/snapshot rows.

## Conflict error

- Code: `BOOKING_SLOT_UNAVAILABLE` (legacy `SLOT_UNAVAILABLE` still recognized in UI)
- EN: “This time is no longer available. Please choose another time.”
- AR: “هذا الموعد لم يعد متاحاً. اختر موعداً آخر.”
- Audit: `booking.slot_conflict` (no competing Customer PII)

## Release lifecycle

Status transition out of holding set (cancel / expire / decline) automatically frees the partial unique slot. App still updates `AvailabilitySlot.status` via `releaseSlotIfUnheld` or direct `available` where already used.

- Owner approval hold: preserved (pending_owner_approval is holding)
- Pending payment: status remains holding — no release window on accept
- Confirmed: holds
- Cancel / decline / expiry: release once; `releaseSlotIfUnheld` idempotent
- `BALANCE_NOT_PAID`: release only after authoritative cancel TX (reconcile-first from 3C.4E.2C unchanged)

## Reschedule

1. Soft-hold target (`held`) where policy already does
2. On finalize: mark target `booked`, **then** move `Booking.availabilitySlotId` (unique enforces), **then** free old slot
3. If target already held by another Booking → unique violation → `BOOKING_SLOT_UNAVAILABLE`; TX rolls back → **original slot retained**

## Property FOR UPDATE decision

**Kept.** Reduces conflict noise and serializes create attempts per Property. DB index remains the final multi-instance authority.

## Idempotency

Same logical Customer retry that collides with an existing holding Booking for that slot still fails exclusivity (or app-level checks). Distinct from competing Customers.

## Legacy

No auto-cancel/merge. Preflight reports conflicts. Migration blocks if conflicts exist.

## Future Production rollout (DO NOT RUN HERE)

1. `pnpm preflight:booking-slot-integrity` on Production read replica / maintenance window DB
2. Require zero unresolved active conflicts
3. Controlled migration apply
4. Verify index present
5. Concurrency smoke without live charging
6. Monitor `booking.slot_conflict` rate

## Rollback consideration

`DROP INDEX IF EXISTS "Booking_one_holding_per_availability_slot";` — restores prior app-only exclusivity (not recommended once live).
