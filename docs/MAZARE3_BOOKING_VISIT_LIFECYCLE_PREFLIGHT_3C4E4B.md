# Mazare3 — Booking Visit Lifecycle Preflight (Phase 3C.4E.4B)

**Command:** `pnpm preflight:booking-visit-lifecycle`  
**Mode:** READ ONLY (`mutation: false`)  
**No Customer PII dump.**

## Counts

- confirmed Bookings with future start
- confirmed currently within visit/grace window
- confirmed past start+60m with no terminal visit outcome
- stale historical confirmed (past grace >7d, no terminal)
- Customer / Owner / access-denied outcome counts
- unresolved visit incidents
- terminal outcome vs financial inconsistency anomalies
- duplicate confirmed customer no-show incidents

## Notes

- Stale historical confirmed rows are **not** auto-classified no-show.
- `mark-visit-review-eligible` job is advisory only.

## Related

- `docs/MAZARE3_BOOKING_VISIT_NO_SHOW_LIFECYCLE_3C4E4B.md`
- `pnpm qa:phase3c4e4b-booking-visit-lifecycle`
