/**
 * Generate Phase 3C.4B.2A Privacy Policy review + readiness exports.
 * Run from repo root after building shared, or via pnpm exec tsx.
 */
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  LEGAL_CONTENT_PLACEHOLDERS,
  PRIVACY_ADVISOR_REVISED_VERSION,
  PRIVACY_DPO_READINESS,
  findUnresolvedLegalPlaceholders,
  getLaunchLegalMarkdown,
  getLegalIdentityFromEnv,
  privacyPolicy,
  privacyPolicyLaunchCandidate,
} from '../src/index.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

const en = getLaunchLegalMarkdown('privacy_policy', 'en');
const ar = getLaunchLegalMarkdown('privacy_policy', 'ar');
const unresolved = findUnresolvedLegalPlaceholders(en + '\n' + ar);
const identity = getLegalIdentityFromEnv();

const review = `# Mazare3 — Privacy Policy Phase 3C.4B.2A Review Export

**Status:** DRAFT only — NOT counsel-activated — NOT Production-active  
**Document type:** privacy_policy  
**Version:** ${PRIVACY_ADVISOR_REVISED_VERSION}  
**Historical corpus preserved:** ${privacyPolicyLaunchCandidate.version} (\`privacy-policy-launch-candidate.ts\`)  
**Customer contractual package unchanged:** 1.1.2-advisor-final (Terms / Cancellation / Booking Terms)

Cross-reference: \`packages/shared/src/privacy-processing-inventory.ts\`, \`packages/shared/src/jordan-prior-consent.ts\`, \`docs/MAZARE3_PDPL_PRIOR_CONSENT_MATRIX_3C4B1_5.md\`

---

## C. Exact version / status

| Field | Value |
| --- | --- |
| Corpus export | \`privacyPolicy\` in \`packages/shared/src/legal-content/privacy-policy.ts\` |
| Version string | \`${PRIVACY_ADVISOR_REVISED_VERSION}\` |
| Activation | DRAFT / non-active |
| dpoAppointed | \`${identity.dpoAppointed}\` (must remain false until formal appointment) |
| Privacy DPO readiness | \`${PRIVACY_DPO_READINESS.appointmentStatus}\` / public contact \`${PRIVACY_DPO_READINESS.publicDpoContact}\` |

---

## D. Unresolved placeholder list (public tokens)

${unresolved.map((t) => `- \`${t}\``).join('\n')}

Canonical placeholder keys also include retention/processor tokens from \`LEGAL_CONTENT_PLACEHOLDERS\`:

- \`${LEGAL_CONTENT_PLACEHOLDERS.PRIVACY_CONTACT_EMAIL}\`
- \`${LEGAL_CONTENT_PLACEHOLDERS.DPO_OR_PRIVACY_CONTACT}\`
- \`${LEGAL_CONTENT_PLACEHOLDERS.PAYMENT_PROVIDER_LEGAL_NAME}\`
- \`${LEGAL_CONTENT_PLACEHOLDERS.PROCESSOR_REGION_NEON}\`
- \`${LEGAL_CONTENT_PLACEHOLDERS.PROCESSOR_REGION_R2}\`
- \`${LEGAL_CONTENT_PLACEHOLDERS.APP_HOSTING_PROVIDER}\`
- \`${LEGAL_CONTENT_PLACEHOLDERS.APP_HOSTING_REGION}\`
- \`${LEGAL_CONTENT_PLACEHOLDERS.RETENTION_ACCOUNTS}\`
- \`${LEGAL_CONTENT_PLACEHOLDERS.RETENTION_BOOKINGS}\`
- \`${LEGAL_CONTENT_PLACEHOLDERS.RETENTION_PAYMENTS}\`
- \`${LEGAL_CONTENT_PLACEHOLDERS.RETENTION_KYC}\`
- \`${LEGAL_CONTENT_PLACEHOLDERS.RETENTION_SETTLEMENTS}\`
- \`${LEGAL_CONTENT_PLACEHOLDERS.RETENTION_LEGAL_ACCEPTANCES}\`
- \`${LEGAL_CONTENT_PLACEHOLDERS.RETENTION_CONSENT_HISTORY}\`
- \`${LEGAL_CONTENT_PLACEHOLDERS.RETENTION_AUDIT_LOGS}\`
- \`${LEGAL_CONTENT_PLACEHOLDERS.RETENTION_SUPPORT}\`
- \`${LEGAL_CONTENT_PLACEHOLDERS.RETENTION_BREACH}\`
- \`${LEGAL_CONTENT_PLACEHOLDERS.RETENTION_EXACT_LOCATION}\`

Internal review flag (do not render publicly): **CONSENT_DURATION_PENDING_COUNSEL**

---

## E. Internal readiness blockers (summary)

See also: \`docs/MAZARE3_PRIVACY_POLICY_3C4B2A_READINESS.md\`

- privacyContactEmail unresolved
- formal DPO appointment / publishable DPO contact (dpoAppointed remains false)
- PSP legal entity unresolved
- active hosting provider / region unresolved
- processor contractual entities / regions unresolved
- cross-border assessments / DPIAs incomplete
- exact retention schedule unresolved
- Prior Consent durations unresolved (CONSENT_DURATION_PENDING_COUNSEL)
- Google minimal pre-consent legal basis pending counsel
- Article 6(A)(5) final counsel mappings pending
- Privacy Policy counsel review missing
- founder publication approval missing
- Production activation must remain blocked

---

## F. Cross-reference — Privacy Processing Inventory

SSOT module: \`packages/shared/src/privacy-processing-inventory.ts\`

This DRAFT Privacy Policy is written from actual Mazare3 processing activities, Prior Consent architecture, DSR calendar (15 working days), breach readiness (Affected Data Subjects; conditional 24h/72h), Cookie Policy essentials-only audit, and legal-identity SSOT. It does not invent GDPR lawful-basis labels for Jordan.

---

## A. FULL Arabic Privacy Policy

\`\`\`markdown
${ar.trim()}
\`\`\`

---

## B. FULL English Privacy Policy

\`\`\`markdown
${en.trim()}
\`\`\`

---

*Generated for Phase 3C.4B.2A review. Do not activate. Do not proceed to 3C.4B.2B from this file alone.*
`;

