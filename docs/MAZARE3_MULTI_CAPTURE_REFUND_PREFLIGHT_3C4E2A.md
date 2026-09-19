# Mazare3 — Multi-Capture Refund Preflight (Phase 3C.4E.2A)

**Command:** `pnpm preflight:multi-capture-refunds`

**Mode:** Read-only. `mutation: false`. No provider secrets logged.

## Purpose

Surface local/dev inventory risk for multi-capture refund integrity **without** mutating data or fabricating provider refunds.

## Counts reported

| Key | Meaning |
|-----|---------|
| `bookingsWithMultipleSuccessfulCaptures` | Bookings with >1 `Payment.status = succeeded` |
| `bookingsWithRefundRequestAndMultipleCaptures` | Those bookings that also have a `RefundRequest` |
| `potentiallyIncompleteLegacyMultiCaptureRefunds` | Multi-capture + RefundRequest without allocations where obligation exceeds a single capture (flag for review) |
| `refundAmountExceedsSingleCaptureButWithinAggregate` | Required refund > max single capture but ≤ sum of captures |
| `duplicateProviderRefundReferenceAnomalies` | Same `providerRefundRef` on more than one allocation |
| `refundRequestsMarkedCompleteWhileAggregateIncomplete` | `processed` status but succeeded allocation sum < required |

## Samples

`sampleBookingIds` includes capped lists for multi-capture, incomplete legacy, and complete-while-incomplete cases — IDs only, no payment secrets.

## Operator guidance

1. Run against **local/dev** only.
2. Treat incomplete-legacy and complete-while-incomplete as **manual review queues**.
3. Do **not** auto-mark historical refunds successful.
4. Do **not** apply this migration to Production in this phase.

## Related

- Integrity design: `docs/MAZARE3_MULTI_CAPTURE_REFUND_INTEGRITY_3C4E2A.md`
- Implementation: `apps/api/src/services/multi-capture-refund.service.ts`
- Preflight service: `apps/api/src/services/multi-capture-refund-preflight.service.ts`
