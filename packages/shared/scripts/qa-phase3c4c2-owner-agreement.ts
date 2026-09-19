/**
 * Phase 3C.4C.2 — Owner Agreement rewrite QA.
 * Run: pnpm qa:phase3c4c2-owner-agreement
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ADVISOR_REVISED_VERSION,
  OWNER_ADVISOR_REVISED_VERSION,
  LAUNCH_CANDIDATE_VERSION,
  STANDARD_COMMISSION_PERCENT,
  VERIFIED_COMMISSION_PERCENT,
  DEPOSIT_PERCENT,
  FULL_PAYMENT_WITHIN_HOURS,
  BALANCE_DUE_HOURS_BEFORE_START,
  CANCELLATION_FREE_UNTIL_HOURS,
  CANCELLATION_CHARGE_PERCENT_TIER_30,
  CANCELLATION_CHARGE_PERCENT_TIER_50,
  CANCELLATION_CHARGE_PERCENT_TIER_100,
  OWNER_CANCEL_PENALTY_FREE_UNTIL_HOURS,
  OWNER_CANCEL_PENALTY_TIER_10_UNTIL_HOURS,
  OWNER_CANCEL_PENALTY_PERCENT_TIER_10,
  OWNER_CANCEL_PENALTY_PERCENT_TIER_20,
  OWNER_PENALTY_MIN_JOD,
  OWNER_PENALTY_MAX_JOD,
  CUSTOMER_NO_SHOW_GRACE_MINUTES,
  getLaunchLegalDocument,
  getLaunchLegalMarkdown,
  ownerAgreementLaunchCandidate,
  ownerAgreementAdvisorRevised110,
  OWNER_ADVISOR_REVISED_VERSION_110,
  findUnresolvedLegalPlaceholders,
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

console.log('\nPhase 3C.4C.2 Owner Agreement Rewrite QA\n');

const owner = getLaunchLegalDocument('owner_agreement');
const en = getLaunchLegalMarkdown('owner_agreement', 'en');
const ar = getLaunchLegalMarkdown('owner_agreement', 'ar');
const both = en + '\n' + ar;

expect('A: version = 1.1.1-advisor-final', owner.version === OWNER_ADVISOR_REVISED_VERSION);
expect('A2: OWNER_ADVISOR constant', OWNER_ADVISOR_REVISED_VERSION === '1.1.1-advisor-final');
expect(
  'A3: 1.1.0 preserved separately',
  ownerAgreementAdvisorRevised110.version === OWNER_ADVISOR_REVISED_VERSION_110,
);
expect(
  'B: advisor-final DRAFT corpus (not Production-activated claim in intro)',
  owner.version.includes('advisor-final') &&
    !/Production-activated/i.test(owner.introEn),
);
expect(
  'C: 1.0.1 preserved separately',
  ownerAgreementLaunchCandidate.version === LAUNCH_CANDIDATE_VERSION &&
    ownerAgreementLaunchCandidate.version === '1.0.1-launch-candidate',
);
expect('D: standard commission = 18', STANDARD_COMMISSION_PERCENT === 18 && en.includes('18%'));
expect('E: verified commission = 15', VERIFIED_COMMISSION_PERCENT === 15 && en.includes('15%'));
expect(
  'F: KYC alone != verified 15%',
  /identity verification alone is not sufficient/i.test(en) ||
    /Basic identity verification alone is not sufficient/i.test(en),
);
expect('G: obsolete 12% absent from OA', !/\b12%\b/.test(both) && !/12٪/.test(both));
expect('H: commission snapshot stated', /snapshot/i.test(en) && /تُلتقط|لقطة/.test(ar));
expect(
  'I: custom terms require acceptance',
  /custom commercial terms/i.test(en) && /accepted by you/i.test(en),
);
expect(
  'J: >72h deposit or full',
  en.includes(`${FULL_PAYMENT_WITHIN_HOURS}`) &&
    en.includes(`${DEPOSIT_PERCENT}%`) &&
    /deposit or pay in full/i.test(en),
);
expect(
  'K: <=72h full payment',
  /full payment is required/i.test(en),
);
expect(
  'L: balance due -48h',
  en.includes(`${BALANCE_DUE_HOURS_BEFORE_START}`) &&
    /remaining balance is due/i.test(en),
);
expect(
  'M: Customer cancel ladder 0/30/50/100',
  en.includes(`${CANCELLATION_FREE_UNTIL_HOURS}`) &&
    en.includes(`${CANCELLATION_CHARGE_PERCENT_TIER_30}%`) &&
    en.includes(`${CANCELLATION_CHARGE_PERCENT_TIER_50}%`) &&
    en.includes(`${CANCELLATION_CHARGE_PERCENT_TIER_100}%`) &&
    /0% when more than/i.test(en),
);
expect(
  'N: captured-funds cap explained',
  /limited to funds actually captured/i.test(en),
);
expect(
  'O: no extra Customer collection implied',
  /does not charge the Customer an extra amount/i.test(en) ||
    /does not collect additional Customer money/i.test(en),
);
expect(
  'P: Owner cancel consequences',
  /refunded in full/i.test(en) &&
    /payout for that Booking is zero/i.test(en) &&
    /platform commission on the refunded value is zero/i.test(en),
);
expect(
  'Q: Owner penalty = settlement adjustment not automatic debit',
  /future settlement adjustment/i.test(en) &&
    /does not automatically charge your card/i.test(en),
);
expect(
  'R: Owner adjustment tiers/min/max',
  en.includes(`${OWNER_CANCEL_PENALTY_FREE_UNTIL_HOURS}`) &&
    en.includes(`${OWNER_CANCEL_PENALTY_TIER_10_UNTIL_HOURS}`) &&
    en.includes(`${OWNER_CANCEL_PENALTY_PERCENT_TIER_10}%`) &&
    en.includes(`${OWNER_CANCEL_PENALTY_PERCENT_TIER_20}%`) &&
    en.includes(`${OWNER_PENALTY_MIN_JOD}`) &&
    en.includes(`${OWNER_PENALTY_MAX_JOD}`),
);
expect(
  'S: Customer no-show dedicated section',
  owner.sections.some((s) => s.id === 'customer-no-show') &&
    /Customer no-show/i.test(en),
);
expect(
  'T: 60-minute grace',
  CUSTOMER_NO_SHOW_GRACE_MINUTES === 60 &&
    en.includes(`${CUSTOMER_NO_SHOW_GRACE_MINUTES}`),
);
expect(
  'U: Owner no-show / access denied section',
  owner.sections.some((s) => s.id === 'owner-no-show') &&
    /access denied/i.test(en),
);
expect('V: FM Owner penalty = 0', /Owner financial penalty is zero/i.test(en));
expect(
  'W: FM Customer full-refund entitlement',
  /full eligible refund/i.test(en),
);
expect(
  'X: FM reschedule voluntary',
  /cannot be forced/i.test(en) && /voluntarily elect/i.test(en),
);
expect(
  'Y: no double-recovery clause',
  owner.sections.some((s) => s.id === 'no-double-recovery') &&
    /same economic loss twice/i.test(en),
);
expect(
  'Z: settlement cycle placeholder preserved',
  en.includes('[[OWNER_SETTLEMENT_CYCLE]]') &&
    findUnresolvedLegalPlaceholders(en).some((t) =>
      t.includes('OWNER_SETTLEMENT_CYCLE'),
    ),
);
expect('AA: no false weekly payout promise', !/weekly/i.test(en) && !/أسبوعي/.test(ar));
expect(
  'AB: due payout not confiscated on exit/reacceptance',
  /must not automatically confiscate lawfully due Owner payouts/i.test(en) &&
    /must not block due payouts/i.test(en),
);
expect(
  'AC: KYC private/restricted wording',
  /private restricted storage/i.test(en),
);
expect(
  'AD: verification != government/title/safety',
  /not government certification/i.test(en) &&
    /not a guarantee of legal title, safety/i.test(en),
);
expect(
  'AE: exact-location duties + Privacy Policy',
  /Prior Consent before processing exact-location/i.test(en) &&
    /Privacy Policy/i.test(en),
);
expect(
  'AF: limited licence not ownership transfer',
  /limited, non-exclusive licence/i.test(en) &&
    /not a transfer of ownership/i.test(en),
);
expect(
  'AG: no automatic damage-card charge',
  /does not automatically charge a Customer/i.test(en),
);
expect(
  'AH: no false insurance promise',
  /does not provide Property insurance unless expressly stated/i.test(en),
);
expect(
  'AI: Customer Personal Data restrictions',
  /must not sell Customer Personal Data/i.test(en),
);
expect(
  'AJ: Owner account security duties',
  /Protect account credentials/i.test(en),
);
expect(
  'AK: liability does not shift Mazare3 negligence',
  /liable for Mazare3.s negligence/i.test(en),
);
expect(
  'AL: indemnity not unlimited blanket',
  /not a blanket unlimited indemnity/i.test(en),
);

const terms = getLaunchLegalDocument('terms_and_conditions');
const cancel = getLaunchLegalDocument('cancellation_refund_policy');
const booking = getLaunchLegalDocument('booking_terms');
const privacy = getLaunchLegalDocument('privacy_policy');
expect('AM: Terms still 1.1.2-advisor-final', terms.version === ADVISOR_REVISED_VERSION);
expect('AM2: Cancellation locked', cancel.version === ADVISOR_REVISED_VERSION);
expect('AM3: Booking Terms locked', booking.version === ADVISOR_REVISED_VERSION);
expect('AN: Privacy Policy unchanged 1.1.2', privacy.version === '1.1.2-advisor-final');

expect(
  'AO: owner seed aborts production',
  src('packages/db/prisma/seed-legal-owner-advisor-revised.ts').includes(
    'APP_ENV=production',
  ),
);
expect(
  'no escrow classification as product',
  /not an escrow service/i.test(en),
);
expect(
  'Arabic Customer term العميل present',
  ar.includes('العميل'),
);
expect(
  'approval window 60 minutes',
  en.includes('60 minutes') || en.includes('60 minute'),
);
expect(
  'review export exists or generator present',
  existsSync(resolve(root, 'docs/MAZARE3_OWNER_AGREEMENT_3C4C2_REVIEW.md')) ||
    existsSync(
      resolve(root, 'packages/shared/scripts/generate-phase3c4c2-owner-agreement-review.ts'),
    ),
);

// Enum leakage checks (active OA)
expect('no BALANCE_NOT_PAID enum in public OA', !both.includes('BALANCE_NOT_PAID'));
expect('no platform_verified enum token', !both.includes('platform_verified'));
expect('no PartnerCommercialTerms code name', !both.includes('PartnerCommercialTerms'));

console.log(`\nResult: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
