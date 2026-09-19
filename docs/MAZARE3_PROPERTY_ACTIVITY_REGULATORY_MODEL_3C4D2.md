# Mazare3 — Property Activity & Regulatory Model (Design)

**Phase:** 3C.4D.2 — DESIGN ONLY  
**Rule:** Activity is an **input** to applicability. Do **not** hard-map farm/chalet → tourism class. Unconfirmed legal obligations are tagged `REGULATORY_CONFIRMATION_REQUIRED`.

---

## 1. Proposed enums / types (conceptual — no migration)

### 1.1 Property activity codes (multi-select)

```text
PropertyActivityCode =
  | day_use
  | overnight_accommodation
  | events
  | swimming_pool
  | food_service
  | other
```

- A Property holds **many** activities (join / array of flags with provenance).  
- Amenity `poolsCount > 0` / pool amenity **must sync or trigger** `swimming_pool` activity (or a pending assessment flag) — design rule for 3C.4D.5.  
- Existing `allowsOvernight` / `allowsEvents` become **derived or mirrored** into this profile later (not deleted blindly).

### 1.2 Owner / operator capacity (separate from User account)

```text
OperatorPartyRole =
  | contracting_owner_operator   // party Mazare3 contracts with
  | property_legal_owner        // title holder if different
  | authorised_manager
  | authorised_representative
  | lessee_or_sublessee
  | other_lawful_authority

OperatorEntityKind =
  | natural_person
  | sole_establishment
  | company
  | other_legal_entity
```

**Keep separate concepts**

| Concept | Meaning |
|---------|---------|
| **ACCOUNT HOLDER** | `User` operating the login |
| **CONTRACTING OWNER/OPERATOR** | Party bound by Owner Agreement / commercial terms |
| **PROPERTY LEGAL OWNER** | Title / ownership party (may differ) |
| **AUTHORISED REPRESENTATIVE** | Acts for contracting party with evidence |

Minimum relational model (later):

```text
User 1—1 OwnerProfile
OwnerProfile 1—N OperatorParty (role, entityKind, legalName, link to docs)
Property N—1 contracting OperatorParty (required)
Property optional — property_legal_owner OperatorParty
AuthorityEvidence → OperatorParty + Property (reuse/extend OwnerDocument types)
```

Today: `PartnerEntityType = individual | business` only — **insufficient** for representative/lessee clarity.

### 1.3 Regulatory requirement catalog (platform-defined templates)

```text
RegulatoryRequirementType =
  | authority_to_list
  | tourism_regulatory_status      // NOT auto-required for every farm
  | municipal_or_professional_licence
  | pool_regulatory_assessment
  | civil_liability_insurance
  | food_service_assessment        // placeholder; applicability counsel-driven
  | other_regulatory
```

Templates carry: default applicability rules (activity × jurisdiction hints), whether **blocking** for publish/Booking, public disclosure policy (`internal_only` default).

**Do not** put `tourismLicenceNumber` / `poolLicenceNumber` on Property.

### 1.4 Requirement instance status (per Property × requirement)

Align with project snake_case enums:

```text
RegulatoryRequirementStatus =
  | not_assessed              // unknown — FAIL CLOSED for Booking if required+applicable
  | under_review
  | action_required           // Owner must supply/fix
  | verified                  // Mazare3 authorised review
  | not_applicable_confirmed  // Mazare3 affirmatively N/A — NOT "Owner skipped upload"
  | expired                   // was verified; evidence past expiresAt
  | rejected
```

**No Owner self-set** of `verified` or `not_applicable_confirmed`.

### 1.5 Applicability decision (separate from satisfaction)

```text
RegulatoryApplicability =
  | pending_assessment
  | required
  | not_applicable_confirmed
  | counsel_or_regulator_review   // hold; treat as unresolved for Booking
```

For `tourism_regulatory_status` and insurance/pool: admin/counsel may set applicability before evidence verification.

### 1.6 Derived Property regulatory readiness

```text
PropertyRegulatoryReadiness =
  | not_started
  | incomplete
  | under_review
  | action_required
  | ready
  | expired_or_blocked
```

**Derivation (preferred — avoid second mutable SSOT):**

- `ready` ⇔ every **applicable required** instance is `verified` **or** `not_applicable_confirmed`, and none `expired`/`rejected`/`action_required`/`not_assessed`/`under_review`/`counsel_or_regulator_review` unresolved.  
- Cache optional for query speed; invalidate on instance change; never admin-edit cache alone.

### 1.7 Evidence / document (generic)

