# Mazare3 — Owner / Entity / Authority Model

**Phase:** 3C.4D.3  
**Scope:** Foundation only — not full regulatory documents (3C.4D.4)  
**Date:** 2026-09-16

---

## Concepts (kept separate)

| Concept | Model / field | Notes |
|---------|---------------|--------|
| Account holder | `User` | Login identity |
| Contracting operator | `OperatorParty` (+ Property FK) | Party Mazare3 contracts with |
| Declared Property owner | `declaredPropertyOwnerRelation` + optional party | **Owner-declared**, not “verified legal owner” |
| Authority basis | `Property.authorityBasis` | Declared relationship requiring evidence |
| Authority review | `Property.authorityReviewStatus` | ≠ KYC ≠ `platform_verified` ≠ PropertyStatus |
| KYC | `PartnerVerificationStatus` | Unchanged |
| Platform verification | `Property.verificationStatus` | Unchanged; authority approve **does not** grant 15% |

---

## Schema

### Enums
- `OperatorEntityKind`: individual | sole_establishment | legal_entity  
- `AccountHolderOperatorRelation`: is_contracting_party | acts_for_entity | authorised_representative | authorised_manager  
- `DeclaredPropertyOwnerRelation`: same_as_contracting_operator | other_individual | legal_entity | other  
- `PropertyAuthorityBasis`: owner | authorised_manager | authorised_representative | lessee | sublessee | other  
- `PropertyAuthorityReviewStatus`: not_submitted | under_review | action_required | approved | rejected | reassessment_required  
- Additive `PartnerDocumentType`: representation_authority | lease_or_sublease_authority  

### Models
- `OperatorParty` — legalName, entityKind, optional registration/contact, `isDefaultContractingOperator`  
- `OwnerAttestation` — user, ownerProfile, property?, key, corpusVersion, sourceSurface, acceptedAt  
- `PropertyAuthorityReviewEvent` — append-only status transitions  
- `OwnerDocument.propertyId` — optional Property scope for authority evidence  
- `OwnerVerificationProfile.accountHolderRelation`  
- Property authority FKs + review/attestation columns  

---

## Lifecycle

1. Owner creates/updates OperatorParty (default created on onboarding profile save).  
2. On Property (draft OK): set contracting operator, declared-owner relation, authority basis, upload evidence, attest.  
3. **Submit for review** requires complete authority **package** (not approval). Status → `under_review`.  
4. Admin approve / request_changes / reject with reason + audit event.  
5. Material change after `approved` → `reassessment_required`.  

---

## Privacy

- Private storage via existing partner-document pipeline.  
- Authenticated Owner/admin file download only.  
- No public mapper exposure of OperatorParty / authority docs.  
- Inventory key: `owner_operator_party_and_declared_property_owner` (Privacy Policy **not** rewritten).  
- Flag: public Privacy Policy may need later counsel update to name these fields (`PUBLIC_POLICY_CHANGE_MAY_BE_REQUIRED`).

---

## Legacy

- Existing Properties: `authorityReviewStatus = not_submitted` (default).  
- **Not** auto-approved.  
- Owners can still view Properties, payouts, history; complete authority before next submit.

---

## APIs

**Owner**
- `GET/POST /owner/operator-parties`  
- `PATCH /owner/onboarding/account-holder-relation`  
- `GET/PATCH /owner/properties/:id/authority`  
- `POST /owner/properties/:id/authority/attest`  
- `POST /owner/properties/:id/authority/documents`  
- `GET /owner/properties/:id/authority/documents/:docId/file`  

**Admin** (`requireAdmin`)
- `GET /admin/properties/:id/authority`  
- `POST /admin/properties/:id/authority/decision`  
- `GET /admin/properties/:id/authority/documents/:docId/file`  

---

## UI

- Add Farm review step: `PropertyAuthorityPanel`  
- Admin property detail: `AdminPropertyAuthorityPanel`  

---

## Explicit non-goals (this phase)

- Tourism / municipal / pool / insurance requirements  
- Paid Booking regulatory gate change  
- Locked legal document edits  
- Production migrate  

---

## Next

**3C.4D.4** — Regulatory requirements + documents + expiry.
