/**
 * Generate Phase 3C.4B.2B Privacy Policy review + diff exports.
 */
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ARTICLE_14_TRANSFER_CONSENT_EVIDENCE_AUDIT,
  GOOGLE_OAUTH_PERSONAL_DATA_AUDIT,
  LEGAL_CONTENT_PLACEHOLDERS,
  PRIVACY_ADVISOR_REVISED_VERSION,
  PRIVACY_ADVISOR_REVISED_VERSION_110,
  PRIVACY_DPO_READINESS,
  findUnresolvedLegalPlaceholders,
  getLaunchLegalMarkdown,
  getLegalIdentityFromEnv,
  privacyPolicy,
  privacyPolicyAdvisorRevised110,
} from '../src/index.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const en = getLaunchLegalMarkdown('privacy_policy', 'en');
const ar = getLaunchLegalMarkdown('privacy_policy', 'ar');
const unresolved = findUnresolvedLegalPlaceholders(en + '\n' + ar);
const identity = getLegalIdentityFromEnv();

const review = `# Mazare3 — Privacy Policy Phase 3C.4B.2B Review Export

**Status:** DRAFT only — NOT counsel-activated — NOT Production-active  
**Document type:** privacy_policy  
**Version:** ${PRIVACY_ADVISOR_REVISED_VERSION}  
**Preserved history:** ${PRIVACY_ADVISOR_REVISED_VERSION_110}, 1.0.1-launch-candidate  
**Customer contractual package unchanged:** 1.1.2-advisor-final  

**Internal banners:** must NOT appear in public legal body (review/admin only).

---

## C. Unresolved placeholders

${unresolved.map((t) => `- \`${t}\``).join('\n')}

---

## D. Internal readiness blockers

