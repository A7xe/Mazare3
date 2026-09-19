/**
 * Phase 3C.4B.2C — Privacy Policy final legal accuracy lock QA.
 * Run: pnpm qa:phase3c4b2c-privacy-final-lock
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ADVISOR_REVISED_VERSION,
  ARTICLE_14_TRANSFER_CONSENT_EVIDENCE_AUDIT,
  ARTICLE_14_TRANSFER_REGISTER_LEGAL_SUFFICIENCY,
  ARTICLE_9_PRE_PROCESSING_NOTICE_AUDIT,
  JORDAN_PROFILING_AUDIT,
  LEGAL_CONTENT_PLACEHOLDERS,
  PRIVACY_ADVISOR_REVISED_VERSION,
  PRIVACY_ADVISOR_REVISED_VERSION_111,
  PRIVACY_DPO_READINESS,
  PRIVACY_TRACKER_RUNTIME_VERIFICATION_REQUIRED,
  findUnresolvedLegalPlaceholders,
  getLaunchLegalDocument,
  getLaunchLegalMarkdown,
  getLegalIdentityFromEnv,
  privacyPolicy,
  privacyPolicyAdvisorRevised111,
} from '../src/index.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
let passed = 0;
let failed = 0;

function pass(name: string) {
  passed++;
  console.log(`  ✅ ${name}`);
}
function fail(name: string, detail: string) {
  failed++;
  console.log(`  ❌ ${name}: ${detail}`);
}
function expect(name: string, cond: boolean, detail = '') {
  if (cond) pass(name);
  else fail(name, detail || 'assertion failed');
}
function src(rel: string) {
  return readFileSync(resolve(root, rel), 'utf8');
}

console.log('\nPhase 3C.4B.2C Privacy Policy Final Legal Accuracy Lock QA\n');

const identity = getLegalIdentityFromEnv();
const en = getLaunchLegalMarkdown('privacy_policy', 'en');
const ar = getLaunchLegalMarkdown('privacy_policy', 'ar');
const doc = getLaunchLegalDocument('privacy_policy');
const readiness = src('apps/api/src/services/legal/legal-activation-readiness.service.ts');
const schema = src('packages/db/prisma/schema.prisma');
const transferSvc = src('apps/api/src/services/legal/personal-data-transfer-register.service.ts');
const reviewDoc = src('docs/MAZARE3_PRIVACY_POLICY_3C4B2C_FINAL_REVIEW.md');
const diffDoc = src('docs/MAZARE3_PRIVACY_POLICY_3C4B2C_DIFF.md');

expect('version 1.1.2-advisor-final', doc.version === PRIVACY_ADVISOR_REVISED_VERSION && privacyPolicy.version === '1.1.2-advisor-final');
expect('1.1.1 preserved', privacyPolicyAdvisorRevised111.version === PRIVACY_ADVISOR_REVISED_VERSION_111);

// A
expect('A EN documented not authenticated', en.includes('explicit and documented in writing or electronically') && !en.includes('authenticated and documented'));
expect('A AR صريحة وموثقة خطياً أو إلكترونياً', ar.includes('صريحة وموثقة خطياً أو إلكترونياً'));
expect('A no مصدَّقة', !ar.includes('مصدَّقة'));

// B–E Article 9
expect('B Article 9 section exists', en.includes('Information provided before processing') && ar.includes('المعلومات المقدَّمة قبل المعالجة'));
expect('C start event/timing', en.includes('purpose-specific') && en.includes('when a new Booking action begins'));
expect('D processors in Art.9', en.includes('Processor(s) involved') || en.includes('the Processor'));
expect('E security at safe level', en.includes('non-sensitive information about applicable security'));

// F Profiling
expect('F audit no profiling', JORDAN_PROFILING_AUDIT.jordanDefinedProfilingPresent === false);
expect('F public no-profiling disclosure', en.includes('does not currently use automated Profiling of Data Subjects'));
expect('F AR no-profiling', ar.includes('لا تستخدم مزارع حالياً التنميط الآلي للأشخاص المعنيين'));

// G–H Art 14 LI transfer condition
expect('G legitimate interests of Controller and Recipient', en.includes('legitimate interests of the Controller and the Recipient'));
expect('G AR المصالح المشروعة للمسؤول عن المعالجة وللمستلم', ar.includes('المصالح المشروعة للمسؤول عن المعالجة وللمستلم'));
expect('H not general processing basis', en.includes('not a general Jordanian legal basis for Mazare3’s own processing'));
expect('H no GDPR LI as general basis', en.includes('does not rely on foreign-law labels such as “legitimate interest”'));

// I–K transfer register
expect('I PersonalDataTransferRegisterEntry model', schema.includes('model PersonalDataTransferRegisterEntry'));
expect('I service exists', transferSvc.includes('createPersonalDataTransferRegisterEntry'));
expect('J categories+recipient+purpose+consent', schema.includes('dataCategoryCodes') && schema.includes('recipientKey') && schema.includes('dataProcessingConsentId'));
expect('K no raw PD copy', transferSvc.includes('not raw Personal Data') || transferSvc.includes('must not store raw Personal Data'));
expect('K legal sufficiency counsel', ARTICLE_14_TRANSFER_REGISTER_LEGAL_SUFFICIENCY === 'COUNSEL_REVIEW_REQUIRED');

// L–N regions
expect('L PSP region placeholder', en.includes(LEGAL_CONTENT_PLACEHOLDERS.PAYMENT_PROVIDER_PROCESSING_REGION));
expect('M Google region placeholder', en.includes(LEGAL_CONTENT_PLACEHOLDERS.GOOGLE_SIGNIN_PROCESSING_REGION));
expect('N email region placeholder', en.includes(LEGAL_CONTENT_PLACEHOLDERS.ACTIVE_EMAIL_PROVIDER_PROCESSING_REGION));
expect('N no As configured with the provider', !en.includes('As configured with the provider'));

// O–P section 11/12
expect('O section 11 reference for locations', en.includes('identified in Section 11'));
expect('P APP_HOSTING_PROVIDER not listed as a region in §12', !en.includes(`${LEGAL_CONTENT_PLACEHOLDERS.PROCESSOR_REGION_NEON}, ${LEGAL_CONTENT_PLACEHOLDERS.PROCESSOR_REGION_R2}, ${LEGAL_CONTENT_PLACEHOLDERS.APP_HOSTING_PROVIDER}`));

// Q–R DPIA
expect('Q direct DPIA requirement', en.includes('conducts the Data Protection Impact Assessment required by the applicable Jordanian instructions'));
expect('Q AR تقييم أثر', ar.includes('تقييم أثر حماية البيانات الشخصية الذي تقتضيه التعليمات الأردنية المنطبقة'));
expect('R no claim DPIA already completed for unresolved', !en.toLowerCase().includes('has already completed a dpia'));

// S contact
expect('S no until contact configured', !en.toLowerCase().includes('until a publishable privacy contact') && !ar.includes('وإلى أن يُضبط'));

// T Art 20 mitigation
expect('T mitigation measures', en.includes('practical measures necessary to help avoid or mitigate'));
expect('T AR الإجراءات العملية', ar.includes('الإجراءات العملية اللازمة للمساعدة في تفادي أو الحد من الآثار'));

// U–V rights
expect('U obtain a copy', en.includes('obtain a copy') && ar.includes('والحصول على نسخة منها'));
expect('V portability separate', en.includes('transfer a copy of Personal Data to another controller'));

// W legal capacity
expect('W parent or legal guardian', en.includes('parent or legal guardian') && ar.includes('أحد الوالدين أو الوصي القانوني'));
expect('W no broad representative alone', !en.includes('parent, guardian, or representative mechanism'));

// X retention
expect('X purpose fulfilled / legislation', en.includes('after the processing purpose has been fulfilled unless applicable legislation'));
expect('X AR استنفاد الغرض', ar.includes('بعد استنفاد الغرض من المعالجة، إلا إذا نص تشريع منطبق'));

// Y tracker
expect('Y tracker verification constant', PRIVACY_TRACKER_RUNTIME_VERIFICATION_REQUIRED === 'PRIVACY_TRACKER_RUNTIME_VERIFICATION_REQUIRED');
expect('Y readiness blocker', readiness.includes('PRIVACY_TRACKER_RUNTIME_VERIFICATION_REQUIRED'));

// Z / AA / AB / AC
expect('Z dpoAppointed false', identity.dpoAppointed === false && PRIVACY_DPO_READINESS.dpoAppointed === false);
expect(
  'AA unresolved blockers',
  findUnresolvedLegalPlaceholders(en).includes(LEGAL_CONTENT_PLACEHOLDERS.PRIVACY_CONTACT_EMAIL) &&
    findUnresolvedLegalPlaceholders(en).includes(LEGAL_CONTENT_PLACEHOLDERS.RETENTION_BOOKINGS),
);
expect('AB Terms still 1.1.2 contractual', ADVISOR_REVISED_VERSION === '1.1.2-advisor-final');
expect(
  'AB Terms document unchanged type',
  getLaunchLegalDocument('terms_and_conditions').version === '1.1.2-advisor-final' &&
    getLaunchLegalDocument('terms_and_conditions').documentType === 'terms_and_conditions',
);
expect('AC production guard / not activated', readiness.includes('PRIVACY_POLICY_NOT_FINALISED'));
expect('Art9 audit rows', ARTICLE_9_PRE_PROCESSING_NOTICE_AUDIT.length === 9);
expect('transfer evidence links register', ARTICLE_14_TRANSFER_CONSENT_EVIDENCE_AUDIT.transferRegisterModel === 'PersonalDataTransferRegisterEntry');
expect('review export', reviewDoc.includes('1.1.2-advisor-final'));
expect('diff export', diffDoc.includes('1.1.1') && diffDoc.includes('1.1.2'));
expect('no INTERNAL REVIEW in public body', !en.includes('INTERNAL REVIEW ONLY'));

console.log(`\n3C.4B.2C QA: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