const readinessMd = `# Mazare3 — Privacy Policy 3C.4B.2A Internal Readiness

**Version:** ${PRIVACY_ADVISOR_REVISED_VERSION}  
**Status:** DRAFT only — Production activation blocked  
**dpoAppointed:** false  
**Candidate:** INTERNAL_DPO_CANDIDATE (do not publish)

## Blockers (must clear before activation)

| Item | Status |
| --- | --- |
| privacyContactEmail | unresolved → \`${LEGAL_CONTENT_PLACEHOLDERS.PRIVACY_CONTACT_EMAIL}\` |
| Formal DPO appointment / contact | not appointed; token \`${LEGAL_CONTENT_PLACEHOLDERS.DPO_OR_PRIVACY_CONTACT}\` |
| PSP legal entity | unresolved → \`${LEGAL_CONTENT_PLACEHOLDERS.PAYMENT_PROVIDER_LEGAL_NAME}\` |
| App hosting provider / region | \`${LEGAL_CONTENT_PLACEHOLDERS.APP_HOSTING_PROVIDER}\` / \`${LEGAL_CONTENT_PLACEHOLDERS.APP_HOSTING_REGION}\` |
| Processor regions (DB / object storage) | \`${LEGAL_CONTENT_PLACEHOLDERS.PROCESSOR_REGION_NEON}\` / \`${LEGAL_CONTENT_PLACEHOLDERS.PROCESSOR_REGION_R2}\` |
| Processor contractual entities | pending contract review (inventory) |
| Cross-border assessments / DPIAs | incomplete |
| Retention schedule | all \`[[RETENTION_*]]\` tokens unresolved |
| Prior Consent durations | **CONSENT_DURATION_PENDING_COUNSEL** |
| Google minimal pre-consent basis | counsel review required |
| Article 6(A)(5) mappings | candidate / pending counsel — not public confirmation |
| Privacy Policy counsel review | missing |
| Founder publication approval | missing |

## Guards

- \`assertProductionLegalReady\` blocks unresolved \`[[TOKEN]]\` in ACTIVE docs
- \`legal-activation-readiness\` keeps \`PRIVACY_POLICY_NOT_FINALISED\`
- Seed \`seed-legal-privacy-advisor-revised.ts\` creates DRAFT only; aborts if \`APP_ENV=production\`

## Confirmed non-goals this phase

- No Production deploy/activation
- No mutation of 1.1.2-advisor-final customer contractual package
- No 3C.4B.2B

## Public page

Local/static \`/privacy\` renders corpus from \`getLaunchPublicLegalPage('privacy')\` → DRAFT body for review (not Production-active DB publish).
`;

writeFileSync(resolve(root, 'docs/MAZARE3_PRIVACY_POLICY_3C4B2A_REVIEW.md'), review, 'utf8');
writeFileSync(resolve(root, 'docs/MAZARE3_PRIVACY_POLICY_3C4B2A_READINESS.md'), readinessMd, 'utf8');

console.log('Wrote docs/MAZARE3_PRIVACY_POLICY_3C4B2A_REVIEW.md');
console.log('Wrote docs/MAZARE3_PRIVACY_POLICY_3C4B2A_READINESS.md');
console.log(`Unresolved tokens: ${unresolved.length}`);
console.log(`Corpus version: ${privacyPolicy.version}`);
