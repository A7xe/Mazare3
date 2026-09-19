/**
 * Phase 3C.4C.3 — Owner Agreement advisor-final public-UX lock QA.
 * Run: pnpm qa:phase3c4c3-owner-agreement
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ADVISOR_REVISED_VERSION,
  OWNER_ADVISOR_REVISED_VERSION,
  OWNER_ADVISOR_REVISED_VERSION_110,
  LAUNCH_CANDIDATE_VERSION,
  STANDARD_COMMISSION_PERCENT,
  VERIFIED_COMMISSION_PERCENT,
  getLaunchLegalDocument,
  getLaunchLegalMarkdown,
  ownerAgreementLaunchCandidate,
  ownerAgreementAdvisorRevised110,
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

console.log('\nPhase 3C.4C.3 Owner Agreement Final Lock QA\n');

const owner = getLaunchLegalDocument('owner_agreement');
const en = getLaunchLegalMarkdown('owner_agreement', 'en');
const ar = getLaunchLegalMarkdown('owner_agreement', 'ar');
const both = en + '\n' + ar;

expect('A: 1.1.0 preserved', ownerAgreementAdvisorRevised110.version === OWNER_ADVISOR_REVISED_VERSION_110);
expect('A2: launch-candidate preserved', ownerAgreementLaunchCandidate.version === LAUNCH_CANDIDATE_VERSION);
expect('B: version = 1.1.1-advisor-final', owner.version === '1.1.1-advisor-final');
expect('B2: OWNER constant', OWNER_ADVISOR_REVISED_VERSION === '1.1.1-advisor-final');
expect('C: DRAFT only via version label (advisor-final), not activated', owner.version.includes('advisor-final'));
expect(
  'D: public body has no DRAFT-for-counsel / review banner',
  !/DRAFT for counsel/i.test(both) &&
    !/INTERNAL REVIEW ONLY/i.test(both) &&
    !/مسودة لمراجعة المستشار/i.test(both),
);
expect(
  'E: no HTML counsel/founder comments in public body',
  !/<!--/.test(both) && !/COUNSEL_REVIEW_REQUIRED/.test(both) && !/FOUNDER REVIEW/.test(both),
);
expect('F: definitions exist', owner.sections.some((s) => s.id === 'definitions'));
expect(
  'G: Commercial Booking Value / قيمة الحجز التجارية',
  en.includes('Commercial Booking Value') && ar.includes('قيمة الحجز التجارية'),
);
expect(
  'H: Owner-funded vs platform-funded',
  /platform-funded/i.test(en) && /Owner-funded/i.test(en) && /لا تخفّض قيمة الحجز التجارية/.test(ar),
);
expect(
  'I: payment-processing fee — no invented open-ended deduction',
  /does not deduct a separate payment-processing fee/i.test(en) &&
    /does not claim an open-ended right to deduct arbitrary payment fees/i.test(en),
);
expect('J: document precedence', owner.sections.some((s) => s.id === 'precedence'));
expect(
  'K: Booking snapshot cannot be silently rewritten',
  /does not silently rewrite/i.test(en) || /لا يعيد.*بصمت/.test(ar),
);
expect(
  'L: no current-system unilateral financial language',
  !/current (system|workflow|rules|reacceptance|adjustment percentages)/i.test(en),
);
expect(
  'M: Financial Adjustment transparency',
  /Owner tools show at least the related Booking reference/i.test(en) &&
    /reason or category/i.test(en) &&
    /calculation basis/i.test(en),
);
expect(
  'N: Owner can request review via support',
  /request review through Mazare3 support/i.test(en) &&
    /does not automatically erase a valid adjustment/i.test(en),
);
expect(
  'O: no open-ended new penalties',
  /may arise only from/i.test(en) && !/other expressly documented commercial adjustments/i.test(en),
);
expect(
  'P: verification transparency/review',
  /general reason or category/i.test(en) && /request review through Mazare3 support/i.test(en),
);
expect(
  'Q: remediable breach cure principle',
  /reasonable opportunity to cure/i.test(en),
);
expect(
  'R: urgent protective exceptions remain',
  /serious fraud, security, safety/i.test(en),
);
expect('S: no unsupported Booking transfer', !/\btransferred\b/i.test(en) && !/أو نقلها/.test(ar));
expect('T: Owner media ownership retained', /retain ownership of Owner-provided content/i.test(en));
expect('U: limited licence', /limited, non-exclusive licence/i.test(en));
expect(
  'V: service-provider processing narrowly allowed',
  /hosting, CDN or storage, image-processing/i.test(en) && /solely on Mazare3/i.test(en),
);
expect(
  'W: Owner Customer-data role NOT invented as processor/controller',
  /does not by itself classify you as a processor or independent controller/i.test(en),
);
expect(
  'X: Privacy Policy referenced unchanged version lock',
  getLaunchLegalDocument('privacy_policy').version === '1.1.2-advisor-final',
);
expect('Y: Arabic acceptance evidence wording', ar.includes('موثقة ومرتبطة بالإصدار وقابلة للتدقيق'));
expect(
  'Z: OWNER_SETTLEMENT_CYCLE unresolved',
  en.includes('[[OWNER_SETTLEMENT_CYCLE]]') &&
    findUnresolvedLegalPlaceholders(en).some((t) => t.includes('OWNER_SETTLEMENT_CYCLE')),
);
expect('AA: no weekly/21-day public promise', !/weekly/i.test(en) && !/21-day/i.test(en) && !/أسبوعي/.test(ar));
expect(
  'AB: due payouts / no retroactive alteration',
  /does not retroactively alter amounts already due/i.test(en) &&
    /must not automatically confiscate lawfully due Owner payouts/i.test(en),
);
expect(
  'AC: liability balanced',
  /liable for Mazare3.s negligence/i.test(en) || /negligence, system fault, misconduct/i.test(en),
);
expect('AD: no unlimited blanket indemnity', /not a blanket unlimited indemnity/i.test(en));

const terms = getLaunchLegalDocument('terms_and_conditions');
const cancel = getLaunchLegalDocument('cancellation_refund_policy');
const booking = getLaunchLegalDocument('booking_terms');
expect('AE: Terms locked', terms.version === ADVISOR_REVISED_VERSION);
expect('AE2: Cancellation locked', cancel.version === ADVISOR_REVISED_VERSION);
expect('AE3: Booking locked', booking.version === ADVISOR_REVISED_VERSION);
expect('AE4: Privacy locked', getLaunchLegalDocument('privacy_policy').version === '1.1.2-advisor-final');

expect(
  'AF: owner seed aborts production',
  src('packages/db/prisma/seed-legal-owner-advisor-revised.ts').includes('APP_ENV=production'),
);
expect('commission 18/15', STANDARD_COMMISSION_PERCENT === 18 && VERIFIED_COMMISSION_PERCENT === 15 && en.includes('18%') && en.includes('15%'));
expect(
  'Owner adjustments API route',
  src('apps/api/src/routes/owner.ts').includes('/financial-adjustments'),
);
expect(
  'Owner adjustments UI',
  src('apps/web/src/components/owner/owner-payouts-view.tsx').includes('owner-financial-adjustments'),
);
expect(
  'readiness blockers include fee + liability + data role',
  src('apps/api/src/services/legal/legal-activation-readiness.service.ts').includes(
    'OWNER_PAYMENT_FEE_TREATMENT_REQUIRES_FOUNDER_DECISION',
  ) &&
    src('apps/api/src/services/legal/legal-activation-readiness.service.ts').includes(
      'LIABILITY_CAP_COUNSEL_REVIEW_REQUIRED',
    ) &&
    src('apps/api/src/services/legal/legal-activation-readiness.service.ts').includes(
      'OWNER_CUSTOMER_DATA_ROLE_COUNSEL_REVIEW_REQUIRED',
    ),
);

console.log(`\nResult: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
