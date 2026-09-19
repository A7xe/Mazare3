# Mazare3 — Booking Slot Integrity Preflight (Phase 3C.4E.3)

## Command

```bash
pnpm preflight:booking-slot-integrity
```

**READ ONLY.** `mutation: false`. No provider calls. No Personal Data dump (slot ids truncated in samples).

## Interpretation

| Field | Meaning |
|-------|---------|
| `inventoryHoldingBookings` | Count of Bookings in holding statuses |
| `duplicateActiveCanonicalSlots` | Slots with >1 holding Booking (must be **0** before Production index) |
| `confirmedVsConfirmedConflicts` | Multiple confirmed on one slot |
| `pendingVsConfirmedConflicts` | Pending + confirmed on same slot |
| `pendingVsPendingConflicts` | Multiple pendings on same slot |
| `legacyUntimedHoldingBookings` | Holding rows with legacy timing (informational) |
| `constraint.present` | Whether `Booking_one_holding_per_availability_slot` exists |
| `BOOKING_SLOT_LEGACY_CONFLICT_MANUAL_REVIEW_REQUIRED` | `true` if active duplicates exist |

Exit code **3** if legacy conflicts detected (migration would also refuse).

## Conflict categories

1. **Active duplicates** — blocking for uniqueness apply
2. **Cancelled/expired sharing slot with a holder** — expected / OK
3. **Orphan slot FK** — should be impossible (Restrict FK)

## Production prerequisite

Zero `duplicateActiveCanonicalSlots` and `BOOKING_SLOT_LEGACY_CONFLICT_MANUAL_REVIEW_REQUIRED: false` before applying the Production migration.

## Zero-mutation confirmation

The preflight service only runs `count` / `SELECT` queries and prints JSON. It never updates Bookings or slots.
