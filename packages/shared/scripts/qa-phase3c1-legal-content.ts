/**
 * Phase 3C.1 — Launch-candidate legal content QA.
 * Run: pnpm qa:phase3c1-legal-content
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  STANDARD_COMMISSION_PERCENT,
  VERIFIED_COMMISSION_PERCENT,
  DEPOSIT_PERCENT,
  FULL_PAYMENT_WITHIN_HOURS,
  BALANCE_DUE_HOURS_BEFORE_START,
  CANCELLATION_CHARGE_PERCENT_FREE,
  CANCELLATION_CHARGE_PERCENT_TIER_30,
  CANCELLATION_CHARGE_PERCENT_TIER_50,
  CANCELLATION_CHARGE_PERCENT_TIER_100,
  OWNER_CANCEL_PENALTY_PERCENT_FREE,
  OWNER_CANCEL_PENALTY_PERCENT_TIER_10,
  OWNER_CANCEL_PENALTY_PERCENT_TIER_20,
  OWNER_PENALTY_MIN_JOD,
  OWNER_PENALTY_MAX_JOD,
  MAX_CUSTOMER_RESCHEDULES,
  LAUNCH_CANDIDATE_VERSION,
  listLaunchLegalDocuments,
  getLaunchLegalMarkdown,
  findUnresolvedLegalPlaceholders,
  LEGAL_CONTENT_PLACEHOLDERS,
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
function has(rel: string, needle: string | RegExp, label: string) {
  const body = src(rel);
  const ok = typeof needle === 'string' ? body.includes(needle) : needle.test(body);
  expect(label, ok, `missing in ${rel}`);
}

/** Concatenate all launch-candidate markdown (EN+AR) for corpus checks. */
function allLaunchText(): string {
  return listLaunchLegalDocuments()
    .flatMap((d) => [d.markdownEn, d.markdownAr])
    .join('\n');
}

console.log('\nPhase 3C.1 Launch-Candidate Legal Content QA\n');

const corpus = allLaunchText();
const docs = listLaunchLegalDocuments();

expect('R AR+EN launch docs count 8', docs.length === 8);
expect(
  'R every doc has EN+AR markdown',
  docs.every((d) => d.markdownEn.length > 100 && d.markdownAr.length > 100),
);
expect('version is launch-candidate', LAUNCH_CANDIDATE_VERSION.includes('launch-candidate'));
expect(
  'version is Phase 3C.3 identity-integrated draft',
  LAUNCH_CANDIDATE_VERSION === '1.0.1-launch-candidate',
);

// A. No obsolete 12%
expect('A no obsolete 12% commission', !/\b12\s*%/.test(corpus) && !/commission[^\n]{0,40}12/i.test(corpus));

// B/C commission
expect('B 18% standard in corpus', corpus.includes(String(STANDARD_COMMISSION_PERCENT)));
expect('C 15% verified in corpus', corpus.includes(String(VERIFIED_COMMISSION_PERCENT)));
expect('B SSOT standard is 18', STANDARD_COMMISSION_PERCENT === 18);
expect('C SSOT verified is 15', VERIFIED_COMMISSION_PERCENT === 15);

// D/E/F payment timing
expect('D 30% deposit', DEPOSIT_PERCENT === 30 && corpus.includes(String(DEPOSIT_PERCENT)));
expect('E 72h threshold', FULL_PAYMENT_WITHIN_HOURS === 72 && corpus.includes(String(FULL_PAYMENT_WITHIN_HOURS)));
expect(
  'F 48h balance',
  BALANCE_DUE_HOURS_BEFORE_START === 48 && corpus.includes(String(BALANCE_DUE_HOURS_BEFORE_START)),
);

// G cancellation tiers
expect('G cancel 0', CANCELLATION_CHARGE_PERCENT_FREE === 0);
expect('G cancel 30', CANCELLATION_CHARGE_PERCENT_TIER_30 === 30 && corpus.includes('30'));
expect('G cancel 50', CANCELLATION_CHARGE_PERCENT_TIER_50 === 50);
expect('G cancel 100', CANCELLATION_CHARGE_PERCENT_TIER_100 === 100);

// H owner penalties
expect('H owner penalty 0/10/20', OWNER_CANCEL_PENALTY_PERCENT_FREE === 0);
expect('H tier 10', OWNER_CANCEL_PENALTY_PERCENT_TIER_10 === 10);
expect('H tier 20', OWNER_CANCEL_PENALTY_PERCENT_TIER_20 === 20);
expect('H min 10', OWNER_PENALTY_MIN_JOD === 10 && corpus.includes(String(OWNER_PENALTY_MIN_JOD)));
expect('H max 50', OWNER_PENALTY_MAX_JOD === 50 && corpus.includes(String(OWNER_PENALTY_MAX_JOD)));

// I/J no-show
expect('I owner no-show full refund language', /100\s*%[\s\S]{0,80}refund|استرداد[\s\S]{0,40}100/i.test(corpus));
expect(
  'J customer no-show no refund',
  /customer no-show[\s\S]{0,120}(no refund|refund\s*=\s*0)|عدم حضور الزبون[\s\S]{0,80}(لا\s*استرداد|استرداد\s*=\s*0)/i.test(
    corpus,
  ),
);

