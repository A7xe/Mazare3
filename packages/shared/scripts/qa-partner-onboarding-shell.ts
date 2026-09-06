/**
 * Phase PO-1 — Partner Onboarding entry + shell.
 * Run: pnpm --filter @mazare3/api exec tsx ../../packages/shared/scripts/qa-partner-onboarding-shell.ts
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

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

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const read = (rel: string) => readFileSync(join(root, rel), 'utf8');

const view = read('apps/web/src/components/become-owner/become-owner-view.tsx');
const landing = read(
  'apps/web/src/components/become-owner/partner-onboarding/partner-entry-landing.tsx',
);
const shell = read(
  'apps/web/src/components/become-owner/partner-onboarding/partner-onboarding-shell.tsx',
);
const stepper = read(
  'apps/web/src/components/become-owner/partner-onboarding/partner-onboarding-stepper.tsx',
);
const rail = read(
  'apps/web/src/components/become-owner/partner-onboarding/partner-onboarding-rail.tsx',
);
const status = read(
  'apps/web/src/components/become-owner/partner-onboarding/partner-status-panel.tsx',
);
const model = read(
  'apps/web/src/components/become-owner/partner-onboarding/partner-onboarding-model.ts',
);
const stepsUi = read(
  'apps/web/src/components/become-owner/partner-onboarding/partner-wizard-steps.tsx',
);
const entryRouting = read('apps/web/src/lib/add-farm-entry.ts');
const en = JSON.parse(read('apps/web/messages/en.json'));
const ar = JSON.parse(read('apps/web/messages/ar.json'));
const migrationsDir = join(root, 'packages/db/prisma/migrations');

console.log('\n— Guest entry —');
{
  expect('1 partner-entry-landing exists', landing.includes('partner-entry-landing'));
  expect('2 guest auth bridge', landing.includes('partner-auth-bridge'));
  expect('3 guest signup CTA', landing.includes('partner-start-signup'));
  expect('4 guest login CTA', landing.includes('partner-start-login'));
  expect('5 become-owner uses landing for guests', view.includes('mode="guest"'));
  expect('6 how it works section', landing.includes('partner-how-it-works'));
  expect('7 requirements preview', landing.includes('partner-requirements-preview'));
}

console.log('\n— Start / continue —');
{
  expect('8 start application CTA', landing.includes('partner-start-application'));
  expect('9 continue application CTA', view.includes('partner-continue-application'));
  expect('10 meaningful progress helper', model.includes('hasMeaningfulPartnerProgress'));
  expect('11 no property draft create in partner view', !view.includes('createOwnerPropertyDraft'));
  expect('12 fetchPartnerOnboarding resume', view.includes('fetchPartnerOnboarding'));
}

console.log('\n— Progress truthfulness —');
{
  expect('13 blank progress helper present', model.includes("verificationStatus !== 'draft'"));
  expect('14 placeholder name ignored', model.includes('PLACEHOLDER_PARTNER_NAME'));
  expect('15 derivePartnerSectionCompletion exported', model.includes('derivePartnerSectionCompletion'));
  expect('16 visiting step must not auto-complete comment/logic', model.includes('does not mark it complete'));
  expect('17 partnerProgressPercent', model.includes('partnerProgressPercent'));
  expect(
    '18 six domain steps array',
    model.includes("'entity'") &&
      model.includes("'contact'") &&
      model.includes("'documents'") &&
      model.includes("'payout'") &&
      model.includes("'agreement'") &&
      model.includes("'review'") &&
      !/'contact',\s*'requirements',\s*'documents'/.test(model),
  );
  expect(
    '19 PARTNER_ONBOARDING_STEPS length 6',
    model.includes('PARTNER_ONBOARDING_STEPS') &&
      /entity',\s*'contact',\s*'documents',\s*'payout',\s*'agreement',\s*'review'/.test(model),
  );
  expect(
    '19b legacy requirements step aliases to documents',
    model.includes('resolvePartnerOnboardingStepId') &&
      model.includes("requirements: 'documents'"),
  );
}

console.log('\n— Shell / status —');
{
  expect('20 onboarding shell', shell.includes('partner-onboarding-shell'));
  expect('21 stepper mobile compact', stepper.includes('partner-stepper-mobile'));
  expect('22 stepper aria-current', stepper.includes("aria-current={active ? 'step'"));
  expect('23 right rail', rail.includes('partner-onboarding-rail'));
  expect('24 no listing preview rail', !rail.includes('add-farm-preview') && !rail.includes('Sponsored'));
  expect('25 submitted status UX', status.includes('submittedTitle') || status.includes('submittedBody'));
  expect('26 under review status UX', status.includes('underReviewTitle'));
  expect('27 changes requested status', status.includes('changesTitle'));
  expect('28 rejected status', status.includes('rejectedTitle'));
  expect('29 pending hides wizard via showStatusOnly', view.includes('showStatusOnly'));
  expect('30 changes_requested editable statuses', model.includes("'changes_requested'"));
  expect('31 approved redirects Add Farm', view.includes("router.replace('/owner/properties/new')"));
  expect('32 under_review in pending list', model.includes("'under_review'"));
  expect('33 submitted in pending list', model.includes("'submitted'"));
}

console.log('\n— Privacy / truthfulness —');
{
  expect('34 docs privacy copy in rail', rail.includes('docsPrivacyBody'));
  expect('35 payout privacy copy in rail', rail.includes('payoutPrivacyBody'));
  expect('36 no fake SLA key', status.includes('noSla'));
  expect('37 EN noSLA has no 24h claim', !String(en.becomeOwner.statusUx?.noSla ?? '').includes('24'));
  expect('38 no OTP', !view.toLowerCase().includes('otp') && !landing.toLowerCase().includes('otp'));
  expect(
    '39 no income guarantee in entry EN',
    !JSON.stringify(en.becomeOwner.entry).toLowerCase().includes('guaranteed'),
  );
  expect(
    '40 KYC APIs still used',
    view.includes('patchPartnerOnboarding') && view.includes('submitPartnerOnboarding'),
  );
}

console.log('\n— Routing / schema / i18n —');
{
  expect('41 Add Farm routing helper intact', entryRouting.includes('resolveAddFarmHref'));
  expect('42 approved owner wizard href', entryRouting.includes("'/owner/properties/new'"));
  expect('43 EN entry headline', Boolean(en.becomeOwner.entry?.headline));
  expect('44 AR entry headline', Boolean(ar.becomeOwner.entry?.headline));
  expect('45 EN auth bridge', Boolean(en.becomeOwner.authBridge?.body));
  expect('46 AR auth bridge', Boolean(ar.becomeOwner.authBridge?.body));
  expect('47 EN shell progress', Boolean(en.becomeOwner.shell?.progressTitle));
  expect('48 AR docs privacy', String(ar.becomeOwner.shell?.docsPrivacyBody ?? '').includes('زوار'));
  expect('49 no PO-1 migration invent', !existsSync(join(migrationsDir, '20260831130000_po1')));
  expect('50 wizard steps UI preserved', stepsUi.includes('partner-entity-individual'));
  expect('51 partner-submit preserved', stepsUi.includes('partner-submit'));
  expect('52 documents privacy EN', String(en.becomeOwner.shell.docsPrivacyBody).includes('private'));
  expect('53 start CTA EN', en.becomeOwner.entry.startCta === 'Start your application');
  expect('54 start CTA AR', ar.becomeOwner.entry.startCta === 'ابدأ طلب الانضمام');
  expect('55 continue CTA EN', en.becomeOwner.entry.continueCta === 'Continue your application');
  expect('56 continue CTA AR', ar.becomeOwner.entry.continueCta === 'أكمل طلب الانضمام');
}

console.log(`\nPO-1 Partner Onboarding shell QA: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
