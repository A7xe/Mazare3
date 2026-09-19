# Mazare3 — Pool Safety Preflight (3C.4D.5)

**Read-only.** Zero mutations. No private evidence content.

## Command

```bash
pnpm preflight:pool-safety
```

Also: `GET /admin/pool-safety/preflight`

## Counts

- `totalPropertiesDeclaringPools`
- `publishedPoolProperties`
- `poolActivityProfileMismatches`
- `missingOwnerPoolAttestation`
- `unresolvedPoolRegulatoryAssessments`
- `verifiedPoolRegulatoryAssessments`
- `confirmationRequiredAssessments`
- `expiredPoolEvidence`
- `currentlyBookablePoolProperties`

Samples: mismatch id/slug/categories only (≤25).

## Interpretation

| High mismatches | Owner edits / admin review needed before readiness |
| Missing attestation | Blocks submit-for-review for pool Properties |
| Unresolved assessments | Blocks NEW Booking via existing READY gate |
| Bookable pool count | Full bookability evaluator (authority + regulatory) |

## Confirmation

`mutation: false`. No Production apply in this phase.