// K owner-requested reschedule no higher charge
expect(
  'K owner reschedule cannot force higher customer price',
  /cannot be forced to pay a higher|لا يمكن إجبار الزبون على دفع مبلغ أعلى/i.test(corpus),
);

// L force majeure no owner penalty
expect(
  'L force majeure no owner penalty',
  /force majeure[\s\S]{0,100}(no owner penalty|owner penalty\s*=\s*0)|القوة القاهرة[\s\S]{0,80}(بلا غرامة|بدون غرامة)/i.test(
    corpus,
  ),
);

// M verification not government
expect(
  'M not government certification',
  /not government certification|ليست جهة تحقق حكومية|ليس اعتماداً حكومياً|ليست شهادة حكومية/i.test(corpus),
);

// N no escrow claim as product role (denial is OK)
expect('N denies escrow', /not an escrow|وليست خدمة ضمان/i.test(corpus));
expect('N no claim we are escrow', !/Mazare3 is an escrow|مزارع هي خدمة ضمان/i.test(corpus));

// O no blanket non-refundable
expect(
  'O no all-payments-non-refundable',
  !/all payments are non-refundable/i.test(corpus),
);

// P no bundled consent
has(
  'apps/web/src/components/legal/legal-acceptance-checkboxes.tsx',
  'acknowledge',
  'P privacy acknowledge not consent-all',
);
expect(
  'P no I consent to the Privacy Policy',
  !/I consent to the Privacy Policy/i.test(
    src('apps/web/messages/en.json') + src('apps/web/src/components/legal/legal-acceptance-checkboxes.tsx'),
  ),
);

// Q no prechecked optional
has(
  'apps/web/src/components/legal/legal-acceptance-checkboxes.tsx',
  'checked={',
  'Q checkbox controlled (inspect)',
);
const boxes = src('apps/web/src/components/legal/legal-acceptance-checkboxes.tsx');
expect('Q marketing not defaultChecked', !/defaultChecked/.test(boxes));

// S immutable publish still draft-only
has(
  'apps/api/src/services/legal/legal-document.service.ts',
  'Only draft releases can be updated',
  'S draft-only edit gate',
);

// T historical acceptance resolves old hash
has(
  'apps/api/src/services/legal/legal-acceptance.service.ts',
  'documentHash',
  'T acceptance stores documentHash',
);

// U placeholder production guard
has(
  'apps/api/src/services/legal/legal-production-guard.ts',
  'assertProductionLegalReady',
  'U production guard exists',
);
has(
  'apps/api/src/services/legal/legal-production-guard.ts',
  'placeholder',
  'U guards placeholder ACTIVE',
);

// V legal entity placeholders detected
{
  const termsEn = getLaunchLegalMarkdown('terms_and_conditions', 'en');
  const unresolved = findUnresolvedLegalPlaceholders(termsEn);
  expect(
    'V detects LEGAL_ENTITY_NAME placeholder',
    unresolved.includes('LEGAL_ENTITY_NAME') || termsEn.includes(LEGAL_CONTENT_PLACEHOLDERS.LEGAL_ENTITY_NAME),
  );
}

// W Privacy DSR links
has(
  'apps/web/src/components/account/account-privacy-view.tsx',
  'AccountPrivacyView',
  'W account privacy view',
);
expect(
  'W privacy route exists',
  existsSync(resolve(root, 'apps/web/src/app/[locale]/account/privacy/page.tsx')),
);

// Max customer reschedules
expect('max customer reschedules 1', MAX_CUSTOMER_RESCHEDULES === 1 && corpus.includes(String(MAX_CUSTOMER_RESCHEDULES)));

// Docs exist
{
  const docsNeeded = [
    'docs/phase3c1-legal-identity-inputs.md',
    'docs/phase3c1-jordan-pdpl-compliance-gap.md',
    'docs/phase3c1-third-party-processor-inventory.md',
    'docs/phase3c1-retention-matrix.md',
    'docs/phase3c1-launch-transition-plan.md',
    'docs/phase3c1-glossary-ar-en.md',
  ];
  for (const d of docsNeeded) {
    expect(`doc ${d}`, existsSync(resolve(root, d)));
  }
}

// Seed draft script exists
expect(
  'seed launch candidate script',
  existsSync(resolve(root, 'packages/db/prisma/seed-legal-launch-candidate.ts')),
);

// Public pages for new policies
expect(
  'verification page',
  existsSync(resolve(root, 'apps/web/src/app/[locale]/verification/page.tsx')),
);
expect(
  'cookie-policy page',
  existsSync(resolve(root, 'apps/web/src/app/[locale]/cookie-policy/page.tsx')),
);
expect(
  'community-reviews page',
  existsSync(resolve(root, 'apps/web/src/app/[locale]/community-reviews/page.tsx')),
);

console.log(`\nPhase 3C.1 QA: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
