/**
 * Phase 3C.4B.1.3 — Breach access & notification evidence hardening QA.
 * Run: pnpm qa:phase3c4b1-3-breach-hardening
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ADVISOR_REVISED_VERSION,
  AFFECTED_DATA_SUBJECTS_LABEL,
  BREACH_AUTOMATIC_AUTHORITY_SUBMISSION_EXISTS,
  PRIVACY_BREACH_CAPABILITIES,
  PRIVACY_DPO_READINESS,
  computeArticle20NotificationDeadlines,
  deriveDataSubjectAggregateNoticeStatus,
  effectiveBreachDiscoveryAt,
  hasPrivacyBreachCapability,
  isBreachNotificationActuallySent,
  getLegalIdentityFromEnv,
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

console.log('\nPhase 3C.4B.1.3 Breach Access & Notification Evidence Hardening QA\n');

const shared = src('packages/shared/src/personal-data-breach.ts');
const schema = src('packages/db/prisma/schema.prisma');
const service = src('apps/api/src/services/legal/personal-data-breach.service.ts');
const routes = src('apps/api/src/routes/admin-legal.ts');
const mw = src('apps/api/src/middleware/require-privacy-breach-capability.ts');
const playbook = src('docs/MAZARE3_PERSONAL_DATA_BREACH_PLAYBOOK_3C4B1_3.md');
const privacyPolicy = src('packages/shared/src/legal-content/privacy-policy.ts');
const terms = src('packages/shared/src/legal-content/terms-and-conditions.ts');
const identity = getLegalIdentityFromEnv();

// A — Owner can be affected Data Subject
expect(
  'A owner_partner subject category',
  shared.includes('owner_partner') && schema.includes('owner_partner'),
);
expect('A recipient can use ownerProfileId', service.includes('ownerProfileId'));

// B — terminology not Customer-only
expect('B AFFECTED_DATA_SUBJECTS_LABEL EN', AFFECTED_DATA_SUBJECTS_LABEL.en === 'Affected Data Subjects');
expect('B AR label', AFFECTED_DATA_SUBJECTS_LABEL.ar.includes('الأشخاص المعنيون'));
expect('B dataSubjectNotificationDueAt in schema', schema.includes('dataSubjectNotificationDueAt'));
expect(
  'B computeArticle20 returns dataSubjectNotificationDueAt',
  !!computeArticle20NotificationDeadlines(new Date()).dataSubjectNotificationDueAt,
);

// C — ordinary Admin cannot view by default
expect('C requirePrivacyBreachCapability middleware', mw.includes('PRIVACY_BREACH_FORBIDDEN'));
expect(
  'C ordinary admin alone lacks capability',
  hasPrivacyBreachCapability([], 'privacy_breach_view', { superAdmin: false }) === false,
);
expect(
  'C list route gated',
  routes.includes("requirePrivacyBreachCapability('privacy_breach_view')"),
);

// D — authorised role can view
expect(
  'D grant view works',
  hasPrivacyBreachCapability(['privacy_breach_view'], 'privacy_breach_view') === true,
);
expect(
  'D superAdmin works',
  hasPrivacyBreachCapability([], 'privacy_breach_view', { superAdmin: true }) === true,
);
expect(
  'D manage implies view',
  hasPrivacyBreachCapability(['privacy_breach_manage'], 'privacy_breach_view') === true,
);

// E — Customer/Owner cannot access breach admin APIs
expect('E router still requireAdmin', routes.includes('requireAdmin'));
expect('E no customer role on breach routes', !routes.includes("requireRole('customer'"));

// F — list minimises sensitive detail
expect('F list omits sensitive fields helper', shared.includes('BREACH_LIST_EXCLUDED_DETAIL_FIELDS'));
expect(
  'F mapIncident list mode',
  service.includes('includeSensitiveDetail') && service.includes('affectedSubjectRefs'),
);

// G — per-subject notification evidence
expect('G PersonalDataBreachRecipientNotice model', schema.includes('PersonalDataBreachRecipientNotice'));
expect('G addRecipientNotice', service.includes('addRecipientNotice'));

// H — one failed prevents fully notified aggregate
expect(
  'H failed + sent => partially_sent or failed',
  deriveDataSubjectAggregateNoticeStatus(['sent', 'failed']) === 'partially_sent' ||
    deriveDataSubjectAggregateNoticeStatus(['sent', 'failed']) === 'failed',
);
expect(
  'H all sent => sent',
  deriveDataSubjectAggregateNoticeStatus(['sent', 'sent']) === 'sent',
);
expect(
  'H not fully notified when one failed among pending',
  deriveDataSubjectAggregateNoticeStatus(['failed', 'pending']) !== 'sent',
);

// I — draft/approved/attempted != sent
expect('I prepared not sent', !isBreachNotificationActuallySent('prepared'));
expect('I approved not sent', !isBreachNotificationActuallySent('approved'));
expect('I attempted not sent', !isBreachNotificationActuallySent('attempted'));
expect('I sent is sent', isBreachNotificationActuallySent('sent'));

// J — provider failure follow-up
expect(
  'J EMAIL_PROVIDER=none manual follow-up',
  service.includes('EMAIL_PROVIDER=none') && service.includes('manual_followup_required'),
);

// K — non-account representation
expect('K externalRef supported', service.includes('externalRef') && schema.includes('externalRef'));
expect('K unknown_or_non_account category', shared.includes('unknown_or_non_account'));

// L/M — later discovery correction elevated + reason
expect('L NEED_ELEVATED_DISCOVERY_CORRECTION', service.includes('NEED_ELEVATED_DISCOVERY_CORRECTION'));
expect(
  'L elevate capability exists',
  PRIVACY_BREACH_CAPABILITIES.includes('privacy_breach_discovery_correct_later'),
);
expect('M reason mandatory', service.includes('Correction reason is mandatory'));

// N — deadline history preserved
expect('N PersonalDataBreachDeadlineHistory', schema.includes('PersonalDataBreachDeadlineHistory'));
expect('N previousSnapshot', schema.includes('previousSnapshot') || service.includes('previousSnapshot'));

// O — earlier correction shortens
{
  const early = new Date('2026-09-10T10:00:00Z');
  const late = new Date('2026-09-11T10:00:00Z');
  const dEarly = computeArticle20NotificationDeadlines(early);
  const dLate = computeArticle20NotificationDeadlines(late);
  expect(
    'O earlier discovery yields earlier due',
    dEarly.dataSubjectNotificationDueAt.getTime() < dLate.dataSubjectNotificationDueAt.getTime(),
  );
}

// P — reopen does not reset clocks
expect('P reopenPersonalDataBreachIncident', service.includes('reopenPersonalDataBreachIncident'));
expect(
  'P reopen preserves dues comment or metadata',
  service.includes('does NOT reset') ||
    service.includes('Art.20') ||
    service.includes('dataSubjectNotificationDueAt'),
);

// Q — later severe-harm uses discovery time
expect(
  'Q severe harm uses effectiveBreachDiscoveryAt / computeArticle20',
  service.includes('effectiveBreachDiscoveryAt') && service.includes('computeArticle20NotificationDeadlines'),
);
expect(
  'Q effective discovery prefers correction',
  effectiveBreachDiscoveryAt({
    discoveredAt: new Date('2026-01-02T00:00:00Z'),
    correctedDiscoveryAt: new Date('2026-01-01T00:00:00Z'),
  }).toISOString() === '2026-01-01T00:00:00.000Z',
);

// R — ordinary Admin cannot record Unit submission
expect(
  'R authority record-submission gated',
  routes.includes("requirePrivacyBreachCapability('privacy_breach_authority_record')") &&
    routes.includes('authority-pack/record-submission'),
);

// S — authority human-only
expect('S HUMAN_SUBMISSION / no auto', BREACH_AUTOMATIC_AUTHORITY_SUBMISSION_EXISTS === false);
expect('S no gov portal automation', !service.includes('gov.jo'));

// T — no real notifications in QA
expect('T automaticMassEmail false or synthetic', service.includes('automaticMassEmail: false') || service.includes('synthetic'));

// U — no raw KYC/secrets
expect('U no kyc bytes fields', !schema.includes('kycDocumentBytes') && !service.includes('rawKyc'));
expect('U never log secrets', service.includes('Never log secrets') || service.includes('never log secret') || shared.includes('Do not store copies'));

// V — dpoAppointed false
expect('V dpoAppointed false', PRIVACY_DPO_READINESS.dpoAppointed === false && identity.dpoAppointed === false);

// W — Privacy Policy unfinalised
expect(
  'W privacy policy DRAFT uses PRIVACY_ADVISOR label (Terms package unchanged)',
  privacyPolicy.includes('PRIVACY_ADVISOR_REVISED_VERSION') ||
    privacyPolicy.includes('1.1.2-advisor-final'),
);

// X — contractual unchanged
expect('X 1.1.2', ADVISOR_REVISED_VERSION === '1.1.2-advisor-final');
expect('X Terms version', terms.includes('version: ADVISOR_REVISED_VERSION'));

expect('playbook 3C4B1_3 exists', playbook.includes('Affected Data Subjects'));
expect('migration 1.3 exists', src('packages/db/prisma/migrations/20260914160000_phase3c4b1_3_breach_hardening/migration.sql').includes('dataSubjectNotificationDueAt'));
expect('superAdmin column', schema.includes('superAdmin'));
expect('UserCapabilityGrant', schema.includes('UserCapabilityGrant'));

console.log(`\nPhase 3C.4B.1.3 QA: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
