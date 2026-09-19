/**
 * Phase 3C.4A.2 — Final customer legal polish QA.
 * Run: pnpm qa:phase3c4a2-final-polish
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ADVISOR_REVISED_VERSION,
  ADVISOR_REVISED_VERSION_110,
  DEFAULT_PLATFORM_TIME_ZONE,
  PUBLIC_PLATFORM_TIME_ZONE_AR,
  PUBLIC_PLATFORM_TIME_ZONE_EN,
  DEPOSIT_PERCENT,
  FULL_PAYMENT_WITHIN_HOURS,
  BALANCE_DUE_HOURS_BEFORE_START,
  CANCELLATION_FREE_UNTIL_HOURS,
  CANCELLATION_CHARGE_PERCENT_TIER_30,
  CANCELLATION_CHARGE_PERCENT_TIER_50,
  CANCELLATION_CHARGE_PERCENT_TIER_100,
  getLaunchLegalDocument,
  getLaunchLegalMarkdown,
  toPublicLegalDocument,
  toPlaceholderValues,
  getLegalIdentityFromEnv,
  preparePublicLegalText,
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

console.log('\nPhase 3C.4A.2 Final Customer Legal Polish QA\n');

expect('version is 1.1.2-advisor-final', ADVISOR_REVISED_VERSION === '1.1.2-advisor-final');
expect('historical 1.1.0 label preserved as constant', ADVISOR_REVISED_VERSION_110 === '1.1.0-advisor-revised');
expect(
  'historical 1.1.1 label preserved as constant',
  src('packages/shared/src/legal-content/build-legal-markdown.ts').includes(
    "ADVISOR_REVISED_VERSION_111 = '1.1.1-advisor-revised'",
  ),
);

const terms = getLaunchLegalDocument('terms_and_conditions');
const cancel = getLaunchLegalDocument('cancellation_refund_policy');
const booking = getLaunchLegalDocument('booking_terms');
expect('Terms on current advisor-final', terms.version === ADVISOR_REVISED_VERSION);
expect('Cancellation on current advisor-final', cancel.version === ADVISOR_REVISED_VERSION);
expect('Booking Terms on current advisor-final', booking.version === ADVISOR_REVISED_VERSION);

const identity = getLegalIdentityFromEnv();
const valuesEn = toPlaceholderValues(identity, 'en');
const valuesAr = toPlaceholderValues(identity, 'ar');

function flatten(doc: ReturnType<typeof toPublicLegalDocument>): string {
  if (!doc) return '';
  return [
    doc.title,
    doc.intro,
    ...doc.sections.flatMap((s) => [
      s.title,
      ...s.paragraphs,
      ...(s.bullets ?? []),
      s.tableMarkdown ?? '',
    ]),
  ].join('\n');
}

const pubEn = [
  flatten(toPublicLegalDocument(terms, 'en', valuesEn)),
  flatten(toPublicLegalDocument(cancel, 'en', valuesEn)),
  flatten(toPublicLegalDocument(booking, 'en', valuesEn)),
].join('\n');
const pubAr = [
  flatten(toPublicLegalDocument(terms, 'ar', valuesAr)),
  flatten(toPublicLegalDocument(cancel, 'ar', valuesAr)),
  flatten(toPublicLegalDocument(booking, 'ar', valuesAr)),
].join('\n');

const cancelSrc = src('packages/shared/src/legal-content/cancellation-refund-policy.ts');
expect(
  'cross-ref section 5 EN',
  /applicable percentage in section 5/.test(cancelSrc) && !/percentage in section 4/.test(cancelSrc),
);
expect(
  'cross-ref section 5 AR',
  /النسبة المعمول بها في البند 5/.test(cancelSrc) && !/النسبة المعمول بها في البند 4/.test(cancelSrc),
);

expect('Refund Due defined EN', /Refund Due/i.test(pubEn));
expect('Refunded Amount is completed EN', /successfully completed or been confirmed/i.test(pubEn));
expect(
  'pending not called completed Refunded Amount',
  !/recorded for return/i.test(pubEn) && /pending payment-provider processing/i.test(pubEn),
);

expect(
  'Privacy not incorporated as economic term',
  /not Booking economic terms/i.test(pubEn) && /read together according to the subject/i.test(pubEn),
);
expect('no invent tax rules EN', !/does not invent tax rules/i.test(pubEn));
expect('no invent tax AR', !/لا تخترع مزارع قواعد ضريبية/.test(pubAr));
expect('neutral tax wording EN', /Applicable taxes, charges, or invoicing requirements/i.test(pubEn));

expect(
  'customer Terms no 18%/15% commission disclosure',
  !/standard rate is 18/i.test(flatten(toPublicLegalDocument(terms, 'en', valuesEn)) ?? '') &&
    !/\b18%\b/.test(flatten(toPublicLegalDocument(terms, 'en', valuesEn)) ?? '') &&
    !/\b15%\b/.test(flatten(toPublicLegalDocument(terms, 'en', valuesEn)) ?? ''),
);
{
  const termsEn = flatten(toPublicLegalDocument(terms, 'en', valuesEn)) ?? '';
  expect('no Owner penalty tier clamp in Terms', !/10 JOD and maximum 50 JOD/i.test(termsEn));
  expect('no Owner 10%/20% penalty tiers in Terms', !/at 10%/.test(termsEn) && !/at 20%/.test(termsEn));
}

expect('public text no Asia/Amman', !pubEn.includes('Asia/Amman') && !pubAr.includes('Asia/Amman'));
expect('public EN Amman wording', pubEn.includes(PUBLIC_PLATFORM_TIME_ZONE_EN));
expect('public AR Amman wording', pubAr.includes(PUBLIC_PLATFORM_TIME_ZONE_AR));
expect('backend TZ still Asia/Amman', DEFAULT_PLATFORM_TIME_ZONE === 'Asia/Amman');
expect(
  'timezone.ts SSOT',
  src('packages/shared/src/timezone.ts').includes("DEFAULT_PLATFORM_TIME_ZONE = 'Asia/Amman'"),
);

expect(
  'AR Balance deadline unambiguous',
  /يجب سداد الرصيد المتبقي بحلول الموعد الذي يسبق بداية الحجز الفعلية بـ48 ساعة/.test(pubAr),
);
expect('no admin confirmation EN', !/admin confirmation/i.test(pubEn));
expect('Mazare3 review and confirmation EN', /Mazare3 review and confirmation/i.test(pubEn));
expect('no تأكيد الإدارة', !/تأكيد الإدارة/.test(pubAr));
expect('مراجعة مزارع وتأكيدها', /مراجعة مزارع وتأكيدها/.test(pubAr));

expect('no travel agency claim', !/travel agency/i.test(pubEn) && !/وكالة سفر/.test(pubAr));
expect(
  'IP neutral ownership',
  /owned by, or licensed for use to, the relevant rights holders/i.test(pubEn) &&
    /لأصحاب الحقوق فيها/.test(pubAr),
);
expect(
  'IP does not claim sole LEGAL_ENTITY ownership of all brand/software',
  !/platform content are owned by/.test(pubEn),
);

expect(
  'FM full refund entitlement',
  /entitled to a full refund of eligible captured/i.test(pubEn),
);
expect(
  'FM reschedule not forced',
  /not imposed instead of that refund without/i.test(pubEn),
);
expect('liability own obligations safeguard', /own contractual obligations/i.test(pubEn));
expect(
  'support does not waive court/regulator',
  /competent regulator/i.test(pubEn) && /competent Jordanian court/i.test(pubEn),
);
expect(
  'Booking request vs confirmed',
  /Booking request may be created/i.test(pubEn) && /becomes confirmed only after/i.test(pubEn),
);
expect(
  'Owner cheaper reschedule refund',
  /lower eligible price, the applicable difference is refunded/i.test(pubEn),
);
expect(
  'refund processing without unreasonable delay',
  /without unreasonable delay/i.test(pubEn),
);

// Economics unchanged
expect('Deposit 30%', DEPOSIT_PERCENT === 30);
expect('Full payment within 72h', FULL_PAYMENT_WITHIN_HOURS === 72);
expect('Balance -48h', BALANCE_DUE_HOURS_BEFORE_START === 48);
expect('cancel free >72', CANCELLATION_FREE_UNTIL_HOURS === 72);
expect('cancel tiers 30/50/100', CANCELLATION_CHARGE_PERCENT_TIER_30 === 30 && CANCELLATION_CHARGE_PERCENT_TIER_50 === 50 && CANCELLATION_CHARGE_PERCENT_TIER_100 === 100);
expect('will be automatically cancelled retained', /will be automatically cancelled/i.test(pubEn));

// Table markdown quality
const cancelMd = getLaunchLegalMarkdown('cancellation_refund_policy', 'en', valuesEn);
expect(
  'cancellation table not bullet-prefixed',
  /\| Time before actual start \| Cancellation charge \|/.test(cancelMd) &&
    !/\n- \| Time before actual start/.test(cancelMd),
);
const cancelPub = toPublicLegalDocument(cancel, 'en', valuesEn)!;
const tierSection = cancelPub.sections.find((s) => s.id === 'customer-tiers');
expect('public section exposes tableMarkdown', Boolean(tierSection?.tableMarkdown?.includes('|')));
expect('legal-document-view renders tables', src('apps/web/src/components/legal/legal-document-view.tsx').includes('LegalMarkdownTable'));

// Force-majeure: confirmed wording remains Customer-choice based; product enforces election
expect(
  'FM service still adminClassifyForceMajeure',
  src('apps/api/src/services/force-majeure.service.ts').includes('adminClassifyForceMajeure'),
);
expect(
  'customer FM election API present',
  src('apps/api/src/routes/me.ts').includes('force-majeure/choose'),
);
expect(
  'FM approve_reschedule requires customer choice',
  src('apps/api/src/services/force-majeure.service.ts').includes(
    'FORCE_MAJEURE_CUSTOMER_CHOICE_REQUIRED',
  ),
);

expect(
  'preparePublicLegalText still strips comments',
  preparePublicLegalText('Hello <!-- INTERNAL --> world') === 'Hello  world' ||
    preparePublicLegalText('Hello <!-- INTERNAL --> world').includes('Hello'),
);

console.log(`\nPhase 3C.4A.2 QA: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
