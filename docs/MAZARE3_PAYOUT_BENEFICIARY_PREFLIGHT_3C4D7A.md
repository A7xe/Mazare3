# Mazare3 — Payout Beneficiary Preflight (Phase 3C.4D.7A)

## Command (read-only)

```bash
pnpm preflight:payout-beneficiary
```

Runs `apps/api/scripts/preflight-payout-beneficiary-3c4d7a.ts` → `runPayoutBeneficiaryPreflightReport()`.

## Counts

| Field | Meaning |
| --- | --- |
| `totalPayoutProfiles` | All OwnerPayoutProfile rows |
| `reviewedApprovedStatus` | `reviewStatus = reviewed` |
| `underReviewPending` | `pending` |
| `actionRequired` / `rejected` / `reassessmentRequired` | Lifecycle states |
| `missingBeneficiaryRelationship` | Legacy / incomplete 3C.4D.7A fields |
| `invalidIbanFormat` | Structural checksum failures (decrypt in-process; **not printed**) |
| `thirdPartyRelationshipCandidates` | Third-party / other-review |
| `nameMatch*` | Heuristic bins (not legal identity) |
| `pendingSettlementsWhoseReleaseWouldBeBlocked` | draft/ready settlements for non-READY owners |
| `payoutReadyProfiles` | Profiles that pass `evaluateOwnerPayoutReadiness` |

## Interpretation

- High `missingBeneficiaryRelationship` after deploy is expected for legacy rows.
- Third-party candidates with `reviewed` status still blocked by counsel flag until founders confirm.
- Blocked pending settlements mean **release** is held — earnings are not confiscated.

## Zero-mutation / no raw IBAN

- `mutation: false` always; exit `2` if not.
- No full IBAN, beneficiary names, emails, or other Personal Data in output.
- Only aggregated counts + last4 never printed in this report.
