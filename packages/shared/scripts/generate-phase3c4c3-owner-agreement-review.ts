/**
 * Phase 3C.4C.3 — export Owner Agreement final review + focused diff vs 1.1.0.
 */
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  OWNER_ADVISOR_REVISED_VERSION,
  OWNER_ADVISOR_REVISED_VERSION_110,
  LAUNCH_CANDIDATE_VERSION,
  ADVISOR_REVISED_VERSION,
  getLaunchLegalMarkdown,
  getLaunchLegalDocument,
  ownerAgreementAdvisorRevised110,
  ownerAgreementLaunchCandidate,
  findUnresolvedLegalPlaceholders,
  fillPlaceholders,
} from '../src/index.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const doc = getLaunchLegalDocument('owner_agreement');
const en = getLaunchLegalMarkdown('owner_agreement', 'en');
const ar = getLaunchLegalMarkdown('owner_agreement', 'ar');
const en110 = fillPlaceholders(ownerAgreementAdvisorRevised110.markdownEn);
const ar110 = fillPlaceholders(ownerAgreementAdvisorRevised110.markdownAr);

if (doc.version !== OWNER_ADVISOR_REVISED_VERSION) {
  throw new Error(`Expected ${OWNER_ADVISOR_REVISED_VERSION}, got ${doc.version}`);
}
if (ownerAgreementAdvisorRevised110.version !== OWNER_ADVISOR_REVISED_VERSION_110) {
  throw new Error('Frozen 1.1.0 missing');
}
if (ownerAgreementLaunchCandidate.version !== LAUNCH_CANDIDATE_VERSION) {
  throw new Error('Frozen launch-candidate missing');
}

const unresolved = [
  ...new Set([
    ...findUnresolvedLegalPlaceholders(en),
    ...findUnresolvedLegalPlaceholders(ar),
  ]),
].sort();

const review = `# Mazare3 Owner Agreement — Phase 3C.4C.3 Final Review Export

**Document type:** owner_agreement  
**Version:** ${OWNER_ADVISOR_REVISED_VERSION}  
**Status:** DRAFT (advisor-final for counsel/founder completion — NOT counsel-approved — NOT Production-active)  
**Preserved:** ${OWNER_ADVISOR_REVISED_VERSION_110}, ${LAUNCH_CANDIDATE_VERSION}  
**Locked customer docs (unchanged):** Terms / Cancellation / Booking / Privacy @ ${ADVISOR_REVISED_VERSION}

---

## C. Version / status

| Field | Value |
|-------|-------|
| Active corpus | ${OWNER_ADVISOR_REVISED_VERSION} |
| Status | DRAFT |
| Public page | None (in-app) |
| Activation | Not activated |
| Acceptances fabricated | No |

---

## D. Unresolved placeholders

${unresolved.length ? unresolved.map((t) => `- \`[[${t}]]\``).join('\n') : '- (none)'}

---

## E. Founder decisions

- \`[[OWNER_SETTLEMENT_CYCLE]]\` — OWNER_SETTLEMENT_CYCLE_REQUIRES_FOUNDER_DECISION (do not auto-publish code default 21-day cycle)
- OWNER_PAYMENT_FEE_TREATMENT_REQUIRES_FOUNDER_DECISION — confirm no Owner-borne separate PSP fee (code currently deducts only documented OwnerFinancialAdjustments)
- Founder publication approval before any Production activation

---

## F. Counsel / accountant blockers

- OWNER_AGREEMENT_NOT_FINALISED
- LIABILITY_CAP_COUNSEL_REVIEW_REQUIRED
- INDEMNITY_ENFORCEABILITY_COUNSEL_REVIEW_REQUIRED
- OWNER_CUSTOMER_DATA_ROLE_COUNSEL_REVIEW_REQUIRED
- OWNER_TAX_LICENCE_ACCOUNTANT_COUNSEL_REVIEW_REQUIRED
- Counsel approval before Production activation

---

## A. Arabic Owner Agreement

${ar}

---

## B. English Owner Agreement

${en}
`;

function sectionTitles(md: string): string[] {
  return [...md.matchAll(/^## (.+)$/gm)].map((m) => m[1]!);
}

const titles110 = sectionTitles(en110);
const titles111 = sectionTitles(en);
const added = titles111.filter((t) => !titles110.includes(t));
const removed = titles110.filter((t) => !titles111.includes(t));

const diff = `# Mazare3 Owner Agreement — Phase 3C.4C.3 Diff (1.1.0 → 1.1.1)

**From:** ${OWNER_ADVISOR_REVISED_VERSION_110}  
**To:** ${OWNER_ADVISOR_REVISED_VERSION}

## Structural

| Change | Detail |
|--------|--------|
| Added sections | ${added.join('; ') || '(none by exact title match)'} |
| Removed sections | ${removed.join('; ') || '(none by exact title match)'} |
| Definitions | Added Commercial Booking Value / Captured Amount / Commission Snapshot / etc. |
| Precedence | Added related-documents hierarchy |
| Public cleanup | Removed DRAFT-for-counsel intro, HTML counsel comments, "counsel later", "current system/workflow" financial language |
| Commission basis | Clarified 18%/15% of Commercial Booking Value |
| Payment fees | Stated no separate PSP fee deduction from Owner Earnings; no open-ended fee right |
| Adjustments | Closed open-ended "other expressly documented" penalties; transparency + support review |
| Verification | Reason category + support review |
| Suspension | Cure principle for remediable breach |
| Exit | Removed unsupported Booking "transfer" |
| Media licence | Narrow service-provider processing on Mazare3's behalf |
| Privacy role | Explicit non-classification as processor/controller |
| Settlement | Material adverse cycle change notice/reacceptance; \`[[OWNER_SETTLEMENT_CYCLE]]\` kept |
| Arabic | Fixed acceptance-evidence wording; قيمة الحجز التجارية; مراجعة المحتوى; الانضمام |

## Product companion (same phase)

- Owner read-only \`GET /owner/financial-adjustments\` + payouts UI section
- Activation readiness blockers extended (fee treatment, liability, indemnity, data role, tax)

## Unchanged intentionally

- Locked Terms / Cancellation / Booking / Privacy corpora
- Financial SSOT rates and penalty math
- Soft reacceptance architecture (listings soft-gate; payouts accessible)
`;

writeFileSync(resolve(root, 'docs/MAZARE3_OWNER_AGREEMENT_3C4C3_FINAL_REVIEW.md'), review, 'utf8');
writeFileSync(resolve(root, 'docs/MAZARE3_OWNER_AGREEMENT_3C4C3_DIFF.md'), diff, 'utf8');
console.log('Wrote FINAL_REVIEW + DIFF');
console.log('Unresolved:', unresolved.join(', ') || '(none)');
