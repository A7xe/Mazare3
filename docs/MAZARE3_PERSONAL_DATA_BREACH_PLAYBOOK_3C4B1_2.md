# Mazare3 — Personal Data Breach Playbook (Phase 3C.4B.1.2)

> **Superseded for future review by** [`docs/MAZARE3_PERSONAL_DATA_BREACH_PLAYBOOK_3C4B1_3.md`](./MAZARE3_PERSONAL_DATA_BREACH_PLAYBOOK_3C4B1_3.md) (Phase 3C.4B.1.3). This file is retained as history.

**Classification:** INTERNAL operational playbook — not legal advice; not a government filing.  
**SSOT code:** `packages/shared/src/personal-data-breach.ts`, `apps/api/src/services/legal/personal-data-breach.service.ts`  
**Date:** 2026-09-14  
**Safety:** LOCAL / DEV readiness. Do **not** auto-submit to the Unit. Do **not** mass-email real users from this phase.

---

## 1. Purpose

Establish Mazare3 operational readiness for personal-data security incidents under Jordan PDPL **Article 20** (and related security duties), distinguishing ordinary security events from notifiable severe-harm personal-data breaches.

## 2. Incident vs Personal Data Breach

| Level | Meaning | Art. 20 24h/72h? |
|-------|---------|------------------|
| **Security incident** (`security_incident_only`) | Technical/ops event; may have **no** personal-data exposure | **No** |
| **Personal data breach** (`personal_data_breach`) | Personal data confidentiality/integrity/availability compromised | Not automatically |
| **PDB likely to cause severe harm** (`severe_harm_likely`, human-confirmed) | Art. 20 severe-harm track | **Yes** — elapsed hours |

A security incident is **not** automatically a personal-data breach.  
A personal-data breach is **not** automatically severe-harm / notifiable without **authorised human** assessment.

## 3. Severe-harm trigger

Software provides a **structured assessment aid** (sensitivity, volume, encryption, keys, exposure, likely harm, containment).  

**Final** `severe_harm_likely` / `severe_harm_not_likely` / `legal_review_required` requires human confirmation (`humanConfirmation: true`).  
Do **not** claim legal certainty from automated scoring.  
Encryption protection may be recorded but **does not** automatically dismiss harm.

## 4. Discovery-time rule

Article 20 clocks start from **discovery**.

- `discoveredAt` — authoritative; **never silently overwritten**
- `initiallyRecordedDiscoveryAt` — immutable snapshot at create
- Corrections only via authorised flow: `correctedDiscoveryAt` + reason + audit  
  Effective discovery = `correctedDiscoveryAt ?? discoveredAt`

## 5. 24h affected-person deadline

If severe harm is human-confirmed:

`customerNotificationDueAt = effectiveDiscoveryAt + 24 elapsed hours`

Display in Asia/Amman; store as absolute Instant.  
**Not** DSR working days. Weekends/holidays do **not** extend.

## 6. 72h Unit deadline

`authorityNotificationDueAt = effectiveDiscoveryAt + 72 elapsed hours`

Same elapsed-hour rules. Jordan Personal Data Protection Unit notification is a **human submission**.

## 7. Roles and escalation

| Role | Status |
|------|--------|
| Formal DPO | `dpoAppointed = false` — do **not** label candidate as appointed |
| INTERNAL_DPO_CANDIDATE | Internal only; may assist if organisationally authorised |
| Admin (`requireAdmin`) | Current technical gate — **organisational least-privilege gap** |
| Future appointed DPO / privacy officer | Intended finer RBAC (not invented in this phase) |

Human confirmation required before: severe-harm likely; customer/authority notification required; notice finalisation; recording regulator submission complete.

## 8. Evidence preservation

Preserve audit actions (`breach.*`), notice content hash, authority pack JSON, submission evidence.  
**Closing must not erase** notification/audit evidence.  
Never store breached payloads, KYC bytes, PAN/CVV, or secrets in the incident record/audit metadata.

## 9. Triage

1. Classify `security_incident_only` vs `personal_data_breach`
2. Identify systems + data categories (inventory-aligned)
3. Estimate affected counts; store ID refs (not bulk PII dumps)
4. Preserve evidence; begin containment checklist

## 10. Containment

Checklist fields include: access revoked; credentials/tokens rotated; endpoint disabled; sessions invalidated; storage exposure corrected; secrets rotated; evidence preserved; forensic notes; root cause; remediation; preventive follow-up.  

**Do not** auto-rotate Production credentials from this local phase.

## 11. Severe-harm assessment checklist

Use factor aid keys (financial, KYC, credentials, volume, identifiability, encryption, keys compromised, exposure duration, unauthorised recipient, likely harms, containment). Document `severeHarmReason`. Human confirms final status.

## 12. Affected-person notification checklist

Draft AR/EN notice including: what happened; categories; likely consequences; actions taken; **practical mitigation measures**; privacy contact (may be unresolved placeholder); notice datetime.  
Draft/prepared ≠ sent. Future Production send needs authorised confirmation + working email provider.

## 13. Authority notification checklist

INTERNAL pack with: source; mechanism; affected subjects/categories/count; data categories; discovery time; containment/remediation; other relevant info.  
Status: **`HUMAN_SUBMISSION_REQUIRED`**. Record `authoritySubmittedAt` / reference / submittedBy **after** human submission. Never fabricate references. No portal automation.

## 14. Communication rules

- Clear AR/EN for affected persons  
- No secrets, attack instructions, or other persons’ data  
- Do not claim users were notified if `EMAIL_PROVIDER=none`  
- Do not contact Ministry/Unit from engineering automation

## 15. Closure / post-incident review

Move to `closed` only after containment/assessment/notifications (as applicable) are complete or lawfully closed. Preserve all evidence. Schedule preventive follow-up.

## 16. Current unresolved blockers

- `privacyContactEmail` — FOUNDER_INPUT_REQUIRED (templates use unresolved placeholder)
- `dpoAppointed` — false; formal appointment pending
- Privacy Policy — **NOT finalised**
- Finer privacy-officer RBAC — organisational gap
- Cross-border / DPIA / retention counsel items from prior privacy phases
- Official holiday calendar for **DSR** (separate; does **not** affect Art. 20 hours)

---

**Related:** [MAZARE3_BREACH_NOTIFICATION_PACK_TEMPLATE_3C4B1_2.md](./MAZARE3_BREACH_NOTIFICATION_PACK_TEMPLATE_3C4B1_2.md)