- privacyContactEmail unresolved
- formal DPO appointment / publishable DPO contact (\`dpoAppointed=${identity.dpoAppointed}\`; candidate internal-only: ${PRIVACY_DPO_READINESS.candidateLabel})
- PSP legal entity + privacy contact unresolved
- Database / object storage / email / hosting / Google provider legal names + privacy contacts unresolved
- Processor regions unresolved
- Cross-border assessments / DPIAs incomplete
- Exact retention schedule (all \`[[RETENTION_*]]\` tokens) unresolved
- Prior Consent durations — CONSENT_DURATION_PENDING_COUNSEL
- Google minimal pre-consent — LEGAL_BASIS_COUNSEL_REVIEW_REQUIRED
- Article 6(A)(5) final counsel mappings pending
- Article 14 transfer consent ready only after processors + disclosures finalised (${ARTICLE_14_TRANSFER_CONSENT_EVIDENCE_AUDIT.status})
- Privacy Policy counsel review missing
- Founder publication approval missing
- Effective / last-updated dates unresolved

### Transfer-consent evidence audit

\`\`\`json
${JSON.stringify(ARTICLE_14_TRANSFER_CONSENT_EVIDENCE_AUDIT, null, 2)}
\`\`\`

### Google OAuth data audit

\`\`\`json
${JSON.stringify(GOOGLE_OAUTH_PERSONAL_DATA_AUDIT, null, 2)}
\`\`\`

---

## A. FULL Arabic Privacy Policy (${PRIVACY_ADVISOR_REVISED_VERSION})

\`\`\`markdown
${ar.trim()}
\`\`\`

---

## B. FULL English Privacy Policy (${PRIVACY_ADVISOR_REVISED_VERSION})

\`\`\`markdown
${en.trim()}
\`\`\`

---

*Generated for Phase 3C.4B.2B. Do not activate.*
`;

const diff = `# Mazare3 — Privacy Policy 3C.4B.2B Diff (${PRIVACY_ADVISOR_REVISED_VERSION_110} → ${PRIVACY_ADVISOR_REVISED_VERSION})

Substantive / editorial changes only (not a full line dump).

## Versioning
- Preserved \`${PRIVACY_ADVISOR_REVISED_VERSION_110}\` as frozen history (\`privacyPolicyAdvisorRevised110\`)
- Current corpus DRAFT: \`${PRIVACY_ADVISOR_REVISED_VERSION}\`
- Public markdown: \`includeInternalBanner: false\` (no INTERNAL REVIEW body banner)

## Public vs internal language
- Removed public drafting phrases (INTERNAL REVIEW ONLY, “في هذه المسودة”, unresolved/under legal review prose, “not fully compliant” drafting)
- Unresolved facts remain as \`[[TOKEN]]\` only; Production still blocked
- Local UI DRAFT badge outside legal body for \`/privacy\`

## Arabic terminology
- Customers: \`العملاء\` / \`العميل\` consistently (not \`الزبائن\`)
- Locale: \`تفضيلات اللغة أو الإعدادات المحلية\`
- Consent evidence: \`أدلة الموافقة الموثقة والمرتبطة بإصدار نص الموافقة\`
- DPO: \`مراقب حماية البيانات الشخصية\` (not \`مسؤول حماية البيانات\`)
- Breach: \`خرق أمن وسلامة البيانات الشخصية\` / \`إخلال بأمن وسلامة البيانات الشخصية\`

## DPO
- Public body keeps \`[[DPO_OR_PRIVACY_CONTACT]]\` without announcing non-appointment
- \`dpoAppointed\` remains false internally

## Prior Consent (Art. 5)
- Explicit, authenticated/documented, purpose-specific, duration-specific, clear/simple/non-misleading, accessible
- Material consent-dependent nature/type/purpose/scope change → new Prior Consent before changed processing
- Typo/formatting-only changes do not by themselves require re-consent

## Article 14 sharing/transfer
- Consent for transfer/exchange unless statutory exception
- Recipient + purpose information; marketing consent; transfer/consent records
- No GDPR LI for Mazare3’s own processing; no asserted exception unless established

## Article 15 cross-border
- Verify recipient protection level; exceptions only where law permits
- Consent despite insufficient protection requires prior information of insufficiency; Mazare3 does not claim current reliance
- DPIA before cross-border transfer where required

## Processors
- Legal name + privacy contact placeholders for active providers
- Booking counterparty wording: complete Booking / booked Property service (not overnight “stay”)

## Retention
- Split privacy requests vs breach records
- Added reviews + listing media categories
- Public body no longer says “tokens unresolved / under legal review”

## Rights / DSR / complaints
- Rights framed as legal rights subject to Jordanian conditions/limits
- Added breach-awareness right; Art. 4 no financial/contractual consequence principle
- 15 working days as legal period (not “aims”)
- Complaint: Mazare3 first → Directorate; Directorate may proceed directly; Bekhidmetkom / official contacts
- Concise enforcement/consequences note

## Breach deadlines
- Direct 24h / 72h from discovery for severe-harm qualifying breaches

## Cookies
- First-party essentials vs PSP-hosted technologies
- Factual: Mazare3 does not currently use GA / Meta Pixel

## Legal capacity
- No guardian workflow; flows not intended for persons lacking capacity without required mechanism

## Metadata
- Version + \`[[PRIVACY_POLICY_EFFECTIVE_DATE]]\` + \`[[PRIVACY_POLICY_LAST_UPDATED_DATE]]\`

## Google OAuth
- Categories/collection/processor table aligned to sub + name + email actually received/persisted

## Historical corpus size note
- 1.1.0 markdown length (EN): ${privacyPolicyAdvisorRevised110.markdownEn.length} chars
- 1.1.1 markdown length (EN): ${privacyPolicy.markdownEn.length} chars

## Unchanged
- Contractual 1.1.2-advisor-final
- No Privacy Policy activation
- No Production deploy
`;

writeFileSync(resolve(root, 'docs/MAZARE3_PRIVACY_POLICY_3C4B2B_REVIEW.md'), review, 'utf8');
writeFileSync(resolve(root, 'docs/MAZARE3_PRIVACY_POLICY_3C4B2B_DIFF.md'), diff, 'utf8');
console.log('Wrote docs/MAZARE3_PRIVACY_POLICY_3C4B2B_REVIEW.md');
console.log('Wrote docs/MAZARE3_PRIVACY_POLICY_3C4B2B_DIFF.md');
console.log(`Corpus ${privacyPolicy.version}; unresolved=${unresolved.length}`);
