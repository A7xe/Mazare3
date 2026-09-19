# Mazare3 — Property Bookability Policy (Design)

**Phase:** 3C.4D.2 — DESIGN ONLY  
**Live code unchanged:** today’s paid Booking gate remains `published && owner.approved` until a later activation phase.

---

## 1. Policy objects

Three independent predicates (conceptual):

```text
canCreateDraft(actor, propertyInput?) → boolean
canSubmitForReview(propertyId) → boolean
canPublish(propertyId) → boolean
canAcceptPaidBooking(propertyId) → boolean
canReceivePayout(ownerProfileId | settlementId) → boolean
```

Optional future:

```text
canPublicPreview(propertyId) → boolean   // discoverable, NOT bookable — distinct status only
```

---

## 2. Fail-closed principle (paid Booking)

For every regulatory requirement instance where:

- applicability ∈ { `required` } **or** unresolved applicability ∈ { `pending_assessment`, `counsel_or_regulator_review` } treated as **blocking until resolved**, and  
- the requirement’s catalog flag `blocksPaidBooking = true` (default for authority, tourism-when-required, municipal-when-required, pool assessment-when-seeded, insurance-when-required),

**satisfaction** requires status ∈ { `verified`, `not_applicable_confirmed` }.

All of the following **fail closed** (block paid Booking):

| Status / condition | Effect |
|--------------------|--------|
| `not_assessed` | Block |
| `under_review` | Block |
| `action_required` | Block |
| `expired` | Block |
| `rejected` | Block |
| applicability `counsel_or_regulator_review` | Block |
| applicability `pending_assessment` on a seeded blocking type | Block |
| derived readiness ≠ `ready` | Block |
| unknown / missing regulatory subsystem when policy enforced | Block |

Only `verified` or `not_applicable_confirmed` may satisfy a required applicable requirement.

**Owner declaration / attestation alone never satisfies those states.**

---

## 3. `canCreateDraft` — permissive

**Allow when**

- Actor authenticated  
- Actor may operate Owner listing path (approved Owner for current Add Farm entry; applicants use onboarding first — keep current product split)  
- Owner not `rejected`/`suspended` for listing create  
- Soft Owner Agreement reacceptance satisfied when required  

**Deny when** those fail.

Draft **does not** require regulatory readiness, payout, or platform verification.

---

## 4. `canSubmitForReview`

**Allow when**

- `canCreateDraft` prerequisites hold for Owner  
- `OwnerStatus.approved`  
- Activity profile declared  
- Listing content completeness (per existing completeness rules + activity)  
- Authority-to-list package present (uploaded)  
- Attestations present (once implemented)  
- Prior Consents valid for collected sensitive data  

**Do not require** derived regulatory readiness = `ready`.

---

## 5. `canPublish`

**Allow when**

- Owner approved, not suspended  
- Property passed content admin approval path  
- Media/publish completeness rules  
- Authority blocking docs reviewed/approved  
- Derived **regulatory readiness = `ready`**  
- No expired blocking evidence  
- Active Owner Agreement (+ commercial terms) accepted when those instruments apply  
- Exact-location Prior Consent valid if exact location stored  

**Deny** if any applicable required regulatory requirement is unresolved (fail closed same statuses as Booking).

**Preview mode:** only via explicit non-`published` bookable-false state; do not overload `published`.

**Note:** `platform_verified` is **not** required to publish.

---

## 6. `canAcceptPaidBooking` — strongest

**Allow when all hold**

1. `OwnerStatus.approved` and not suspended  
2. Property publicly bookable status (today: `published`; future: may split preview) and not suspended/unpublished  
3. `canPublish` regulatory conditions still true at request time (re-check; do not trust stale flag alone)  
4. Derived regulatory readiness = `ready`  
5. No blocking evidence expired  
6. Owner Agreement acceptance valid when OA active  
7. Commercial terms resolved; acceptance on file when custom  
8. Required Owner Prior Consents valid (KYC; exact-location if used; account/marketplace purpose per counsel wiring)  
9. Property operationally able to accept the slot (availability, holds, operations blocks)  
10. No marketplace fairness / risk kill-switch if product defines one  

**Not required**

- `platform_verified`  
- Payout profile complete (recommended: hold funds until payout ready)  

**Fail closed:** any applicable required regulatory gap → deny Booking creation / payment capture initiation.

### Historical Bookings

Document expiry or readiness loss **must not** auto-cancel confirmed Bookings.  
Policy for fulfillment vs refund under later compliance failure = **explicit future policy** (counsel + product). Preserve snapshots.

