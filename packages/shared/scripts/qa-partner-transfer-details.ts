/**
 * Phase PO-4 — Transfer Details / Payout (updated for PF-5 post-approval setup).
 * Run: pnpm --filter @mazare3/api exec tsx ../../packages/shared/scripts/qa-partner-transfer-details.ts
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { putPartnerPayoutProfileSchema } from '../src/schemas/partner.ts';

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
const steps = read(
  'apps/web/src/components/become-owner/partner-onboarding/partner-wizard-steps.tsx',
);
const model = read(
  'apps/web/src/components/become-owner/partner-onboarding/partner-onboarding-model.ts',
);
const payoutSetup = read('apps/web/src/components/owner/owner-payout-setup-view.tsx');
const schema = read('packages/shared/src/schemas/partner.ts');
const service = read('apps/api/src/services/partner-onboarding.service.ts');
const prisma = read('packages/db/prisma/schema.prisma');
const publicMapper = read('apps/api/src/mappers/public-property.mapper.ts');
const apiPartner = read('apps/web/src/lib/api-partner.ts');
const addFarmWizard = read(
  'apps/web/src/components/owner/add-farm-onboarding/add-farm-wizard.tsx',
);
const entry = read('apps/web/src/lib/add-farm-entry.ts');
const en = JSON.parse(read('apps/web/messages/en.json'));
const ar = JSON.parse(read('apps/web/messages/ar.json'));

console.log('\n— Domain / no invent —');
{
  expect('1 OwnerPayoutProfile model', prisma.includes('model OwnerPayoutProfile'));
  expect('2 review enum pending|reviewed|rejected', prisma.includes('enum OwnerPayoutReviewStatus'));
  expect(
    '3 put schema fields only beneficiary bank iban notes',
    schema.includes('beneficiaryName:') &&
      schema.includes('bankName:') &&
      schema.includes('iban:') &&
      schema.includes('optionalNotes:') &&
      !schema.includes('swift:') &&
      !schema.includes('routingNumber'),
  );
  expect('4 no SWIFT invent in UI', !payoutSetup.includes('SWIFT') && !payoutSetup.includes('BIC'));
  expect('5 encryptPartnerField used on save', service.includes('encryptPartnerField'));
  expect('6 ibanMasked uses last4', service.includes('ibanMasked:') && service.includes('ibanLast4'));
  expect('7 beneficiary/bank returned as bullet mask', service.includes("beneficiaryNameMasked: '••••'"));
  expect('8 no Jordan IBAN-only validator invent', !service.includes("startsWith('JO')"));
  expect('9 payout_proof remains document type', schema.includes("'payout_proof'"));
}

console.log('\n— Post-approval payout UX / safety (PF-5) —');
{
  expect('10 owner payout setup route', existsSync(join(root, 'apps/web/src/app/[locale]/owner/payout/page.tsx')));
  expect('11 owner-payout-setup testid', payoutSetup.includes('owner-payout-setup'));
  expect('12 no Partner wizard payout panel', !steps.includes('partner-step-payout-panel'));
  expect('13 putPartnerPayoutProfile from setup', payoutSetup.includes('putPartnerPayoutProfile'));
  expect('14 looksLikeMaskedPayoutValue guard', model.includes('looksLikeMaskedPayoutValue'));
  expect('15 validatePartnerPayoutForm', model.includes('validatePartnerPayoutForm'));
  expect('16 masked IBAN in setup summary', payoutSetup.includes('owner-payout-iban-masked'));
  expect('17 payout proof upload on setup', payoutSetup.includes('owner-payout-proof-input'));
  expect('18 fetchOwnerPayoutRequirements', apiPartner.includes('fetchOwnerPayoutRequirements'));
  expect('19 approved owners may save payout', service.includes('isOperationallyApproved(status)'));
  expect('20 no localStorage payout', !payoutSetup.includes('localStorage') && !view.includes('localStorage'));
  expect('21 no console.log of iban', !/console\.log\([^\)]*iban/i.test(payoutSetup + view + steps));
  expect('22 OWNER_PAYOUT_SETUP_HREF', model.includes("OWNER_PAYOUT_SETUP_HREF = '/owner/payout'"));
}

console.log('\n— Completion / gates —');
{
  expect(
    '26 Partner canSubmit does not require payoutProfileComplete',
    !/canSubmit\s*=\s*[\s\S]*?payoutProfileComplete\s*&&/.test(service),
  );
  expect(
    '27 Partner canApprove does not require payoutProfileApproved',
    !/canApprove\s*=\s*[\s\S]*?payoutProfileApproved\s*&&/.test(service),
  );
  expect(
    '28 payout readiness derived helper',
    model.includes('deriveOwnerPayoutReadiness') ||
      read('apps/api/src/lib/owner-payout-readiness.ts').includes('deriveOwnerPayoutReadiness'),
  );
  expect('29 editable draft|changes_requested for KYC', model.includes("'draft'") && model.includes("'changes_requested'"));
  expect('30 mark-paid destination guard', read('apps/api/src/services/owner-settlement.service.ts').includes('assertOwnerHasReviewedPayoutDestination'));
}

console.log('\n— Public / freeze / i18n —');
{
  expect(
    '31 public mapper no payout/iban',
    !publicMapper.includes('iban') &&
      !publicMapper.includes('OwnerPayoutProfile') &&
      !publicMapper.includes('beneficiaryName'),
  );
  expect('32 api client has no storageKey for payout', !apiPartner.includes('ibanCipher'));
  expect('33 agreement lives in Review (PF-3)', steps.includes('partner-review-section-agreement') && !steps.includes("currentStep === 'agreement'"));
  expect('34 no OTP', !steps.toLowerCase().includes('otp') && !view.toLowerCase().includes('otp'));
  expect('35 Add Farm untouched', addFarmWizard.includes('add-farm-wizard'));
  expect('36 approved redirect intact', entry.includes('isApprovedOwnerForAddFarm'));
  expect('37 EN owner.payoutSetup.title', Boolean(en.owner.payoutSetup?.title));
  expect('38 AR owner.payoutSetup.title', String(ar.owner.payoutSetup?.title ?? '').includes('استلام الأرباح'));
  expect('39 EN privacy transfer note preserved', Boolean(en.becomeOwner.transfer?.privacyNote));
  expect('40 AR privacy transfer note preserved', Boolean(ar.becomeOwner.transfer?.privacyNote));
  expect('41 EN steps.payout label retained for i18n', Boolean(en.becomeOwner.steps.payout));
  expect('42 AR steps.payout label retained for i18n', Boolean(ar.becomeOwner.steps.payout));
  expect('43 schema accepts payout payload', putPartnerPayoutProfileSchema.safeParse({
    beneficiaryName: 'Test Holder',
    bankName: 'Test Bank',
    iban: 'JO00TEST0000000000000000000001',
  }).success);
  expect('44 schema rejects short iban', !putPartnerPayoutProfileSchema.safeParse({
    beneficiaryName: 'Test Holder',
    bankName: 'Test Bank',
    iban: '123',
  }).success);
  expect('45 no PO-4 migration invent', !prisma.includes('OwnerPayoutSwift') && !schema.includes('phoneVerified'));
  expect('46 AES key env not exposed in UI', !payoutSetup.includes('PARTNER_DATA_ENCRYPTION_KEY'));
  expect('47 readiness states in owner copy', Boolean(en.owner.payoutSetup?.readiness?.ready));
}

console.log(`\nPO-4 Partner transfer details QA: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
