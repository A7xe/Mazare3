# Mazare3 — Property Activity + Regulatory Requirements Foundation (3C.4D.4A)

**Status:** Implemented (local/dev). **Does not** gate publication or paid Booking (deferred to 3C.4D.4B).

**Locked legal docs:** unchanged (Terms/Cancel/Booking/Privacy `1.1.2-advisor-final`; Owner Agreement `1.1.1-advisor-final`).

**Production:** not touched.

---

## Schema

| Model | Purpose |
|-------|---------|
| `PropertyActivity` | Multi-select controlled activity taxonomy per Property |
| `PropertyRegulatoryRequirement` | Per-Property requirement instance (applicability ≠ compliance) |
| `RegulatoryEvidence` | Private evidence attached to a requirement (`storageKey` only) |
| `RegulatoryDecisionEvent` | Append-only applicability/status decision history |

Enums: `PropertyActivityCode`, `RegulatoryRequirementType`, `RegulatoryApplicability`, `RegulatoryComplianceStatus`.

---

## Activity model (`PropertyActivityCode`)

- `day_use`
- `overnight_accommodation`
- `events`
- `swimming_pool`
- `food_service`
- `other` (+ optional `otherDescription`)

Activity is **not** a licence decision. It only drives assessment seeding.

---

## Requirement types (`RegulatoryRequirementType`)

| Type | Meaning |
|------|---------|
| `tourism_regulatory_status` | Tourism regulatory **assessment** needed |
| `municipal_or_professional_licence` | Municipal/professional licence **assessment** |
| `pool_regulatory_assessment` | Pool regulatory/safety requirement must be **determined** |
| `civil_liability_insurance` | Supportable; **not** auto-seeded as universal |
| `other` | Extensible catch-all |

Existence of a row ≠ legal conclusion that a licence is required.

---

## Applicability (`RegulatoryApplicability`)

| Value | Who may set | Ready? |
|-------|-------------|--------|
| `unassessed` | system seed / reassessment | No |
| `applicable` | admin | Only with `verified` + not expired |
| `not_applicable_confirmed` | **admin only** | Yes |
| `regulatory_confirmation_required` | admin | No |

Owner absence of evidence must never become Not Applicable.

---

## Compliance status (`RegulatoryComplianceStatus`)

`not_assessed` | `under_review` | `action_required` | `verified` | `rejected` | `expired`

Do not duplicate N/A here — applicability owns that.

---

## Requirement lifecycle

1. Owner sets activities → assessment rows seeded (`unassessed` / `not_assessed`).
2. Owner uploads private evidence → typically `under_review` (never `verified`).
3. Admin sets applicability + compliance + reason.
4. Material activity / operator / location / authority change → `reassessmentRequired` (+ reopen verified/N/A where designed).
5. Expiry reconciliation may set `expired` without deleting evidence.

---

## Activity triggers (assessment seeds only)

| Activity | Ensures assessment |
|----------|-------------------|
| any declared activities | `municipal_or_professional_licence` (conservative) |
| `overnight_accommodation` | `tourism_regulatory_status` |
| `swimming_pool` | `pool_regulatory_assessment` |

`civil_liability_insurance` is **not** auto-required.

Shared helper: `requirementTypesSuggestedByActivities` in `@mazare3/shared`.

---

## Readiness SSOT

`evaluatePropertyRegulatoryReadiness(propertyId)` →

`not_started` | `incomplete` | `under_review` | `action_required` | `ready` | `expired_or_blocked`

plus `blockingReasons`.

### Fail-closed pass for a requirement

- `applicability = not_applicable_confirmed`, **or**
- `applicability = applicable` AND `complianceStatus = verified` AND requirement/evidence not expired

Blocks: `unassessed`, `regulatory_confirmation_required`, `under_review`, `action_required`, `rejected`, `expired`, missing assessment.

### Missing requirements / legacy

- No activities → `not_started`
- Activities but zero requirement rows → `incomplete` (never `ready`)
- Migration does **not** fabricate verified/N/A rows

**No** independent admin checkbox “Regulatory Ready = yes” as override SSOT.

---

## Expiry

- Evidence / requirement may have `expiresAt` (optional).
- Product warning: `REGULATORY_DOCUMENT_EXPIRY_WARNING_DAYS` (default 30) — warning only, not legal validity.
- Derived checks on readiness read + idempotent job `reconcile-regulatory-document-expiry`.
- **Do not** configure Production cron in this phase.
- Evidence is never deleted; historical Bookings unchanged.

---

## Reassessment triggers

| Trigger | Reason category |
|---------|-----------------|
| Material activity profile change | `activity_profile_changed` |
| Property location change | `property_location_changed` |
| Material authority / operator change | `authority_fields_changed` |

Preserves evidence history; reopens verified / N/A confirmed where appropriate.

---

## Privacy

- Private partner storage (`writePartnerDocumentFile` / `readPartnerDocumentFile`).
- No public URLs; not in public Property mapper.
- Owner access scoped by Property ownership; admin via admin routes.
- Inventory key: `property_regulatory_evidence` (inventory/overlay only — Privacy Policy not rewritten).

---

## Owner workflow

- View activities / requirements / readiness (informational).
- Update activities; upload/replace evidence.
- **Cannot:** set `verified`, `not_applicable_confirmed`, or admin review fields.

UI: `PropertyRegulatoryPanel` on Add-Your-Farm review step.

---

## Admin workflow

Separate layers (UI flags): KYC | Authority | **Regulatory** | Property content | Platform Verification.

Actions: assess applicability, verify, request action, reject, counsel-hold (`regulatory_confirmation_required`), bootstrap activities from legacy flags.

UI: `AdminPropertyRegulatoryPanel` on admin Property detail.

### RBAC

`REGULATORY_RBAC_HARDENING_PENDING` — currently `requireAdmin` / SUPER_ADMIN reuse. Granular regulatory permissions deferred.

---

## API paths

### Owner

- `GET /owner/properties/:id/regulatory`
- `PUT /owner/properties/:id/activities`
- `POST /owner/properties/:id/regulatory/requirements/:requirementId/evidence`
- `GET /owner/properties/:id/regulatory/evidence/:evidenceId/file`

### Admin

- `GET /admin/properties/:id/regulatory`
- `POST /admin/properties/:id/regulatory/bootstrap-activities`
- `POST /admin/properties/:id/regulatory/requirements/:requirementId/decision`
- `GET /admin/properties/:id/regulatory/evidence/:evidenceId/file`

---

## Explicit non-goals (3C.4D.4B)

- Do **not** wire readiness into `isPropertyCurrentlyBookable` / checkout / publication.
- Do **not** add public compliance badges.
- Do **not** modify locked legal documents.
