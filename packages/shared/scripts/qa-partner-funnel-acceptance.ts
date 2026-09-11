/**
 * PF-6 — Final Partner funnel acceptance (static + optional live).
 * Run: cd apps/api && pnpm exec dotenv -e ../../.env -- tsx ../../packages/shared/scripts/qa-partner-funnel-acceptance.ts
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
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

const model = read(
  'apps/web/src/components/become-owner/partner-onboarding/partner-onboarding-model.ts',
);
const stepsUi = read(
  'apps/web/src/components/become-owner/partner-onboarding/partner-wizard-steps.tsx',
);
const view = read('apps/web/src/components/become-owner/become-owner-view.tsx');
const landing = read(
  'apps/web/src/components/become-owner/partner-onboarding/partner-entry-landing.tsx',
);
const statusPanel = read(
  'apps/web/src/components/become-owner/partner-onboarding/partner-status-panel.tsx',
);
const stepper = read(
  'apps/web/src/components/become-owner/partner-onboarding/partner-onboarding-stepper.tsx',
);
const onboardingSvc = read('apps/api/src/services/partner-onboarding.service.ts');
const reqConfig = read('apps/api/src/config/partner-requirements.config.ts');
const readiness = read('apps/api/src/lib/owner-payout-readiness.ts');
const settlement = read('apps/api/src/services/owner-settlement.service.ts');
const machine = read('apps/api/src/lib/partner-verification-machine.ts');
const schema = read('packages/db/prisma/schema.prisma');
const envExample = read('.env.example');
const ownerShell = read('apps/web/src/components/owner/owner-shell.tsx');
const payoutSetup = read('apps/web/src/components/owner/owner-payout-setup-view.tsx');
const en = JSON.parse(read('apps/web/messages/en.json'));
const ar = JSON.parse(read('apps/web/messages/ar.json'));
const migrations = readdirSync(join(root, 'packages/db/prisma/migrations'));

const stepsBlock = model.match(/PARTNER_ONBOARDING_STEPS = \[[\s\S]*?\] as const/)?.[0] ?? '';

console.log('\n=== PF-6 Partner Funnel Acceptance ===\n');

console.log('— Final four steps —');
expect(
  '1 exactly four Partner steps',
  /'entity',\s*'contact',\s*'documents',\s*'review'/.test(stepsBlock) &&
    !stepsBlock.includes("'payout'"),
);
expect('2 no Partner payout wizard panel', !stepsUi.includes('partner-step-payout-panel'));
expect('3 no standalone agreement step', !stepsUi.includes("currentStep === 'agreement'"));
expect('4 agreement in Review', stepsUi.includes('partner-review-section-agreement'));
expect('5 no Partner Review payout card', !stepsUi.includes('partner-review-section-payout'));
expect('6 stepper 4 columns', stepper.includes('md:grid-cols-4'));
expect('7 no dead payout fields on Partner form state', !stepsUi.includes('beneficiaryName:'));
expect('8 Auth not a Partner wizard step', !stepsBlock.includes("'auth'") && (landing.includes('/auth?returnUrl') || landing.includes('sanitizeReturnUrl')));

console.log('\n— Status matrix wiring —');
expect('9 fresh → PartnerEntryLanding', view.includes('PartnerEntryLanding'));
expect('10 draft editable statuses', model.includes("'draft'") && model.includes("'changes_requested'"));
expect('11 pending submitted|under_review', model.includes("'submitted'") && model.includes("'under_review'"));
expect('12 approved statuses include legacy', model.includes("'approved'") && model.includes("'legacy_approved'"));
expect('13 rejected/suspended handled in status panel', statusPanel.includes("'rejected'") && statusPanel.includes("'suspended'"));
expect('14 tracking for submitted', statusPanel.includes('tracking.submittedTitle'));
expect('15 changes_requested corrections', statusPanel.includes('derivePartnerCorrectionActions') || model.includes('derivePartnerCorrectionActions'));
expect('16 approved success Add Farm', statusPanel.includes('partner-go-add-farm'));
expect('17 approved payout setup card', statusPanel.includes('partner-payout-setup-card'));
expect('18 no new PartnerVerificationStatus', !schema.includes('approved_pending_payout'));

console.log('\n— Lazy draft / KYC / payout split —');
expect('19 GET lazy empty view', onboardingSvc.includes('emptyPartnerOnboardingView') || onboardingSvc.includes('started: false'));
expect('20 partnerKycRequirementsForEntity', reqConfig.includes('partnerKycRequirementsForEntity'));
expect('21 payoutRequirementsForEntity', reqConfig.includes('payoutRequirementsForEntity'));
expect('22 canSubmit without payout', !/canSubmit\s*=\s*[\s\S]*?payoutProfileComplete\s*&&/.test(onboardingSvc));
expect('23 canApprove without payout', !/canApprove\s*=\s*[\s\S]*?payoutProfileApproved\s*&&/.test(onboardingSvc));
expect('24 OWNER_PAYOUT_SETUP_HREF', model.includes("OWNER_PAYOUT_SETUP_HREF = '/owner/payout'"));
expect('25 owner payout route', existsSync(join(root, 'apps/web/src/app/[locale]/owner/payout/page.tsx')));
expect('26 owner nav payout setup', ownerShell.includes('/owner/payout') && ownerShell.includes('nav.payoutSetup'));
expect('27 payout setup view', payoutSetup.includes('owner-payout-setup'));

console.log('\n— Legacy aliases —');
expect('28 agreement → review', model.includes("agreement: 'review'"));
expect('29 payout → review', model.includes("payout: 'review'"));
expect('30 about/details aliases', model.includes("about: 'entity'") && model.includes("details: 'contact'"));

console.log('\n— Financial guard —');
expect('31 mark-paid settlement guard', settlement.includes('assertOwnerHasReviewedPayoutDestination'));
expect('32 PAYOUT_DESTINATION_REQUIRED', readiness.includes('PAYOUT_DESTINATION_REQUIRED'));
expect('33 derived readiness states', readiness.includes('not_configured') && readiness.includes('ready'));

console.log('\n— Auth / Add Farm separation —');
expect('34 guest Unified Auth handoff', landing.includes('/auth?returnUrl') || landing.includes('partnerAuthHandoffHref') || landing.includes('sanitizeReturnUrl'));
expect('35 no Partner Phone OTP invent', !landing.includes('phone/start'));
expect('36 Add Farm wizard separate', existsSync(join(root, 'apps/web/src/components/owner/add-farm-onboarding/add-farm-wizard.tsx')));
expect('37 Partner Review has no property fields', !stepsUi.includes('basePrice') && !stepsUi.includes('amenityKeys') && !stepsUi.includes('coordinates'));
expect('38 approval != listing copy', statusPanel.includes('partner-approval-not-listing'));

console.log('\n— Safety freezes —');
expect('39 no PF-6 migration', !migrations.some((m) => /pf-?6|funnel.?accept/i.test(m)));
expect('40 no PartnerApplication model', !schema.includes('model PartnerApplication'));
expect('41 env.example no PF6 invent', !envExample.includes('PARTNER_FUNNEL') && !envExample.includes('PF6'));
expect('42 status machine markers', machine.includes('OWNER_SUBMIT_FROM') && machine.includes('isOperationallyApproved'));
expect('43 AR four-step labels', ar.becomeOwner.steps.entity && ar.becomeOwner.steps.contact && ar.becomeOwner.steps.documents && ar.becomeOwner.steps.review);
expect('44 EN four-step labels', en.becomeOwner.steps.entity && en.becomeOwner.steps.contact && en.becomeOwner.steps.documents && en.becomeOwner.steps.review);
expect('45 AR payout setup title', String(ar.owner.payoutSetup?.title ?? '').includes('استلام الأرباح'));

console.log(`\nPF-6 Acceptance QA: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
