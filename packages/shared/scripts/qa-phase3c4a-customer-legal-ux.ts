/**
 * Phase 3C.4A — Customer legal UX hardening QA.
 * Run: pnpm qa:phase3c4a-customer-legal-ux
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ADVISOR_REVISED_VERSION,
  LAUNCH_CANDIDATE_VERSION,
  assertLegalIdentityReadyForProduction,
  getLaunchLegalDocument,
  getLaunchLegalMarkdown,
  getLegalIdentityFromEnv,
  listFounderInputRequired,
  preparePublicLegalText,
  toPlaceholderValues,
  toPublicLegalDocument,
  DEPOSIT_PERCENT,
  FULL_PAYMENT_WITHIN_HOURS,
  BALANCE_DUE_HOURS_BEFORE_START,
  CANCELLATION_FREE_UNTIL_HOURS,
  CANCELLATION_CHARGE_30_UNTIL_HOURS,
  CANCELLATION_CHARGE_50_UNTIL_HOURS,
  CANCELLATION_CHARGE_PERCENT_TIER_30,
  CANCELLATION_CHARGE_PERCENT_TIER_50,
  CANCELLATION_CHARGE_PERCENT_TIER_100,
  resolveCancellationChargePercent,
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

console.log('\nPhase 3C.4A Customer Legal UX Hardening QA\n');

const terms = getLaunchLegalDocument('terms_and_conditions');
const cancel = getLaunchLegalDocument('cancellation_refund_policy');
const booking = getLaunchLegalDocument('booking_terms');
const identity = getLegalIdentityFromEnv();
const valuesEn = toPlaceholderValues(identity, 'en');
const valuesAr = toPlaceholderValues(identity, 'ar');

const publicTermsEn = toPublicLegalDocument(terms, 'en', valuesEn)!;
const publicTermsAr = toPublicLegalDocument(terms, 'ar', valuesAr)!;
const publicCancelEn = toPublicLegalDocument(cancel, 'en', valuesEn)!;
const publicCancelAr = toPublicLegalDocument(cancel, 'ar', valuesAr)!;
const publicBookingEn = toPublicLegalDocument(booking, 'en', valuesEn)!;
const publicBookingAr = toPublicLegalDocument(booking, 'ar', valuesAr)!;

function flatten(doc: typeof publicTermsEn): string {
  return [
    doc.title,
    doc.intro,
    ...doc.sections.flatMap((s) => [s.title, ...s.paragraphs, ...(s.bullets ?? [])]),
  ].join('\n');
}

const pubEn = [flatten(publicTermsEn), flatten(publicCancelEn), flatten(publicBookingEn)].join(
  '\n',
);
const pubAr = [flatten(publicTermsAr), flatten(publicCancelAr), flatten(publicBookingAr)].join(
  '\n',
);
const rawMd = [
  getLaunchLegalMarkdown('terms_and_conditions', 'en'),
  getLaunchLegalMarkdown('terms_and_conditions', 'ar'),
  getLaunchLegalMarkdown('cancellation_refund_policy', 'en'),
  getLaunchLegalMarkdown('cancellation_refund_policy', 'ar'),
  getLaunchLegalMarkdown('booking_terms', 'en'),
  getLaunchLegalMarkdown('booking_terms', 'ar'),
].join('\n');

expect('version advisor-revised for Terms', terms.version === ADVISOR_REVISED_VERSION);
expect('version advisor-revised for Cancellation', cancel.version === ADVISOR_REVISED_VERSION);
expect('version advisor-revised for Booking Terms', booking.version === ADVISOR_REVISED_VERSION);
expect(
  '1.0.1 constant preserved for other docs',
  LAUNCH_CANDIDATE_VERSION === '1.0.1-launch-candidate',
);

// A–C acceptance
expect(
  'A Terms reject browsing-as-acceptance',
  /does not constitute acceptance/i.test(flatten(publicTermsEn)) &&
    /التصفح|لا يُعدّ قبولاً|لا يشكل قبولاً|لا يُعد قبولاً/i.test(flatten(publicTermsAr)),
);
expect(
  'B explicit electronic acceptance',
  /explicit electronic acceptance/i.test(flatten(publicTermsEn)) &&
    /القبول الإلكتروني/.test(flatten(publicTermsAr)),
);
expect(
  'C reacceptance not by continued use alone',
  /not by browsing or continued use alone/i.test(flatten(publicTermsEn)),
);

// D financial definitions
expect(
  'D Captured Amount defined separately',
  /“Captured Amount” means money successfully collected/i.test(flatten(publicTermsEn)),
);
expect(
  'D Refunded Amount defined separately',
  /“Refunded Amount” means money whose refund has successfully completed/i.test(
    flatten(publicTermsEn),
  ),
);
expect(
  'D Net Collected Amount defined',
  /“Net Collected Amount”/i.test(flatten(publicTermsEn)),
);

// E–H jargon
for (const [label, needle] of [
  ['E merchant booking value', 'merchant booking value'],
  ['F platform_verified', 'platform_verified'],
  ['G durable refund', 'durable refund'],
  ['H snapshotted commission', 'snapshotted commission'],
] as const) {
  expect(label, !pubEn.toLowerCase().includes(needle.toLowerCase()));
}

// I–M cancel boundaries + SSOT resolver
expect(
  'I exact cancel boundaries EN',
  pubEn.includes(`More than ${CANCELLATION_FREE_UNTIL_HOURS} hours`) &&
    pubEn.includes(`More than ${CANCELLATION_CHARGE_30_UNTIL_HOURS} hours and up to`) &&
    pubEn.includes(`More than ${CANCELLATION_CHARGE_50_UNTIL_HOURS} hours and up to`) &&
    pubEn.includes(`${CANCELLATION_CHARGE_50_UNTIL_HOURS} hours or less`),
);
expect(
  'I exact cancel boundaries AR',
  pubAr.includes(`أكثر من ${CANCELLATION_FREE_UNTIL_HOURS}`) &&
    pubAr.includes(`أكثر من ${CANCELLATION_CHARGE_30_UNTIL_HOURS}`) &&
    pubAr.includes(`أكثر من ${CANCELLATION_CHARGE_50_UNTIL_HOURS}`),
);
expect('J >72 = 0%', resolveCancellationChargePercent(73) === 0);
expect('K >48 <=72 = 30%', resolveCancellationChargePercent(60) === CANCELLATION_CHARGE_PERCENT_TIER_30);
expect('L >24 <=48 = 50%', resolveCancellationChargePercent(36) === CANCELLATION_CHARGE_PERCENT_TIER_50);
expect('M <=24 = 100%', resolveCancellationChargePercent(12) === CANCELLATION_CHARGE_PERCENT_TIER_100);

// N–Q deposit / balance
expect('N Deposit = 30%', DEPOSIT_PERCENT === 30 && pubEn.includes(`${DEPOSIT_PERCENT}%`));
expect(
  'O full payment <=72h',
  FULL_PAYMENT_WITHIN_HOURS === 72 && pubEn.includes(String(FULL_PAYMENT_WITHIN_HOURS)),
);
expect(
  'P Balance deadline = 48h',
  BALANCE_DUE_HOURS_BEFORE_START === 48 &&
    pubEn.includes(String(BALANCE_DUE_HOURS_BEFORE_START)),
);
expect(
  'Q deterministic auto-cancellation wording',
  /will be automatically cancelled/i.test(pubEn) && /يُلغى الحجز تلقائياً/.test(pubAr),
);

// R–S retention / examples
expect(
  'R no uncaptured money for cancel %',
  /does not collect additional money that was never captured/i.test(pubEn) ||
    /does not collect uncaptured money/i.test(pubEn),
);
expect(
  'S 200 JOD examples',
  flatten(publicCancelEn).includes('200 JOD') &&
    flatten(publicCancelEn).includes('60 JOD') &&
    flatten(publicCancelEn).includes('unpaid 140'),
);

// T–X fairness
expect(
  'T Owner-caused = 100% Customer refund entitlement',
  /entitled to a 100% refund of eligible/i.test(pubEn) ||
    /100% refund of eligible captured/i.test(pubEn),
);
expect(
  'U Customer no-show requires Mazare3 review and confirmation',
  /Mazare3 review and confirmation/i.test(pubEn) && !/admin confirmation is required/i.test(pubEn),
);
expect(
  'V Owner cannot unilaterally access-denied → no-show',
  /cannot unilaterally/i.test(pubEn) && /لا يجوز للمالك منفرداً/.test(pubAr),
);
expect(
  'W check-in does not prove quality',
  /does not prove/i.test(pubEn) && /Property quality|جودة العقار/.test(pubEn + pubAr),
);
expect(
  'X damage allegation no automatic card charge',
  /does not automatically charge/i.test(pubEn) ||
    /لا تخصم مزارع تلقائياً/.test(pubAr) ||
    /لا تشغّل مزارع نظام احتجاز عربون ضرر/.test(pubAr),
);

// Y–Z indemnity / consumer
expect(
  'Y broad indemnify clause removed',
  !/agree to indemnify Mazare3/i.test(pubEn) && !/توافق على تعويض مزارع عن/.test(pubAr),
);
expect(
  'Z consumer rights preserved',
  /Consumer Protection Law No\. 7 of 2017/i.test(pubEn) &&
    /قانون حماية المستهلك الأردني رقم 7 لسنة 2017/.test(pubAr),
);

// AA–AB booking terms
expect(
  'AA Booking Terms force-majeure reference',
  /force-majeure|force majeure/i.test(flatten(publicBookingEn)) &&
    /القوة القاهرة/.test(flatten(publicBookingAr)),
);
expect(
  'AB Privacy Policy distinguished from economic terms',
  (/not an economic term/i.test(flatten(publicBookingEn)) ||
    /not Booking economic terms/i.test(flatten(publicBookingEn))) &&
    (/ليست شرطاً اقتصادياً/.test(flatten(publicBookingAr)) ||
      /وليستا شروطاً اقتصادية/.test(flatten(publicBookingAr))),
);

// AC public banned phrases
const banned = [
  'FOUNDER INPUT REQUIRED',
  'REQUIRES JORDANIAN LEGAL REVIEW',
  'not counsel-approved',
  'Launch-candidate',
  'Launch Candidate',
  'This is not legal advice',
];
for (const b of banned) {
  expect(`AC public free of "${b}"`, !pubEn.includes(b) && !pubAr.includes(b));
}
expect('AC no HTML comments in public', !pubEn.includes('<!--') && !pubAr.includes('<!--'));

// AD guard still blocks
{
  let threw = false;
  let msg = '';
  try {
    assertLegalIdentityReadyForProduction(identity);
  } catch (e) {
    threw = true;
    msg = e instanceof Error ? e.message : String(e);
  }
  expect('AD activation still blocked on unresolved privacy/PSP', threw);
  expect(
    'AD still lists privacy + PSP gaps',
    msg.includes('privacyContactEmail') && msg.includes('paymentProviderLegalName'),
  );
  expect(
    'AD founder inputs still include privacy',
    listFounderInputRequired(identity).some((i) => i.key === 'privacyContactEmail'),
  );
}

// AE identity SSOT
expect(
  'AE Legal Identity SSOT authoritative',
  identity.legalEntityNameAr === 'شركة الرجل الوطواط للتكنولوجيا' &&
    identity.legalEntityNameEn === 'BATMAN TECHNOLOGY' &&
    identity.commercialRegistrationNumber === '62272',
);

// AF AR/EN financial parity
expect(
  'AF AR/EN both state 30% deposit and 48h balance',
  pubEn.includes('30') &&
    pubAr.includes('30') &&
    pubEn.includes('48') &&
    pubAr.includes('48'),
);

// preparePublicLegalText strips comments
expect(
  'preparePublicLegalText strips HTML comments',
  !preparePublicLegalText('Hello <!-- SECRET --> world').includes('SECRET'),
);

expect(
  'seed advisor script exists',
  existsSync(resolve(root, 'packages/db/prisma/seed-legal-advisor-revised.ts')),
);

expect(
  'booking ack UX has cancel tiers copy',
  src('apps/web/messages/en.json').includes('cancelTiersSummary') &&
    src('apps/web/src/components/legal/booking-legal-ack.tsx').includes('showCancelTiers'),
);

// ensure raw advisor markdown has no launch banner blockquote for the three docs
expect(
  'advisor markdown has no INTERNAL REVIEW banner for Terms',
  !getLaunchLegalMarkdown('terms_and_conditions', 'en').startsWith('>'),
);

void rawMd;

console.log(`\nPhase 3C.4A QA: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
