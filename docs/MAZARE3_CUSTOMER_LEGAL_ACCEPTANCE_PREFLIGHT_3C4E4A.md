# Mazare3 — Customer Legal Acceptance Preflight (Phase 3C.4E.4A / 3C.4E.4A.1)

**Command:** `pnpm preflight:customer-legal-acceptance`  
**Mode:** READ ONLY (`mutation: false`)  
**No Customer PII dump.**

## What it reports

- total Bookings
- Bookings with `BookingLegalSnapshot`
- new-format Bookings with complete contractual version refs (Terms + Booking Terms + Cancellation)
- legacy / incomplete legal snapshots
- Bookings without legal snapshot (`legacyBookingsWithoutSnapshot`)
- Complete snapshot missing Booking-linked LegalAcceptance (`completeSnapshotMissingAcceptance` / `historicalAfterCommitGapMissingAcceptance`)
- ACTIVE legal versions by document type
- required document types with no ACTIVE version
- AR/EN corpus readiness + blockers + enforcementStrict
- anomaly counts:
  - acceptance version ≠ snapshot version (same Booking)
  - DRAFT referenced in snapshot
  - snapshot version not active/superseded
  - complete snapshot missing acceptance evidence

## Interpretation

| Signal | Meaning |
|--------|---------|
| `requiredTypesMissingActiveVersion` non-empty | Activation readiness problem — NEW strict commitments fail safely |
| `legacyIncompleteLegalSnapshots` / `legacyBookingsWithoutSnapshot` | Historical gap — do not fabricate |
| `completeSnapshotMissingAcceptanceEvidence` | Includes **historical 3C.4E.4A after-commit gap leftovers** — do not backfill. NEW Booking create is atomic (3C.4E.4A.1); this count must not grow from new creates |
| `draftReferencedInSnapshot` | Should be ~0; investigate if >0 |
| `corpus.*.corpusReady: false` | Expected while advisor-final docs remain DRAFT |

## Related

- Architecture: `docs/MAZARE3_CUSTOMER_LEGAL_ACCEPTANCE_3C4E4A.md` (incl. Atomic Booking Commitment Evidence)
- QA: `pnpm qa:phase3c4e4a-customer-legal-acceptance`
- Atomic QA: `pnpm qa:phase3c4e4a1-atomic-customer-legal-acceptance`
