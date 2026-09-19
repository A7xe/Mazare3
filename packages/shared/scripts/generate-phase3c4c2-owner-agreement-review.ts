/**
 * Phase 3C.4C.2 — export full Owner Agreement review + readiness docs.
 * Run: pnpm gen:phase3c4c2-owner-agreement-review
 */
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  OWNER_ADVISOR_REVISED_VERSION,
  LAUNCH_CANDIDATE_VERSION,
  getLaunchLegalMarkdown,
  getLaunchLegalDocument,
  ownerAgreementLaunchCandidate,
  findUnresolvedLegalPlaceholders,
  ADVISOR_REVISED_VERSION,
} from '../src/index.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const doc = getLaunchLegalDocument('owner_agreement');
const en = getLaunchLegalMarkdown('owner_agreement', 'en');
const ar = getLaunchLegalMarkdown('owner_agreement', 'ar');
const unresolved = [
  ...new Set([
    ...findUnresolvedLegalPlaceholders(en),
    ...findUnresolvedLegalPlaceholders(ar),
  ]),
].sort();

if (doc.version !== OWNER_ADVISOR_REVISED_VERSION) {
  throw new Error(`Expected ${OWNER_ADVISOR_REVISED_VERSION}, got ${doc.version}`);
}
if (ownerAgreementLaunchCandidate.version !== LAUNCH_CANDIDATE_VERSION) {
  throw new Error('Frozen launch-candidate Owner Agreement missing or wrong version');
}

const reviewPath = resolve(root, 'docs/MAZARE3_OWNER_AGREEMENT_3C4C2_REVIEW.md');
const readinessPath = resolve(root, 'docs/MAZARE3_OWNER_AGREEMENT_3C4C2_READINESS.md');

const review = `# Mazare3 Owner Agreement — Phase 3C.4C.2 Full Review Export

**Document type:** owner_agreement  
**Version:** ${OWNER_ADVISOR_REVISED_VERSION}  
**Status:** DRAFT — not counsel-approved — not Production-activated  
**Preserved historical:** ${LAUNCH_CANDIDATE_VERSION} (\`owner-agreement-launch-candidate.ts\`)  
**Locked customer docs (unchanged):** Terms / Cancellation / Booking / Privacy @ ${ADVISOR_REVISED_VERSION} (Privacy documentType distinct, same version string)

---

## C. Version / status

| Field | Value |
|-------|-------|
| Active corpus | ${OWNER_ADVISOR_REVISED_VERSION} |
| Status | DRAFT |
| Public page | None (in-app / API when later ACTIVE) |
| Activation | Not activated |
| Acceptances fabricated | No |

---

## D. Unresolved placeholders

${unresolved.length ? unresolved.map((t) => `- \`[[${t}]]\``).join('\n') : '- (none)'}

---

## E. Counsel / founder blockers

- OWNER_AGREEMENT_NOT_FINALISED — counsel review + founder publication approval required before activation
- OWNER_SETTLEMENT_CYCLE_REQUIRES_FOUNDER_DECISION — \`[[OWNER_SETTLEMENT_CYCLE]]\` must be founder-approved
- COUNSEL_REVIEW_REQUIRED — tax / licence / liability cap / indemnity enforceability markers in corpus
- ACCOUNTANT / COUNSEL REVIEW REQUIRED — invoice / tax characterisation
- Locked Privacy / Terms / Cancellation / Booking must remain unmodified by Owner Agreement activation work

---

## A. Arabic Owner Agreement

${ar}

---

## B. English Owner Agreement

${en}
`;

const readiness = `# Mazare3 Owner Agreement — Phase 3C.4C.2 Readiness

**Corpus:** owner_agreement @ ${OWNER_ADVISOR_REVISED_VERSION} (DRAFT)  
**Preserved:** ${LAUNCH_CANDIDATE_VERSION}

## Publication blockers (must remain BLOCKED until resolved)

| Blocker | Reason |
|---------|--------|
| OWNER_AGREEMENT_NOT_FINALISED | DRAFT not counsel-activated |
| [[OWNER_SETTLEMENT_CYCLE]] | Contractual settlement cadence requires founder decision (code default must not silently become a false legal promise) |
| Tax / licence wording | COUNSEL_REVIEW_REQUIRED |
| Liability cap / formula | COUNSEL_REVIEW_REQUIRED |
| Indemnity enforceability | COUNSEL_REVIEW_REQUIRED |
| PSP payout rails | Counsel / PSP review markers remain |
| Production activation | Must not run with unresolved placeholders or without counsel + founder approvals |

## Technical wiring checklist

- [x] Active corpus version ${OWNER_ADVISOR_REVISED_VERSION}
- [x] Historical ${LAUNCH_CANDIDATE_VERSION} frozen
- [x] Soft reacceptance architecture unchanged (listings soft-gated; payouts accessible)
- [x] Custom commercial terms acceptance remains separate
- [x] No public Owner Agreement slug (in-app only)
- [x] Seed DRAFT-only script (no acceptances, production abort)
- [ ] Counsel approval
- [ ] Founder settlement-cycle decision filled into \`[[OWNER_SETTLEMENT_CYCLE]]\`
- [ ] Production activation (explicit later phase)

## Explicit non-actions completed this phase

- Locked Terms / Cancellation / Booking / Privacy not modified
- Financial SSOT / commission logic not modified
- Production not activated / not deployed
- No fabricated Owner acceptances
`;

writeFileSync(reviewPath, review, 'utf8');
writeFileSync(readinessPath, readiness, 'utf8');
console.log(`Wrote ${reviewPath}`);
console.log(`Wrote ${readinessPath}`);
console.log(`Unresolved placeholders: ${unresolved.join(', ') || '(none)'}`);
