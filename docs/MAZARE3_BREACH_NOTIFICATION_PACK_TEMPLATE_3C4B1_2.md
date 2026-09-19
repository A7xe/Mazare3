# Mazare3 — Breach Notification Pack Template (Phase 3C.4B.1.2)

**Classification:** INTERNAL template only — **NOT** a submitted notification.  
**Status line (required):** `HUMAN_SUBMISSION_REQUIRED`  
**Do not** auto-submit to the Jordan Personal Data Protection Unit.  
**Do not** invent government form field names beyond Article 20 substance.

---

## A. Customer / Data Subject notice (AR + EN)

Use after human confirms severe-harm likely (or customer notification required).

| Field | Guidance |
|-------|----------|
| Date/time of notice | ISO + Asia/Amman display |
| Discovery reference time | Effective discovery |
| What happened | Plain language; no attack detail |
| Affected data categories | From inventory-aligned list |
| Likely consequences | Where appropriate; no scare inventiveness |
| Actions Mazare3 has taken | Containment/remediation summary |
| Practical measures for the person | Password change, vigilance, contact support, etc. |
| Privacy / support contact | Use unresolved placeholder until founder/legal input |
| Authority note | Person may still contact the competent Jordanian authority |

**Draft / prepared / approved_for_send ≠ sent.**  
Preserve content hash of approved/sent notice.

---

## B. Authority (Unit) pack — INTERNAL export checklist

| Item | Content |
|------|---------|
| Status | **HUMAN_SUBMISSION_REQUIRED** |
| Source of breach | How discovered / origin |
| Mechanism of breach | What failed / how exposure occurred |
| Affected Data Subjects | Categories + estimated count (+ ID refs in system, not pasted bulk PII) |
| Affected data categories | Inventory-aligned codes |
| Discovery time | Effective discovery Instant |
| Containment / remediation | Actions taken and planned |
| Other relevant information | Likely consequences, encryption notes, etc. |
| Customer notice due | discovered + 24h (if severe-harm track) |
| Authority notice due | discovered + 72h (if severe-harm track) |

### After human submission (record only)

- `authoritySubmittedAt`
- `authoritySubmissionReference` (real reference from human — never fabricate)
- `authoritySubmittedByUserId`

---

## C. Explicit non-actions

- No browser/API automation to government portals  
- No mass email of real users from QA  
- No labelling INTERNAL_DPO_CANDIDATE as appointed DPO  
- No copying secrets / KYC files / payment tokens into this pack
