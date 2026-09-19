/**
 * Phase 3C.4B.1.1 — Jordan PDPL mapping & DSR hardening QA.
 * Run: pnpm qa:phase3c4b1-1-pdpl-mapping
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ADVISOR_REVISED_VERSION,
  DATA_SUBJECT_REQUEST_TYPES,
  PRIVACY_DPO_READINESS,
  PRIVACY_PROCESSING_ACTIVITIES,
  PRIVACY_PROCESSORS,
  JORDAN_DSR_RIGHTS_INVENTORY,
  JORDAN_PRIVACY_OFFICIAL_NON_WORKING_DATES,
  computeDsrDeadlineFromReceivedAt,
  computeDsrDueAtFromReceivedAt,
  isJordanPrivacyWorkingDay,
  canRevealExactLocation,
  getLegalIdentityFromEnv,
} from '../src/index.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
let passed = 0;
let failed = 0;
let criticalSecurity = false;

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
function activity(key: string) {
  return PRIVACY_PROCESSING_ACTIVITIES.find((a) => a.key === key);
}

console.log('\nPhase 3C.4B.1.1 Jordan PDPL Mapping & DSR Hardening QA\n');

const schema = src('packages/db/prisma/schema.prisma');
const inventory = src('packages/shared/src/privacy-processing-inventory.ts');
const calendar = src('packages/shared/src/jordan-privacy-business-calendar.ts');
const dsrService = src('apps/api/src/services/legal/data-subject-request.service.ts');
const partnerOnboarding = src('apps/api/src/services/partner-onboarding.service.ts');
const partnerAdmin = src('apps/api/src/services/partner-admin.service.ts');
const ownerRoutes = src('apps/api/src/routes/owner.ts');
const adminRoutes = src('apps/api/src/routes/admin.ts');
const kycStorage = src('apps/api/src/config/partner-document-storage.config.ts');
const partnerCrypto = src('apps/api/src/lib/partner-crypto.ts');
const terms = src('packages/shared/src/legal-content/terms-and-conditions.ts');
const privacyPolicy = src('packages/shared/src/legal-content/privacy-policy.ts');
const identity = getLegalIdentityFromEnv();

// A — IBAN/bank financial-sensitive
const payout = activity('owner_payout_iban');
expect(
  'A IBAN classified SENSITIVE_PERSONAL_DATA_FINANCIAL',
  payout?.sensitiveClassification === 'SENSITIVE_PERSONAL_DATA_FINANCIAL',
);
expect('A IBAN financialData true', payout?.financialData === true);
expect('A IBAN sensitivePossible true', payout?.sensitivePersonalDataPossible === true);

// B — payment financial metadata
const payment = activity('payment_metadata');
const savedToken = activity('saved_payment_token_metadata');
expect(
  'B payment_metadata SENSITIVE_PERSONAL_DATA_FINANCIAL',
  payment?.sensitiveClassification === 'SENSITIVE_PERSONAL_DATA_FINANCIAL',
);
expect(
  'B saved token metadata SENSITIVE_PERSONAL_DATA_FINANCIAL',
  savedToken?.sensitiveClassification === 'SENSITIVE_PERSONAL_DATA_FINANCIAL',
);
expect(
  'B booking amounts SENSITIVE_PERSONAL_DATA_FINANCIAL',
  activity('customer_booking')?.sensitiveClassification === 'SENSITIVE_PERSONAL_DATA_FINANCIAL',
);

// C — PAN/CVV not stored
expect('C no pan String column', !/^\s*pan\s+String/m.test(schema));
expect('C no cvv String column', !schema.includes('cvv String') && !/^\s*cvv\s+/im.test(schema));
expect('C providerTokenCipher present (token not PAN)', schema.includes('providerTokenCipher'));
expect(
  'C inventory denies PAN/CVV held by Mazare3',
  inventory.includes('PAN/CVV not stored') || inventory.includes('never store PAN/CVV'),
);

// D — KYC high-risk / sensitive-possible (not blanket always sensitive)
const kyc = activity('owner_kyc_documents');
expect(
  'D KYC HIGH_RISK_PERSONAL_DATA_SENSITIVE_POSSIBLE',
  kyc?.sensitiveClassification === 'HIGH_RISK_PERSONAL_DATA_SENSITIVE_POSSIBLE',
);
expect(
  'D KYC notes not blanket always sensitive',
  (kyc?.legalReviewNotes ?? '').includes('depending on document contents') ||
    inventory.includes('depending on document contents'),
);
expect('D KYC RESTRICT_ACCESS', kyc?.minimisation === 'RESTRICT_ACCESS');
expect('D KYC DPIA required', kyc?.dpiaStatus === 'DPIA_REQUIRED_LEGAL_REVIEW');

// E — free text sensitive possible
expect(
  'E support/disputes SENSITIVE_DATA_POSSIBLE',
  activity('reviews_support_disputes')?.sensitiveClassification === 'SENSITIVE_DATA_POSSIBLE',
);
expect(
  'E DSR free text SENSITIVE_DATA_POSSIBLE',
  activity('data_subject_requests')?.sensitiveClassification === 'SENSITIVE_DATA_POSSIBLE',
);
expect(
  'E free-text minimisation MINIMISE',
  activity('reviews_support_disputes')?.minimisation === 'MINIMISE',
);

// F — dpoAppointed false
expect('F dpoAppointed false readiness', PRIVACY_DPO_READINESS.dpoAppointed === false);
expect('F identity dpoAppointed false', identity.dpoAppointed === false);

// G — candidate not publicly appointed
expect('G INTERNAL_DPO_CANDIDATE', PRIVACY_DPO_READINESS.candidateLabel === 'INTERNAL_DPO_CANDIDATE');
expect('G public contact NOT_PUBLISHED', PRIVACY_DPO_READINESS.publicDpoContact === 'NOT_PUBLISHED');
expect('G appointment NOT_FORMALLY_RECORDED', PRIVACY_DPO_READINESS.appointmentStatus === 'NOT_FORMALLY_RECORDED');

// H — DPO appointment Production requirement
expect(
  'H DPO_APPOINTMENT_REQUIRED_PENDING_FORMALISATION',
  PRIVACY_DPO_READINESS.appointmentRequirementStatus ===
    'DPO_APPOINTMENT_REQUIRED_PENDING_FORMALISATION',
);
expect('H productionBlocker true', PRIVACY_DPO_READINESS.productionBlocker === true);

// I — accreditation scope check
expect(
  'I accreditation REQUIRES_SCOPE_CHECK',
  PRIVACY_DPO_READINESS.accreditationApplicability === 'REQUIRES_SCOPE_CHECK',
);
expect(
  'I ICT listed but entity-specific pending',
  PRIVACY_DPO_READINESS.accreditationNotesEn.includes('REQUIRES_SCOPE_CHECK') &&
    PRIVACY_DPO_READINESS.accreditationNotesEn.includes('ICT'),
);
expect(
  'I does not auto-qualify BATMAN as critical infra',
  PRIVACY_DPO_READINESS.accreditationNotesEn.includes('does NOT mean'),
);

// J — access includes copy
const accessRight = JORDAN_DSR_RIGHTS_INVENTORY.find((r) => r.rightKey === 'access');
expect('J access includesObtainingCopy', accessRight?.includesObtainingCopy === true);
expect(
  'J access name mentions copy',
  (accessRight?.nameEn ?? '').toLowerCase().includes('copy'),
);
expect(
  'J no unresolved standalone copy LEGAL_REVIEW mapping',
  !JORDAN_DSR_RIGHTS_INVENTORY.some((r) => r.rightKey === 'copy'),
);

// K — portability separate
const portability = JORDAN_DSR_RIGHTS_INVENTORY.find((r) => r.rightKey === 'portability');
expect('K portability present', !!portability);
expect(
  'K portability separate concept',
  (portability?.nameEn ?? '').toLowerCase().includes('separate'),
);

// L — privacy complaint
expect('L privacy_complaint type', DATA_SUBJECT_REQUEST_TYPES.includes('privacy_complaint'));
expect('L schema privacy_complaint', schema.includes('privacy_complaint'));
expect(
  'L rights inventory privacy_complaint',
  JORDAN_DSR_RIGHTS_INVENTORY.some((r) => r.rightKey === 'privacy_complaint'),
);
expect(
  'L AR complaint label in messages',
  src('apps/web/messages/ar.json').includes('شكوى تتعلق بحماية البيانات الشخصية'),
);
expect(
  'L EN complaint label',
  src('apps/web/messages/en.json').includes('Personal data / privacy complaint'),
);
expect('L inquiry remains distinct', DATA_SUBJECT_REQUEST_TYPES.includes('privacy_inquiry'));

// M — 15 working days from day after receipt
{
  const received = new Date('2026-09-10T10:00:00+03:00'); // Thu
  const deadline = computeDsrDeadlineFromReceivedAt(received, {
    officialNonWorkingDates: [],
  });
  // Day after = Fri 11 (skip) Sat 12 (skip) Sun 13 = working day 1 ...
  expect('M due after received', deadline.dueAt.getTime() > received.getTime());
  expect('M counted 15 working days', deadline.workingDaysCounted === 15);
  // First working day after Thu receipt is Sun 13 Sep 2026
  expect(
    'M starts counting after receipt (not on receipt day)',
    deadline.dueYmdAmman !== '2026-09-10',
  );
}

// N — Fri/Sat excluded
expect('N Fri not working', isJordanPrivacyWorkingDay('2026-09-11', []) === false);
expect('N Sat not working', isJordanPrivacyWorkingDay('2026-09-12', []) === false);
expect('N Sun working', isJordanPrivacyWorkingDay('2026-09-13', []) === true);

// O — configured official holiday excluded
{
  const received = new Date('2026-09-10T10:00:00+03:00');
  const withHoliday = computeDsrDeadlineFromReceivedAt(received, {
    officialNonWorkingDates: ['2026-09-13'], // would-be first working day
  });
  const without = computeDsrDeadlineFromReceivedAt(received, {
    officialNonWorkingDates: [],
  });
  expect(
    'O holiday pushes due later',
    withHoliday.dueAt.getTime() > without.dueAt.getTime(),
  );
  expect('O holiday day not working', isJordanPrivacyWorkingDay('2026-09-13', ['2026-09-13']) === false);
}

// P — empty holiday calendar does not claim perfect calculation
expect(
  'P default holiday list empty (no invented dates)',
  JORDAN_PRIVACY_OFFICIAL_NON_WORKING_DATES.length === 0,
);
{
  const d = computeDsrDeadlineFromReceivedAt(new Date('2026-09-10T10:00:00+03:00'));
  expect(
    'P HOLIDAY_CALENDAR_VERIFICATION_REQUIRED when empty',
    d.holidayCalendarStatus === 'HOLIDAY_CALENDAR_VERIFICATION_REQUIRED',
  );
  expect('P holidayCalendarVerified false', d.holidayCalendarVerified === false);
}
expect(
  'P DSR service surfaces holiday status',
  dsrService.includes('HOLIDAY_CALENDAR_VERIFICATION_REQUIRED'),
);
expect('P DUE_SOON classifier exists', calendar.includes('DUE_SOON'));
expect(
  'P admin surfaces holiday verify / due soon',
  src('apps/web/src/components/admin/admin-legal-console-view.tsx').includes(
    'dsrHolidayCalendarVerify',
  ) &&
    src('apps/web/src/components/admin/admin-legal-console-view.tsx').includes('DUE_SOON'),
);

// Q — processor roles not guessed
expect(
  'Q no "likely processor" speculation',
  !inventory.toLowerCase().includes('likely processor') &&
    !inventory.toLowerCase().includes('often independent controller'),
);
expect(
  'Q processors use neutral role statuses',
  PRIVACY_PROCESSORS.every((p) =>
    [
      'ROLE_REQUIRES_CONTRACT_REVIEW',
      'PROCESSOR_ROLE_PENDING',
      'INDEPENDENT_CONTROLLER_ROLE_PENDING',
      'CONTROLLER_ROLE_PENDING',
    ].includes(p.contractualRoleStatus),
  ),
);
expect(
  'Q Google OAuth role pending not asserted',
  PRIVACY_PROCESSORS.some(
    (p) =>
      p.key === 'google_oauth' &&
      p.contractualRoleStatus === 'INDEPENDENT_CONTROLLER_ROLE_PENDING',
  ),
);

// R — KYC authorization isolation (static auth QA)
const ownerFileRoute =
  ownerRoutes.includes("'/onboarding/documents/:id/file'") &&
  ownerRoutes.includes('getOwnerAccessibleDocument');
const ownerScoped =
  partnerOnboarding.includes('getOwnerAccessibleDocument') &&
  partnerOnboarding.includes('ownerProfileId: profile.id') &&
  partnerOnboarding.includes('id: documentId');
const adminFileRoute =
  adminRoutes.includes("'/partners/:id/documents/:documentId/file'") &&
  adminRoutes.includes('streamAdminPartnerDocument');
const adminRouterGated = adminRoutes.includes('requireAdmin');
const adminDocScoped =
  partnerAdmin.includes('streamAdminPartnerDocument') &&
  partnerAdmin.includes('ownerProfileId: params.ownerProfileId') &&
  partnerAdmin.includes('id: params.documentId');
const privateNoPublicUrl =
  (kycStorage.includes('cloudflare_r2_private') || kycStorage.includes('s3_private')) &&
  !ownerRoutes.includes('getSignedUrl') &&
  ownerRoutes.includes("Cache-Control', 'private, no-store");

expect('R Owner KYC file uses owner-scoped lookup', ownerFileRoute && ownerScoped);
expect('R Admin KYC file on admin router', adminFileRoute && adminRouterGated);
expect('R Admin stream scoped to ownerProfileId+documentId', adminDocScoped);
expect('R private storage / no-store / no signed URL in owner file route', privateNoPublicUrl);

// Customer cannot use owner/admin KYC routes — routes are under /owner and /admin
expect(
  'R KYC file routes not on public/me customer paths',
  !src('apps/api/src/routes/me.ts').includes('documents/:id/file') &&
    !src('apps/api/src/routes/me.ts').includes('streamAdminPartnerDocument'),
);

if (!(ownerScoped && adminDocScoped && adminRouterGated)) {
  criticalSecurity = true;
  console.log('  🛑 CRITICAL: KYC authorization isolation check failed — stop before broadening scope');
}

// S — exact location authorization
expect(
  'S public unpaid cannot reveal',
  canRevealExactLocation({ status: 'confirmed', paymentState: 'unpaid' }) === false,
);
expect(
  'S deposit_pending cannot reveal',
  canRevealExactLocation({ status: 'confirmed', paymentState: 'deposit_pending' }) === false,
);
expect(
  'S pending booking cannot reveal',
  canRevealExactLocation({ status: 'pending', paymentState: 'deposit_paid' }) === false,
);
expect(
  'S confirmed + deposit_paid can reveal',
  canRevealExactLocation({ status: 'confirmed', paymentState: 'deposit_paid' }) === true,
);
expect(
  'S public booking mapper uses canRevealExactLocation',
  src('apps/api/src/mappers/public-booking.mapper.ts').includes('canRevealExactLocation'),
);

// T — contractual 1.1.2 unchanged
expect('T ADVISOR_REVISED_VERSION 1.1.2-advisor-final', ADVISOR_REVISED_VERSION === '1.1.2-advisor-final');
expect(
  'T Terms still on advisor-final',
  terms.includes('ADVISOR_REVISED_VERSION') && terms.includes('version: ADVISOR_REVISED_VERSION'),
);
expect(
  'T Privacy Policy is separate privacy_policy DRAFT label (Terms corpus unchanged)',
  privacyPolicy.includes('PRIVACY_ADVISOR_REVISED_VERSION') &&
    terms.includes("documentType: 'terms_and_conditions'") &&
    terms.includes('version: ADVISOR_REVISED_VERSION'),
);

// Extra inventory completeness
expect(
  'listing media activity present',
  !!activity('public_listing_media'),
);
expect(
  'transactional notifications activity present',
  !!activity('transactional_notifications'),
);
expect('legal acceptance evidence activity present', !!activity('legal_acceptance_evidence'));
expect('auth google oauth activity present', !!activity('authentication_google_oauth'));
expect('IBAN encryption helper present', partnerCrypto.includes('encryptPartnerField'));
expect('docs 3C4B1_1 data map exists', src('docs/MAZARE3_PRIVACY_DATA_MAP_3C4B1_1.md').length > 100);
expect(
  'docs 3C4B1_1 register exists',
  src('docs/MAZARE3_PROCESSING_REGISTER_DRAFT_3C4B1_1.md').length > 50,
);
expect(
  'BC computeDsrDueAtFromReceivedAt still Date',
  computeDsrDueAtFromReceivedAt(new Date('2026-09-10T10:00:00+03:00')) instanceof Date,
);

console.log(`\nPhase 3C.4B.1.1 QA: ${passed} passed, ${failed} failed`);
if (criticalSecurity) {
  console.log('CRITICAL_SECURITY_FINDING=true');
  process.exit(2);
}
process.exit(failed > 0 ? 1 : 0);
