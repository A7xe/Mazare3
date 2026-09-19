# Mazare3 — Booking Listing Snapshot Preflight (Phase 3C.4D.6)

## Command (read-only)

```bash
pnpm preflight:booking-listing-snapshot
```

Runs `apps/api/scripts/preflight-booking-listing-snapshot-3c4d6.ts`, which calls `runBookingListingSnapshotPreflightReport()` — **no mutations**.

## Output fields

| Field | Meaning |
| --- | --- |
| `mutation` | Always `false` |
| `counts.totalBookings` | All Booking rows |
| `counts.bookingsWithInitialSnapshot` | Rows with INITIAL listing snapshot |
| `counts.legacyBookingsWithoutSnapshot` | Bookings created before this phase (expected) |
| `counts.duplicateInitialSnapshotAnomalies` | Should be `0` (unique constraint) |
| `counts.integrityHashMismatchesSampled` | Sampled hash drift (should be `0`) |
| `counts.snapshotMediaRefsMissingSampled` | Snapshot media ids with no PropertyMedia row |
| `counts.propertiesWithHistoricalBookings` | Properties that have Bookings (deletion risk surface) |

No Personal Data is printed.

## Interpretation

- High `legacyBookingsWithoutSnapshot` after first deploy is **expected** — do not backfill.
- After the phase is live for NEW Bookings, new rows should increase `bookingsWithInitialSnapshot` only.
- Any `duplicateInitialSnapshotAnomalies > 0` is a data integrity incident.
- `snapshotMediaRefsMissingSampled > 0` means hard-deleted media escaped soft-remove protection — investigate.

## Legacy behaviour

Legacy Bookings remain without snapshots (`LEGACY_SNAPSHOT_UNAVAILABLE` in APIs/UI). Current listing must not be presented as immutable booking-time evidence.

## Zero-mutation confirmation

The preflight script exits with code `2` if `report.mutation !== false`. It performs only `count` / `findMany` / read-only raw SQL aggregates — no inserts, updates, or deletes.