```text
RegulatoryEvidence {
  requirementInstanceId
  storageKey (private)
  originalFileName, mime, size
  documentNumber?
  issuerName? / issuerAuthorityCode?   // e.g. greater_amman_municipality | other_municipality | other_competent_authority | unknown
  issueDate?, expiresAt?, validFrom?
  insurerName?                          // insurance
  policyReference?                      // insurance
  reviewStatus, reviewedBy, reviewedAt, rejectionReason
  contentHash?
}
```

Extend private KYC storage patterns; **never** public URLs.

### 1.8 Admin decision audit

```text
RegulatoryDecisionAudit {
  propertyId, requirementInstanceId
  previousStatus, newStatus
  previousApplicability?, newApplicability?
  reviewerUserId, at
  reasonCategory, reasonText?
  evidenceIds[]
}
```

No silent overwrite without append-only history.

---

## 2. Relationships (conceptual ER)

```text
Property
  ├── PropertyActivityProfile (N activities)
  ├── contracting OperatorParty
  ├── PropertyRegulatoryRequirementInstance (N)
  │     ├── applicability + status + dates
  │     ├── RegulatoryEvidence (N, versioned)
  │     └── RegulatoryDecisionAudit (N)
  └── (existing) PropertyStatus, VerificationStatus  // content / platform badge

OwnerProfile
  ├── OperatorParty (N)
  └── (existing) OwnerDocument KYC  // may link into authority_to_list instances
```

---

## 3. Lifecycle

```text
1. Owner declares activities (+ amenities may auto-flag pool)
2. System seeds requirement instances from catalog rules (status=not_assessed, applicability=pending_assessment)
3. Owner uploads evidence / explanations
4. Admin assesses applicability (required | not_applicable_confirmed | counsel_or_regulator_review)
5. Admin verifies evidence or requests action
6. Derived readiness → ready | action_required | …
7. Publication / Booking policies consume readiness (see gate matrix)
8. Material Property change → REGULATORY_REASSESSMENT_REQUIRED (stale clearance)
9. Evidence nearing expiry → notify; on expiry → status expired → readiness expired_or_blocked
```

---

## 4. Applicability logic (rules engine — design)

**Inputs:** activities, location (city/governorate), operator entity kind, amenity flags, counsel notes.

**Outputs:** seeded instances + suggested applicability (never auto-`verified`).

| Requirement type | Seed when | Default applicability |
|------------------|-----------|------------------------|
| `authority_to_list` | Always for listed Properties | `required` |
| `tourism_regulatory_status` | Overnight / events / or admin flag | `pending_assessment` → **never** auto-required for all farms |
| `municipal_or_professional_licence` | Commercial-looking activities or admin | `pending_assessment`; issuer not hard-coded |
| `pool_regulatory_assessment` | `swimming_pool` activity or pool amenity | `pending_assessment` — **POOL scope = REGULATORY_CONFIRMATION_REQUIRED** |
| `civil_liability_insurance` | Catalog conditional | `pending_assessment` — **not global** |
| `food_service_assessment` | `food_service` | `pending_assessment` |

Unresolved `counsel_or_regulator_review` ≡ **not ready** for paid Booking (fail closed).

---

## 5. Requirement status state machine

```text
                    ┌──────────────────┐
                    │   not_assessed   │
                    └────────┬─────────┘
                             │ admin starts / Owner submits evidence
                             ▼
                    ┌──────────────────┐
              ┌─────│   under_review   │─────┐
              │     └──────────────────┘     │
              │                              │
    needs Owner fix                    admin decision
              ▼                              │
     ┌────────────────┐                      ├──► verified
     │ action_required│◄────────────────────┤
     └───────┬────────┘                      ├──► not_applicable_confirmed
             │ resubmit                      ├──► rejected
             └──────────► under_review       │
                                             └──► (applicability path)

 verified ──(expiresAt passed)──► expired ──(renew+review)──► verified
 rejected / expired ──(Owner fix)──► under_review
```

**Guards**

- Transition to `verified` | `not_applicable_confirmed` requires permission `regulatory.requirement.decide` (design).  
- Owner may move evidence into queue but not set those two statuses.

---

## 6. Named requirement designs

### 6.1 `tourism_regulatory_status`

- Represents whether tourism classification/registration under frameworks such as Reg. 50/2025 **applies**.  
- Possible admin outcomes: `required` | `not_applicable_confirmed` | `counsel_or_regulator_review`.  
- **Do not** invent farm/chalet category.  
- Tag: `REGULATORY_CONFIRMATION_REQUIRED` for mapping.

### 6.2 `municipal_or_professional_licence`

- Generic competent authority: Greater Amman Municipality | other municipality/local administration | other competent authority.  
- Applicability review-driven by location + activity + entity.