---

## 7. `canReceivePayout`

**Recommended model: C — complete before first payout (not before Booking)**

| Stage | Payout profile |
|-------|----------------|
| Draft / submit / publish | Not hard-required |
| Paid Booking | Not hard-required if platform can custody/hold balances |
| First disbursement | **Required:** IBAN + beneficiary + payout Prior Consent + review status acceptable + beneficiary matches contracting Owner/operator (3C.4D.7) |

**Rationale:** avoids blocking legitimate Bookings while preventing trapped-customer value and reducing fraud from arbitrary third-party destinations without review.

If custody/hold is operationally impossible, escalate payout readiness to **before paid Booking** (product exception — document explicitly if chosen).

---

## 8. Expiry behavior

| Phase | Behavior |
|-------|----------|
| Valid | No change |
| Expiring soon | Notify Owner + admin; readiness may stay `ready` until `expiresAt` |
| Expired (blocking doc) | Instance → `expired`; readiness → `expired_or_blocked`; **new** paid Bookings denied; publish denied/retracted per policy; **do not** auto-cancel history |
| Renew | New evidence → `under_review` → `verified`; audit retained |

---

## 9. Effective-date / snapshot needs on Booking

Minimal Booking evidence (references, not private blobs):

| Field (conceptual) | Purpose |
|--------------------|---------|
| `ownerProfileId` / contracting `operatorPartyId` | Who offered |
| `propertyId` + contentVersionId | What was listed |
| Commercial financial snapshot | Existing SSOT fields |
| `regulatoryReadinessAtAccept` | `ready` proof |
| `regulatoryRequirementRefs[]` | instance ids + statuses + hashes |
| `listingSnapshotRef` | amenities/rules/capacity/media refs (3C.4D.6) |
| Cancellation/policy version ids | Consumer terms evidence |

---

## 10. Listing content snapshot (3C.4D.6 design pointer)

Snapshot at Booking accept (or payment confirm — pick one SSOT moment):

- Title / identity  
- Key media references  
- Amenities set  
- Capacity / bedrooms / bathrooms / pool flags  
- Rules / restrictions  
- Access features relevant to Customer  
- Price/economics (already largely snapshotted)  
- Cancellation policy version  
- Property content version  

Edits after confirm must not silently rewrite this evidence.

---

## 11. Suspension interactions

| Suspension | Draft | Publish | Paid Booking | Payout |
|------------|-------|---------|--------------|--------|
| Owner suspended | Deny | Deny / unpublish | Deny | Deny new disburse (due amounts policy separate) |
| Property suspended | Deny edits per FSM | Deny | Deny | N/A |
| Regulatory expired_or_blocked | Allow draft fix | Deny | Deny | Per payout policy |

---

## 12. Activation note

Enforcing this policy in code requires:

1. Activity + regulatory data model (3C.4D.3–4)  
2. Admin tooling for applicability / verify / N/A  
3. Backfill / grandfather strategy for existing published inventory (**explicit product decision** — fail-closed vs temporary waiver flag with audit)  
4. Then flip `canAcceptPaidBooking` / publish checks  

**3C.4D.2 does not flip the live gate.**

---

## 13. `owner_account_and_marketplace_operation` (unwired purpose)

**What it represents (inventory):** Prior Consent purpose for Owner/Partner account and operational marketplace participation data (collection points: become_owner / partner_onboarding_entry). Corpus marks `PRIOR_CONSENT_CONFIRMED` in inventory — **but runtime gate is unwired** (3C.4D.1).

**Design options (no Privacy Policy edit this phase)**

| Option | Notes |
|--------|--------|
| Wire as Prior Consent at become-owner entry | Matches inventory collectionPoints |
| Reclassify / merge with adjacent purposes | Only with counsel |
| Remove from inventory | Only with counsel |

**Legal basis decision:** `COUNSEL_REVIEW_REQUIRED` — do not invent Article 6 exception from code. Duration already `DURATION_REQUIRES_LEGAL_REVIEW`.

Until counsel closes: treat as **product gap**; do not fabricate acceptances; gate matrix marks COUNSEL.

---

## 14. Cross-references

- Gate matrix: `docs/MAZARE3_PROPERTY_GATE_MATRIX_3C4D2.md`  
- Activity/regulatory model: `docs/MAZARE3_PROPERTY_ACTIVITY_REGULATORY_MODEL_3C4D2.md`  
- Prior audit: `docs/MAZARE3_ADD_YOUR_FARM_LEGAL_AUDIT_3C4D1.md`
