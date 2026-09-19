/**
 * Generate Phase 3C.4B.2C Privacy Policy final review + diff exports.
 */
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ARTICLE_14_TRANSFER_CONSENT_EVIDENCE_AUDIT,
  ARTICLE_9_PRE_PROCESSING_NOTICE_AUDIT,
  JORDAN_PROFILING_AUDIT,
  PRIVACY_ADVISOR_REVISED_VERSION,
  PRIVACY_ADVISOR_REVISED_VERSION_111,
  PRIVACY_TRACKER_RUNTIME_VERIFICATION_REQUIRED,
  findUnresolvedLegalPlaceholders,
  getLaunchLegalMarkdown,
  getLegalIdentityFromEnv,
  privacyPolicy,
  privacyPolicyAdvisorRevised111,
} from '../src/index.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const en = getLaunchLegalMarkdown('privacy_policy', 'en');
const ar = getLaunchLegalMarkdown('privacy_policy', 'ar');
const unresolved = findUnresolvedLegalPlaceholders(en + '\n' + ar);
const identity = getLegalIdentityFromEnv();

const review = `# Mazare3 — Privacy Policy Phase 3C.4B.2C Final Review Export

**Status:** DRAFT only — advisor-final text for counsel/provider input — NOT counsel-approved — NOT Production-active  
**Version:** ${PRIVACY_ADVISOR_REVISED_VERSION}  
**Preserved:** ${PRIVACY_ADVISOR_REVISED_VERSION_111}, 1.1.0-advisor-revised, 1.0.1-launch-candidate  
**Contractual Terms/Booking/Cancellation:** unchanged at 1.1.2-advisor-final (different documentType)

---

## Unresolved placeholders

${unresolved.map((t) => `- \`${t}\``).join('\n')}

---

## Remaining external blockers

- privacyContactEmail / DPO contact (dpoAppointed=${identity.dpoAppointed})
- PSP / database / object storage / Google / email / hosting legal names, privacy contacts, and processing regions
- Retention schedule tokens
- Prior Consent durations
- Cross-border DPIAs (must be completed before Production reliance)
- \`${PRIVACY_TRACKER_RUNTIME_VERIFICATION_REQUIRED}\`
- Article 14 transfer register legal sufficiency: COUNSEL_REVIEW_REQUIRED
- Article 9 notice legal sufficiency: COUNSEL_REVIEW_REQUIRED
- Privacy Policy counsel review + founder publication approval

### Profiling audit

\`\`\`json
${JSON.stringify(JORDAN_PROFILING_AUDIT, null, 2)}
\`\`\`

### Article 9 notice audit (summary)

- Purposes covered: ${ARTICLE_9_PRE_PROCESSING_NOTICE_AUDIT.length}
- Evidence reuse: consentText / hash / purposeVersion / privacyNoticeVersionId
- Start events are purpose-specific (not invented calendar dates)

### Article 14 transfer evidence

\`\`\`json
${JSON.stringify(ARTICLE_14_TRANSFER_CONSENT_EVIDENCE_AUDIT, null, 2)}
\`\`\`

---

## FULL Arabic (${PRIVACY_ADVISOR_REVISED_VERSION})

\`\`\`markdown
${ar.trim()}
\`\`\`

---

## FULL English (${PRIVACY_ADVISOR_REVISED_VERSION})

\`\`\`markdown
${en.trim()}
\`\`\`
`;

const diff = `# Mazare3 — Privacy Policy 3C.4B.2C Diff (${PRIVACY_ADVISOR_REVISED_VERSION_111} → ${PRIVACY_ADVISOR_REVISED_VERSION})

## Versioning
- Frozen 1.1.1 as \`privacyPolicyAdvisorRevised111\`
- Current DRAFT: \`${PRIVACY_ADVISOR_REVISED_VERSION}\` (privacy_policy only; Terms corpus untouched)

## Article 5
- Removed “authenticated / مصدَّقة” overstatement
- Now: explicit and documented in writing or electronically / صريحة وموثقة خطياً أو إلكترونياً

## Article 9
- New public section: pre-processing information + purpose-specific start events + no current Profiling disclosure
- Internal ARTICLE_9_PRE_PROCESSING_NOTICE_AUDIT maps each gated purpose

## Article 14
- Added transfer condition: serves legitimate interests of Controller and Recipient (transfer rule only; not general LI basis)
- Public: maintains records of transfers/exchanges as required by Jordanian law
- Technical: \`PersonalDataTransferRegisterEntry\` (categories, recipient, purpose, consent linkage; no raw PD copies)
- Legal sufficiency: COUNSEL_REVIEW_REQUIRED

## Regions / cross-border
- PSP / Google / email region placeholders
- Section 12 points to Section 11 table (no APP_HOSTING_PROVIDER-as-region list)
- Direct DPIA-before-transfer wording

## Other
- Privacy contact: removed “until configured” prose
- Art.20 mitigation measures in affected-person notice
- Access right explicitly includes copy
- Legal capacity: parent/legal guardian (or other mechanism expressly permitted)
- Retention: purpose fulfilled unless applicable legislation provides otherwise
- Production readiness: PRIVACY_TRACKER_RUNTIME_VERIFICATION_REQUIRED

## Size
- 1.1.1 EN chars: ${privacyPolicyAdvisorRevised111.markdownEn.length}
- 1.1.2 EN chars: ${privacyPolicy.markdownEn.length}
`;

writeFileSync(resolve(root, 'docs/MAZARE3_PRIVACY_POLICY_3C4B2C_FINAL_REVIEW.md'), review, 'utf8');
writeFileSync(resolve(root, 'docs/MAZARE3_PRIVACY_POLICY_3C4B2C_DIFF.md'), diff, 'utf8');
console.log('Wrote 3C4B2C review + diff');
console.log(`version=${privacyPolicy.version} unresolved=${unresolved.length}`);
