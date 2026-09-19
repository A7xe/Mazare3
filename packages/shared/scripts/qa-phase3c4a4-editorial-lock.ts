/**
 * Phase 3C.4A.4 — Customer legal editorial lock QA.
 * Run: pnpm qa:phase3c4a4-editorial-lock
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ADVISOR_REVISED_VERSION,
  ADVISOR_REVISED_VERSION_110,
  ADVISOR_REVISED_VERSION_111,
  DEPOSIT_PERCENT,
  FULL_PAYMENT_WITHIN_HOURS,
  BALANCE_DUE_HOURS_BEFORE_START,
  CANCELLATION_FREE_UNTIL_HOURS,
  CANCELLATION_CHARGE_PERCENT_TIER_30,
  CANCELLATION_CHARGE_PERCENT_TIER_50,
  CANCELLATION_CHARGE_PERCENT_TIER_100,
  getLaunchLegalDocument,
  getLaunchLegalMarkdown,
  formatLegalEntityIntroEn,
  getLegalIdentityFromEnv,
  toPlaceholderValues,
  resolveCancellationPolicyHours,
  privacyPolicyLaunchCandidate,
  privacyPolicyAdvisorRevised110,
  privacyPolicyAdvisorRevised111,
  ownerAgreementLaunchCandidate,
  ownerAgreementAdvisorRevised110,
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

console.log('\nPhase 3C.4A.4 Customer Legal Editorial Lock QA\n');

expect('version is 1.1.2-advisor-final', ADVISOR_REVISED_VERSION === '1.1.2-advisor-final');
expect('historical 1.1.0 preserved', ADVISOR_REVISED_VERSION_110 === '1.1.0-advisor-revised');
expect('historical 1.1.1 preserved', ADVISOR_REVISED_VERSION_111 === '1.1.1-advisor-revised');

const terms = getLaunchLegalDocument('terms_and_conditions');
const cancel = getLaunchLegalDocument('cancellation_refund_policy');
const booking = getLaunchLegalDocument('booking_terms');
const privacy = getLaunchLegalDocument('privacy_policy');
const owner = getLaunchLegalDocument('owner_agreement');

expect('Terms on 1.1.2', terms.version === ADVISOR_REVISED_VERSION);
expect('Cancellation on 1.1.2', cancel.version === ADVISOR_REVISED_VERSION);
expect('Booking Terms on 1.1.2', booking.version === ADVISOR_REVISED_VERSION);
expect('Privacy DRAFT 1.1.2-advisor-final (not activated)', privacy.version === '1.1.2-advisor-final');
expect('Owner Agreement active is advisor-final 1.1.1', owner.version === '1.1.1-advisor-final');
expect(
  'Owner Agreement historical 1.1.0 preserved',
  ownerAgreementAdvisorRevised110.version === '1.1.0-advisor-revised',
);
expect(
  'Owner Agreement historical launch-candidate preserved',
  ownerAgreementLaunchCandidate.version.includes('launch-candidate') &&
    ownerAgreementLaunchCandidate.version === '1.0.1-launch-candidate',
);
expect(
  'Privacy historical 1.1.1 corpus frozen separately',
  privacyPolicyAdvisorRevised111.version === '1.1.1-advisor-revised',
);
expect(
  'Privacy historical 1.1.0 corpus frozen separately',
  privacyPolicyAdvisorRevised110.version === '1.1.0-advisor-revised',
);
expect(
  'Privacy historical launch-candidate corpus frozen separately',
  privacyPolicyLaunchCandidate.version.includes('launch-candidate'),
);

const identity = getLegalIdentityFromEnv();
const valuesAr = toPlaceholderValues(identity, 'ar');
const valuesEn = toPlaceholderValues(identity, 'en');
const termsAr = getLaunchLegalMarkdown('terms_and_conditions', 'ar', valuesAr);
const termsEn = getLaunchLegalMarkdown('terms_and_conditions', 'en', valuesEn);
const cancelAr = getLaunchLegalMarkdown('cancellation_refund_policy', 'ar', valuesAr);
const cancelEn = getLaunchLegalMarkdown('cancellation_refund_policy', 'en', valuesEn);
const bookingAr = getLaunchLegalMarkdown('booking_terms', 'ar', valuesAr);
const bookingEn = getLaunchLegalMarkdown('booking_terms', 'en', valuesEn);
const customerAr = termsAr + cancelAr + bookingAr;
const customerEn = termsEn + cancelEn + bookingEn;

// Arabic grammar
expect('no ويُقرأ هذه المستندات', !customerAr.includes('ويُقرأ هذه المستندات'));
expect('uses وتُقرأ هذه المستندات', customerAr.includes('وتُقرأ هذه المستندات'));
expect('no duplicate أهلية heading', !customerAr.includes('الأهلية والأهلية القانونية'));
expect('eligibility heading fixed', termsAr.includes('الأهلية القانونية'));

// Representations
expect('no تمثيلاتها in liability', !termsAr.includes('تمثيلاتها'));
expect('uses إقراراتها', termsAr.includes('إقراراتها'));

// Escrow — not merely "خدمة ضمان"
expect(
  'no ambiguous ليست خدمة ضمان alone',
  !/وليست خدمة ضمان(?!\s*\()/.test(customerAr) && !customerAr.includes('وليست خدمة ضمان.'),
);
expect(
  'escrow clarified as حساب ضمان (Escrow)',
  customerAr.includes('حساب ضمان (Escrow)') ||
    customerAr.includes('خدمة حفظ الأموال في حساب ضمان'),
);
expect('EN still says not an escrow service', /not an escrow service/i.test(customerEn));

// Property / accommodation breadth
expect('no مكان إقامة in customer AR defs', !customerAr.includes('مكان إقامة'));
expect('no خدمة الإقامة في العقار', !customerAr.includes('خدمة الإقامة في العقار'));
expect(
  'broad Property AR definition',
  termsAr.includes('موقع/عقار آخر معروض للحجز') || termsAr.includes('مزرعة أو شاليه'),
);
expect(
  'broad service AR wording',
  customerAr.includes('الخدمة المتعلقة باستخدام العقار المحجوز'),
);

// Refund Due precision (EN)
expect(
  'no Customer receives a 100% refund phrasing',
  !/Customer receives a 100% refund/i.test(customerEn) &&
    !/you receive a 100% refund/i.test(customerEn),
);
expect(
  'entitled to 100% refund of eligible',
  /entitled to a 100% refund of eligible/i.test(customerEn),
);
expect(
  'Refund Due until payment processing confirms',
  /Refund Due until payment processing confirms completion/i.test(customerEn),
);
expect('AR retains يستحق approach', /يستحق/.test(customerAr));

// Reschedule anchor — earlier of
expect(
  'EN earlier of original/new start',
  /earlier of the original Booking start and the new Booking start/i.test(customerEn),
);
expect('no more restrictive public wording', !/more restrictive of the original/i.test(customerEn));
expect(
  'AR الأسبق من موعد بداية',
  customerAr.includes('الأسبق من موعد بداية الحجز الأصلي وموعد البداية الجديد'),
);
{
  const now = new Date('2026-06-01T12:00:00+03:00');
  const original = new Date('2026-06-02T12:00:00+03:00');
  const movedFar = new Date('2026-07-01T12:00:00+03:00');
  const hours = resolveCancellationPolicyHours({
    currentBookingStartAt: movedFar,
    originalBookingStartAt: original,
    applyRescheduleAnchor: true,
    now,
  });
  const hoursOriginalOnly = resolveCancellationPolicyHours({
    currentBookingStartAt: original,
    applyRescheduleAnchor: false,
    now,
  });
  expect(
    'backend earlier-anchor = Math.min (matches legal earlier-of)',
    hours === hoursOriginalOnly && hours < 48,
  );
  expect(
    'policy JSDoc says earlier of',
    src('packages/shared/src/marketplace-financial-policy.ts').includes(
      'the earlier of the original Booking start and the new Booking start',
    ),
  );
}

// Force majeure economics unchanged
expect(
  'FM full refund entitlement EN',
  /entitled to a full refund of eligible captured Booking payments/i.test(customerEn),
);
expect(
  'FM not imposed without agreement',
  /not imposed instead of that refund without/i.test(customerEn),
);
expect('FM Owner penalty 0', /Owner penalty\s*=\s*0|Owner penalty remains zero/i.test(customerEn));
expect(
  'FM AR clearer تعذر wording',
  customerAr.includes('يجعل تنفيذ الحجز متعذراً بصورة موضوعية'),
);
expect('FM AR no مستحيلاً موضوعياً', !customerAr.includes('مستحيلاً موضوعياً'));

// Legal entity EN intro
{
  const intro = formatLegalEntityIntroEn(identity);
  expect('intro no (llc)', !/\(llc\)/i.test(intro));
  expect(
    'intro preferred form',
    intro.startsWith('BATMAN TECHNOLOGY, a limited liability company registered') &&
      intro.includes('62272'),
  );
  expect(
    'SSOT legalFormEn still has LLC acronym field',
    identity.legalFormEn === 'Limited Liability Company (LLC)',
  );
}

// Economics unchanged
expect('Deposit 30%', DEPOSIT_PERCENT === 30);
expect('Full payment within 72h', FULL_PAYMENT_WITHIN_HOURS === 72);
expect('Balance -48h', BALANCE_DUE_HOURS_BEFORE_START === 48);
expect('free cancel >72', CANCELLATION_FREE_UNTIL_HOURS === 72);
expect('tier 30%', CANCELLATION_CHARGE_PERCENT_TIER_30 === 30);
expect('tier 50%', CANCELLATION_CHARGE_PERCENT_TIER_50 === 50);
expect('tier 100%', CANCELLATION_CHARGE_PERCENT_TIER_100 === 100);
expect('EN still has >72 free cancel', customerEn.includes(`${CANCELLATION_FREE_UNTIL_HOURS}`));

// No acceptances / activation in seed
expect(
  'seed remains DRAFT status',
  src('packages/db/prisma/seed-legal-advisor-revised.ts').includes('LegalDocumentStatus.draft'),
);
expect(
  'seed does not create acceptances',
  src('packages/db/prisma/seed-legal-advisor-revised.ts').includes('Does NOT create acceptances'),
);
expect(
  'seed aborts on APP_ENV=production',
  src('packages/db/prisma/seed-legal-advisor-revised.ts').includes("APP_ENV=production"),
);

console.log(`\nPhase 3C.4A.4 QA: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
