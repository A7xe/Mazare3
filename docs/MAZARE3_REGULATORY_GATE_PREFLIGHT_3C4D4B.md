# Mazare3 — Regulatory Gate Preflight (3C.4D.4B)

**Read-only.** Zero mutations. No private document contents or secrets.

## Exact command

```bash
pnpm preflight:regulatory-gate
```

Implementation:

- Script: `apps/api/scripts/preflight-regulatory-gate-3c4d4b.ts`
- Service: `runRegulatoryGatePreflightReport()` in `property-bookability.service.ts`
- Admin (optional): `GET /admin/regulatory-gate/preflight`

Loads DB via local `.env` / Nest Neon — **do not** point at Production until intentionally reviewing that environment with leadership approval. This phase does not deploy or mutate Production.

## Fields / counts returned

```json
{
  "generatedAt": "ISO-8601",
  "mutation": false,
  "note": "Read-only preflight…",
  "counts": {
    "totalProperties": 0,
    "publishedProperties": 0,
    "authorityApproved": 0,
    "regulatoryReadyPublished": 0,
    "publishedButNotRegulatoryReady": 0,
    "readyButAuthorityBlocked": 0,
    "publishedFullyBookable": 0,
    "propertiesWithExpiredBlockingEvidence": 0,
    "futureConfirmedBookingsOnPublished": 0,
    "futureConfirmedBookingsOnPublishedNonReady": 0
  },
  "samples": {
    "publishedNotReady": [{ "id": "…", "slug": "…", "readiness": "incomplete" }]
  }
}
```

Samples are capped (≤25) and contain only id/slug/readiness — never storage keys, file names, or document numbers.

## Interpretation

| Signal | Meaning |
|--------|---------|
| High `publishedButNotRegulatoryReady` | Expect NEW Bookings blocked on those listings after gate enablement; listings stay published |
| `futureConfirmedBookingsOnPublishedNonReady` | Admin must review fulfillment manually — **no** auto-cancel/refund from this gate |
| `readyButAuthorityBlocked` | Regulatory READY but authority gate still blocks |
| `publishedFullyBookable` | Passes full `new_booking` evaluator |

## Zero-mutation confirmation

- Report sets `mutation: false`
- Script exits non-zero if `mutation !== false`
- No `UPDATE` / `DELETE` / status transitions in the preflight path

## Production rollout

Inspect this report on the target database **before** enabling the regulatory Booking/publication gate there. Local/dev enablement in 3C.4D.4B does not constitute Production activation.
