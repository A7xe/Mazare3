# Mazare3 — Personal Data Breach Playbook (Phase 3C.4B.1.3)

**Classification:** INTERNAL operational playbook — not legal advice; not a government filing.  
**Status:** Supersedes `docs/MAZARE3_PERSONAL_DATA_BREACH_PLAYBOOK_3C4B1_2.md` (prior retained as history).  
**SSOT:** `packages/shared/src/personal-data-breach.ts`, breach service + `UserCapabilityGrant`  
**Date:** 2026-09-14

---

## 1. Purpose

Operational readiness for Jordan PDPL Article 20 personal-data breaches, with hardened access control and per-recipient notification evidence.

## 2. Affected Data Subjects vs Customers

Article 20 applies to **Affected Data Subjects** (`الأشخاص المعنيون المتأثرون`), not Customers only.

May include:

- Customers
- Owners / Partners
- other natural persons whose personal data Mazare3 holds (including non-account refs, minimised)

Domain fields use `dataSubjectNotification*` (Art. 20). Booking “Customer” terminology is unchanged elsewhere.

## 3. Incident vs PDB vs severe harm

Unchanged: security incident ≠ PDB ≠ severe-harm notifiable. 24h/72h apply only after human-confirmed severe harm, as **elapsed hours** from effective discovery.

## 4. Breach RBAC (3C.4B.1.3)

| Capability | Use |
|------------|-----|
| `privacy_breach_view` | List/detail (minimised list) |
| `privacy_breach_manage` | Create/update/reopen/prepare packs / earlier discovery correction |
| `privacy_breach_notification_approve` | Approve / record affected-person notice + recipient state |
| `privacy_breach_authority_record` | Approve authority pack / record Unit submission |
| `privacy_breach_discovery_correct_later` | Move discovery **later** (extends clocks) |

`User.superAdmin=true` grants all of the above.

**Ordinary `admin` role alone: DENIED.**  
Customer/Owner: no admin breach console (still blocked by `requireAdmin`).

## 5. Per-recipient notification evidence

`PersonalDataBreachRecipientNotice` stores per affected person / safe ref:

- incident ID, subject category, userId / ownerProfileId / externalRef
- channel, content hash, prepared/approved/attempted/sent/failed timestamps
- states: pending → prepared → approved → attempted → sent / delivery_confirmed / failed / manual_followup_required

**PREPARED ≠ SENT. APPROVED ≠ SENT. ATTEMPTED ≠ SENT.**

Aggregate incident status is **derived** from recipients. One FAILED recipient prevents a fully-notified aggregate.

## 6. Failed delivery / manual follow-up

On failure or `EMAIL_PROVIDER=none` blocker: show FAILED / MANUAL_FOLLOWUP_REQUIRED; keep 24h deadline visible; do not invent delivery success. Manual channel evidence requires human confirmation.

## 7. Discovery-time correction controls

Immutable: `discoveredAt`, `initiallyRecordedDiscoveryAt`.  
Corrections: `correctedDiscoveryAt` + reason + reviewer + audit.

- **Earlier** correction: `privacy_breach_manage` — immediately shortens Art.20 dues if severe harm already confirmed.
- **Later** correction (extends clocks): requires `privacy_breach_discovery_correct_later` or superAdmin + mandatory reason. Silent extension forbidden.

## 8. Deadline history

`PersonalDataBreachDeadlineHistory` preserves original and corrected discovery/24h/72h snapshots with reason and reviewer. Do not overwrite history.

## 9. Reassessment / reopen

Closed incidents may reopen to `legal_assessment` with append-only `assessmentHistory`.  
**Reopening does not reset Article 20 clocks.** Later severe-harm confirmation still uses effective discovery time.

## 10–15. (unchanged cores)

Containment checklist, authority pack `HUMAN_SUBMISSION_REQUIRED`, no automatic Unit portal, practical mitigation measures in notices, closure preserves evidence.

## 16. Unresolved blockers

- `privacyContactEmail` unresolved placeholder  
- `dpoAppointed=false`  
- Privacy Policy not finalised  
- Capability grants must be issued operationally (ordinary admin has none by default)

---

**Related template:** [MAZARE3_BREACH_NOTIFICATION_PACK_TEMPLATE_3C4B1_2.md](./MAZARE3_BREACH_NOTIFICATION_PACK_TEMPLATE_3C4B1_2.md) (still valid; Affected Data Subjects wording applies).