### 6.3 `pool_regulatory_assessment`

- Triggered by pool activity/amenity.  
- Assessment may conclude: public-pool health approval applies | other safety requirement | not applicable.  
- **Do not** assert every private farm pool needs MoH public-pool licence.  
- Flag: `POOL_REGULATORY_SCOPE_COUNSEL_CONFIRMATION_REQUIRED`.

### 6.4 `civil_liability_insurance`

- Conditional; evidence: insurer, policy/ref, issue/expiry, document.  
- Statuses as in §1.4; applicability not global.  
- `REGULATORY_CONFIRMATION_REQUIRED` for when it is mandatory.

---

## 7. Owner attestations (design — not substitute for evidence)

| Key | Statement (conceptual) |
|-----|------------------------|
| `lawful_authority` | Lawful authority to offer the Property |
| `listing_accuracy` | Listing information accurate |
| `media_represents` | Media represents the Property |
| `amenities_accurate` | Amenities materially accurate |
| `restrictions_disclosed` | Material restrictions disclosed |
| `evidence_genuine` | Submitted regulatory evidence genuine/current |
| `notify_material_changes` | Will notify Mazare3 of material changes |

Record: userId, propertyId, keys[], corpusVersion, acceptedAt, sourceSurface, ip/ua hash if policy allows.

---

## 8. Reassessment triggers → `REGULATORY_REASSESSMENT_REQUIRED`

| Change | Effect |
|--------|--------|
| Add overnight / events / food_service / swimming_pool | Re-seed or reopen related instances |
| Remove activity that justified N/A | May reopen related requirements |
| Change contracting operator / authority basis | Authority + possibly all clearances stale |
| Material location / jurisdiction change | Municipal/tourism applicability stale |
| Admin revoke verification | Readiness drops |

While reassessment open: treat readiness ≠ `ready` (fail closed for new paid Bookings). Historical Bookings preserved.

---

## 9. Public badges

| Badge | Allowed when |
|-------|----------------|
| Verified by Mazare3 | `VerificationStatus = platform_verified` only; **not** government |
| Government / MoH / tourism approved | **Never** generic; only if specific verified approval + legally approved wording + disclosure policy |
| Regulatory internals | Default **internal only** |

---

## 10. Worked examples (applicability — not legal conclusions)

### A. Day-use farm, no pool

- Activities: `day_use`  
- Seed: `authority_to_list` required; tourism/municipal/insurance **pending_assessment** (may become N/A after review).  
- Pool assessment: not seeded.  
- Tag: tourism/municipal outcome = `REGULATORY_CONFIRMATION_REQUIRED`.

### B. Day-use farm + pool

- Activities: `day_use` + `swimming_pool`  
- Seed: authority + **`pool_regulatory_assessment`** pending.  
- Booking blocked until pool assessment verified or N/A confirmed (+ other requireds).

### C. Overnight chalet

- Activities: `overnight_accommodation`  
- Seed: authority + tourism_regulatory_status pending (+ municipal pending).  
- Do **not** auto-classify as hotel/camp.

### D. Overnight chalet + pool

- Activities: overnight + swimming_pool  
- Seed: authority + tourism pending + pool assessment pending (+ insurance pending as counsel may require later).

### E. Event venue + food service

- Activities: `events` + `food_service`  
- Seed: authority + food_service_assessment pending + tourism/municipal pending as review dictates.  
- Higher chance of `counsel_or_regulator_review` holds.

---

## 11. Effective-date & Booking evidence (design)

Per requirement instance / clearance:

- `verifiedAt`, `validFrom?`, `expiresAt?`  
- Booking stores **references**, not private files: readiness state at accept, requirement instance version IDs, evidence content hashes, listing content version ID, commercial snapshot (existing), Owner/operator party IDs.

---

## 12. Proposed admin permissions (not implemented)

| Permission | Scope |
|------------|--------|
| `regulatory.review.view` | View instances/evidence metadata |
| `regulatory.review.manage` | Request changes, comments |
| `regulatory.applicability.decide` | required / N/A confirmed / counsel hold |
| `regulatory.evidence.decide` | approve/reject evidence |
| `regulatory.expiry.override` | Rare justified override (audited) |
| `regulatory.clearance.final` | Affirm Property readiness for publish/Booking policy |
| Super-admin | All |

---

## 13. Explicit non-claims

- This design does **not** state that every Mazare3 Property needs tourism registration, municipal licence, MoH pool approval, or insurance.  
- Locked legal documents are **not** modified.  
- No schema shipped in 3C.4D.2.
