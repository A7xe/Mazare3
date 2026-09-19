/**
 * Phase 3C.4B.1.2 — Personal data breach readiness QA.
 * Run: pnpm qa:phase3c4b1-2-breach-readiness
 *
 * Synthetic fixtures / static analysis only — no real notifications, no regulator contact.
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ADVISOR_REVISED_VERSION,
  BREACH_AUTHORITY_NOTIFICATION_HOURS,
  BREACH_AUTOMATIC_AUTHORITY_SUBMISSION_EXISTS,
  BREACH_CUSTOMER_NOTIFICATION_HOURS,
  BREACH_PRIVACY_CONTACT_UNRESOLVED,
  BREACH_SEVERE_HARM_FACTOR_AID,
  PRIVACY_DPO_READINESS,
  PRIVACY_PROCESSING_ACTIVITIES,
  buildAuthorityBreachNotificationPack,
  buildCustomerBreachNoticeDrafts,
  computeArticle20NotificationDeadlines,
  computeDsrDueAtFromReceivedAt,
  effectiveBreachDiscoveryAt,
  isBreachNotificationActuallySent,
  getLegalIdentityFromEnv,
} from '../src/index.js';

// Re-export constant checked via shared SSOT
const BREACH_AUTO_FLAG = BREACH_AUTOMATIC_AUTHORITY_SUBMISSION_EXISTS;

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

console.log('\nPhase 3C.4B.1.2 Personal Data Breach Readiness QA\n');

const service = src('apps/api/src/services/legal/personal-data-breach.service.ts');
const routes = src('apps/api/src/routes/admin-legal.ts');
const shared = src('packages/shared/src/personal-data-breach.ts');
const schema = src('packages/db/prisma/schema.prisma');
const playbook = src('docs/MAZARE3_PERSONAL_DATA_BREACH_PLAYBOOK_3C4B1_2.md');
const packTpl = src('docs/MAZARE3_BREACH_NOTIFICATION_PACK_TEMPLATE_3C4B1_2.md');
const terms = src('packages/shared/src/legal-content/terms-and-conditions.ts');
const privacyPolicy = src('packages/shared/src/legal-content/privacy-policy.ts');
const identity = getLegalIdentityFromEnv();
const inventory = src('packages/shared/src/privacy-processing-inventory.ts');

// A — security incident without being PDB
expect(
  'A security_incident_only kind exists',
  shared.includes('security_incident_only') && schema.includes('security_incident_only'),
);
expect(
  'A severe harm blocked for non-PDB',
  service.includes('NOT_A_PERSONAL_DATA_BREACH') &&
    service.includes('personal_data_breach'),
);

// B — PDB without severe harm
expect(
  'B default severe harm unassessed',
  schema.includes('unassessed') && shared.includes('unassessed'),
);
expect(
  'B PDB kind distinct',
  shared.includes("'personal_data_breach'"),
);

// C — severe harm => deadlines
{
  const discovered = new Date('2026-09-11T10:00:00.000Z'); // Friday
  const d = computeArticle20NotificationDeadlines(discovered);
  expect(
    'C customer due = +24h',
    d.customerNotificationDueAt.getTime() - discovered.getTime() === 24 * 3600_000,
  );
  expect(
    'C authority due = +72h',
    d.authorityNotificationDueAt.getTime() - discovered.getTime() === 72 * 3600_000,
  );
  expect('C service sets deadlines on severe_harm_likely', service.includes('computeArticle20NotificationDeadlines'));
}

// D — elapsed hours not working days
expect('D BREACH_CUSTOMER_NOTIFICATION_HOURS === 24', BREACH_CUSTOMER_NOTIFICATION_HOURS === 24);
expect('D BREACH_AUTHORITY_NOTIFICATION_HOURS === 72', BREACH_AUTHORITY_NOTIFICATION_HOURS === 72);
expect(
  'D calendar note rejects DSR working days',
  shared.includes('Not a DSR working-day') || shared.includes('NOT DSR'),
);

// E — weekend/holiday does NOT extend Art.20
{
  const fri = new Date('2026-09-11T10:00:00.000Z');
  const art20 = computeArticle20NotificationDeadlines(fri);
  const dsr = computeDsrDueAtFromReceivedAt(fri);
  // Art.20 customer due is exactly +24h (into Saturday) — DSR would skip Fri/Sat
  expect(
    'E Art.20 customer due lands ~24h later (includes weekend hours)',
    art20.customerNotificationDueAt.toISOString() === '2026-09-12T10:00:00.000Z',
  );
  expect(
    'E DSR due is later than Art.20 +24h (working-day calendar differs)',
    dsr.getTime() > art20.customerNotificationDueAt.getTime(),
  );
  expect(
    'E service does not import DSR calendar for Art.20',
    !service.includes('computeDsrDueAtFromReceivedAt') &&
      !service.includes('jordan-privacy-business-calendar'),
  );
}

// F — discoveredAt auditable / not silently rewritten
expect('F initiallyRecordedDiscoveryAt in schema', schema.includes('initiallyRecordedDiscoveryAt'));
expect('F correctedDiscoveryAt separate field', schema.includes('correctedDiscoveryAt'));
expect(
  'F update path notes discoveredAt untouched',
  service.includes('discoveredAt is intentionally absent') ||
    service.includes('discoveredAt + initiallyRecordedDiscoveryAt intentionally untouched'),
);
expect('F discovery audit action', service.includes("breach.discovery_recorded"));

// G — draft != sent
expect(
  'G prepared is not sent',
  !isBreachNotificationActuallySent('prepared') && !isBreachNotificationActuallySent('approved_for_send'),
);
expect('G sent is sent', isBreachNotificationActuallySent('sent') === true);
expect(
  'G prepare sets prepared not sent',
  service.includes('BreachNotificationChannelStatus.prepared') &&
    service.includes('// Draft !== sent'),
);

// H — authority pack prepared != submitted
{
  const pack = buildAuthorityBreachNotificationPack({
    title: 'Synthetic',
    discoveryAtIso: new Date().toISOString(),
    sourceOfBreach: 'qa',
    mechanismOfBreach: 'fixture',
    affectedDataSubjectsSummary: 'customers; count=0',
    affectedDataCategories: ['identity_contact'],
    estimatedAffectedCount: 0,
    containmentRemediationSummary: 'contained in QA',
  });
  expect('H HUMAN_SUBMISSION_REQUIRED', pack.statusEn === 'HUMAN_SUBMISSION_REQUIRED');
  expect(
    'H prepare does not set authoritySubmittedAt',
    service.includes('authorityPackPrepared: true') && service.includes('submitted: false'),
  );
}

// I — no automatic authority submission
expect('I BREACH_AUTOMATIC_AUTHORITY_SUBMISSION_EXISTS false', BREACH_AUTO_FLAG === false);
expect(
  'I service exports false automatic flag',
  service.includes('BREACH_AUTOMATIC_AUTHORITY_SUBMISSION_EXISTS = false') ||
    service.includes('BREACH_AUTOMATIC_AUTHORITY_SUBMISSION_EXISTS'),
);
expect(
  'I no fetch to government portal',
  !service.includes('gov.jo') && !service.includes('ministry') && !routes.includes('submitToUnit'),
);

// J — no real user notification in QA path
expect(
  'J record-sent forbids automaticMassEmail',
  service.includes('automaticMassEmail: false'),
);
expect(
  'J EMAIL_PROVIDER=none blocker surfaced',
  service.includes('EMAIL_PROVIDER=none'),
);

// K — human review required for severe harm
expect(
  'K humanConfirmation required for severe_harm_likely',
  service.includes('humanConfirmation required to mark severe harm likely'),
);

// L — customer notice practical measures
{
  const drafts = buildCustomerBreachNoticeDrafts({
    discoveredAtIso: '2026-09-11T10:00:00.000Z',
    noticeAtIso: '2026-09-11T12:00:00.000Z',
    whatHappenedEn: 'Synthetic exposure of contact records in QA.',
    whatHappenedAr: 'تعرض اصطناعي لسجلات الاتصال في الاختبار.',
    affectedCategoriesEn: 'identity/contact',
    affectedCategoriesAr: 'الهوية/الاتصال',
    likelyConsequencesEn: 'Possible unwanted contact.',
    likelyConsequencesAr: 'احتمال تواصل غير مرغوب.',
    actionsTakenEn: 'Access revoked in QA.',
    actionsTakenAr: 'تم إلغاء الوصول في الاختبار.',
    practicalMeasuresEn: 'Change password; enable alerts; contact support.',
    practicalMeasuresAr: 'غيّر كلمة المرور؛ فعّل التنبيهات؛ تواصل مع الدعم.',
    privacyContactLabelEn: BREACH_PRIVACY_CONTACT_UNRESOLVED.en,
    privacyContactLabelAr: BREACH_PRIVACY_CONTACT_UNRESOLVED.ar,
  });
  expect(
    'L EN includes practical measures',
    drafts.en.body.includes('Practical measures') && drafts.en.body.includes('Change password'),
  );
  expect('L AR includes practical measures section', drafts.ar.body.includes('إجراءات عملية'));
}

// M — authority pack fields
{
  const pack = buildAuthorityBreachNotificationPack({
    title: 'QA',
    discoveryAtIso: '2026-09-11T10:00:00.000Z',
    sourceOfBreach: 'monitoring alert',
    mechanismOfBreach: 'misconfigured ACL',
    affectedDataSubjectsSummary: 'owner_partner; count=3',
    affectedDataCategories: ['kyc', 'payout_iban'],
    estimatedAffectedCount: 3,
    containmentRemediationSummary: 'object made private',
  });
  expect('M has source', !!pack.sourceOfBreach);
  expect('M has mechanism', !!pack.mechanismOfBreach);
  expect('M has affected summary', !!pack.affectedDataSubjectsSummary);
  expect('M has categories', pack.affectedDataCategories.includes('kyc'));
}

// N — financial-sensitive flag
expect(
  'N financial category + auto-flag in create',
  service.includes('involvesFinancialSensitiveData') && shared.includes('financial_sensitive'),
);

// O — KYC high risk flag
expect('O involvesKycData in model', schema.includes('involvesKycData'));
expect(
  'O inventory breach activity high-risk',
  PRIVACY_PROCESSING_ACTIVITIES.some(
    (a) =>
      a.key === 'personal_data_breach_response' &&
      a.sensitiveClassification === 'HIGH_RISK_PERSONAL_DATA_SENSITIVE_POSSIBLE',
  ),
);

// P — encryption recorded but not auto-dismiss
expect(
  'P encryption factor elevatesConcern false but keys true',
  BREACH_SEVERE_HARM_FACTOR_AID.some((f) => f.key === 'encryption_protected' && !f.elevatesConcern) &&
    BREACH_SEVERE_HARM_FACTOR_AID.some((f) => f.key === 'keys_compromised' && f.elevatesConcern),
);
expect(
  'P playbook says encryption does not auto-dismiss',
  playbook.toLowerCase().includes('does not') && playbook.toLowerCase().includes('encrypt'),
);

// Q — no secrets / raw KYC in audit
expect(
  'Q audit never log secrets comment',
  service.includes('Never log secrets') || service.includes('Never store breached'),
);
expect(
  'Q no KYC content fields on model',
  !schema.includes('kycDocumentBytes') && !schema.includes('rawKyc'),
);

// R — admin access restricted as far as RBAC allows
expect('R routes behind requireAdmin', routes.includes('requireAdmin'));
expect(
  'R breach routes under admin legal',
  routes.includes("/breach-incidents"),
);
expect(
  'R access gap documented',
  shared.includes('organisational/access-control gap') ||
    shared.includes('Organisational least-privilege gap') ||
    shared.includes('Ordinary admin role alone is denied') ||
    shared.includes('privacy_breach_* capabilities'),
);

// S — dpoAppointed false
expect('S dpoAppointed false', PRIVACY_DPO_READINESS.dpoAppointed === false);
expect('S identity dpoAppointed false', identity.dpoAppointed === false);

// T — privacy contact not fabricated
expect(
  'T unresolved contact placeholder',
  BREACH_PRIVACY_CONTACT_UNRESOLVED.en.includes('UNRESOLVED'),
);
expect(
  'T inventory/service no fake privacy@mazare3.com in breach module',
  !shared.includes('privacy@mazare3.com') && !service.includes('privacy@mazare3.com'),
);

// U — Privacy Policy unfinalised
expect(
  'U privacy policy DRAFT uses PRIVACY_ADVISOR label (Terms package unchanged)',
  privacyPolicy.includes('PRIVACY_ADVISOR_REVISED_VERSION') ||
    privacyPolicy.includes('1.1.2-advisor-final'),
);

// V — contractual corpus unchanged
expect('V ADVISOR_REVISED_VERSION', ADVISOR_REVISED_VERSION === '1.1.2-advisor-final');
expect('V Terms still advisor version', terms.includes('version: ADVISOR_REVISED_VERSION'));

// Extra
expect('playbook exists', playbook.includes('Article 20'));
expect('pack template HUMAN_SUBMISSION', packTpl.includes('HUMAN_SUBMISSION_REQUIRED'));
expect(
  'BookingIncident not reused',
  !service.includes('prisma.bookingIncident') && !service.includes('BookingIncident.find'),
);
expect(
  'effective discovery helper',
  effectiveBreachDiscoveryAt({
    discoveredAt: new Date('2026-01-01T00:00:00Z'),
    correctedDiscoveryAt: new Date('2025-12-31T00:00:00Z'),
  }).toISOString() === '2025-12-31T00:00:00.000Z',
);
expect(
  'inventory activity present',
  inventory.includes('personal_data_breach_response'),
);
expect('migration present', src('packages/db/prisma/migrations/20260914140000_phase3c4b1_2_personal_data_breach/migration.sql').includes('PersonalDataBreachIncident'));
expect('admin UI panel exists', src('apps/web/src/components/admin/admin-breach-incidents-panel.tsx').includes('admin-legal-breach'));

// Silence unused
void BREACH_AUTO_FLAG;

console.log(`\nPhase 3C.4B.1.2 QA: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
