# Mazare3 — Pool & Property Safety Conditional Compliance (3C.4D.5)

**Status:** Implemented (local/dev).  
**Production:** untouched.  
**Locked legal docs:** unchanged.

---

## Data model

| Piece | Role |
|-------|------|
| `PropertyPoolSafetyProfile` | Owner-reported pool/water-feature facts (1:1 Property) |
| `PropertySafetyDisclosure` | Optional material access/safety facts |
| `Property.poolSafetyAttestedAt` (+ version / by user) | Fast attestation gate |
| `OwnerAttestation` key `property_pool_safety_disclosure` | Append-only evidence of attestation |
| Existing `POOL_REGULATORY_ASSESSMENT` | Unchanged regulatory assessment path |

Enums: `PoolWaterFeatureKind`, `PoolSeasonality`, `PropertySafetyDisclosureCategory`.

---

## Pool / activity consistency

Authoritative swimming-pool offering signals:

- `PropertyActivity` `swimming_pool` (active)
- `poolsCount > 0`
- Amenities: `pool`, `heated_pool`, `indoor_pool` (`SWIMMING_POOL_AMENITY_KEYS`)

`kids_pool` alone does **not** force swimming-pool regulatory assessment.

On Owner listing update (poolsCount / amenities) and on profile save:  
`syncSwimmingPoolActivityFromListingSignals` creates/activates `swimming_pool` activity and seeds assessments.  
**Legacy rows are not silently rewritten** except when Owner edits; preflight flags mismatches.

Owner removal of activity does **not** self-set `not_applicable_confirmed`.

---

## Owner pool profile

Minimum for swimming_pool submit:

- `waterFeatureKind = swimming_pool`
- `childrenRequireAdultSupervision` declared
- `seasonality` set
- Optional: indoor/outdoor, depths (metres), children allowed, access/warnings text

Depths are **Owner-provided**, not certified. Validation: `0.1–15m`, min ≤ max.

---

## Owner attestation

Corpus: `POOL_SAFETY_ATTESTATION_KEY` / `3c4d5-pool-safety-attest-v1`.

Required before submit-for-review when Property offers a swimming pool.  
Attestation ≠ regulatory verification ≠ `platform_verified`.

---

## General safety disclosure

Optional `PropertySafetyDisclosure` categories (access, stairs, open water, child restriction, construction, other). Public AR/EN text only.

---

## Regulatory assessment integration

Reuses `pool_regulatory_assessment` seeded when `swimming_pool` activity exists.  
Admin decides applicability (including counsel hold). Owner cannot N/A or verify.  
Unresolved assessment blocks NEW publish/Booking via existing readiness/bookability SSOT — **no duplicate Booking gate**.

---

## Evidence handling

Unchanged `RegulatoryEvidence` / private storage when admin marks applicable.

---

## Admin review

`AdminPropertyPoolSafetyPanel` + `GET /admin/properties/:id/pool-safety` — disclosure, attestation, linked pool requirement, consistency flags. Distinct from KYC / authority / platform verification.

---

## Public disclosures

`poolSafetyDisclosure` on published Property detail:

- pool available / count / indoor-heated flags  
- Owner-provided depths  
- children supervision / restrictions  
- access/warnings + optional disclosures  

Never: evidence files, licence numbers, admin notes, “government approved / certified safe” badges.

---

## Reassessment triggers

- Listing signals add swimming pool → assessment seed + reassessment  
- Material pool safety fact change → clear attestation + regulatory reassessment  
- Activity profile change (existing 4A)  

---

## Legacy behavior

No auto profiles / attestations / N/A. Preflight lists mismatches.

---

## Privacy / security

Public facts only. Regulatory evidence private. Free-text disclosures may contain Personal Data — inventory unchanged unless counsel requires later. Privacy Policy not rewritten.

---

## Fields for Phase 3C.4D.6 Booking snapshot

Snapshot candidates (do **not** rewrite historical Bookings retrospectively without snapshot):

- `poolsCount`, `hasIndoorPool`, `hasHeatedPool`
- `PropertyPoolSafetyProfile` (kind, depths, children flags, seasonality, access/warnings)
- Active `PropertySafetyDisclosure` rows
- Pool safety attestation version + timestamp
- Linked `pool_regulatory_assessment` applicability/status **as of Booking gate** (status codes only — not evidence blobs)

---

## RBAC

`REGULATORY_RBAC_HARDENING_PENDING` — continue ADMIN reuse.
