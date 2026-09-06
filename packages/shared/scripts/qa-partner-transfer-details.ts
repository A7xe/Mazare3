/**
 * Phase PO-4 — Transfer Details / Payout.
 * Run: pnpm --filter @mazare3/api exec tsx ../../packages/shared/scripts/qa-partner-transfer-details.ts
 */
import { readFileSync } from 'node:fs';
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
const rail = read(
  'apps/web/src/components/become-owner/partner-onboarding/partner-onboarding-rail.tsx',
);
const schema = read('packages/shared/src/schemas/partner.ts');
const service = read('apps/api/src/services/partner-onboarding.service.ts');
const crypto = read('apps/api/src/lib/partner-crypto.ts');
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
  expect('4 no SWIFT invent in UI', !steps.includes('SWIFT') && !steps.includes('BIC'));
  expect('5 encryptPartnerField used on save', service.includes('encryptPartnerField'));
  expect('6 ibanMasked uses last4', service.includes('ibanMasked:') && service.includes('ibanLast4'));
  expect('7 beneficiary/bank returned as bullet mask', service.includes("beneficiaryNameMasked: '••••'"));
  expect('8 no Jordan IBAN-only validator invent', !service.includes("startsWith('JO')"));
  expect('9 payout_proof remains document type', schema.includes("'payout_proof'"));
}

console.log('\n— Step 5 UX / safety —');
{
  expect('10 payout panel testid', steps.includes('partner-step-payout-panel'));
  expect('11 transfer privacy note', steps.includes("t('transfer.privacyNote')"));
  expect('12 proof relation note', steps.includes("t('transfer.proofRelation')"));
  expect('13 no second payout proof upload in Step5', !/partner-step-payout-panel[\s\S]*type="file"/.test(steps));
  expect('14 saved summary uses masked IBAN', steps.includes('partner-payout-saved-summary') && steps.includes('partner-iban-masked'));
  expect('15 update action present', steps.includes('partner-payout-update'));
  expect('16 looksLikeMaskedPayoutValue guard', model.includes('looksLikeMaskedPayoutValue'));
  expect('17 validatePartnerPayoutForm', model.includes('validatePartnerPayoutForm'));
  expect('18 Next payout uses putPartnerPayoutProfile', /currentStep === 'payout'[\s\S]*putPartnerPayoutProfile/.test(view));
  expect('19 clear sensitive form after save', /setForm\(\(f\) => \(\{[\s\S]*iban: ''/.test(view));
  expect('20 payoutEditing mode', view.includes('payoutEditing') && steps.includes('payoutEditing'));
  expect('21 saved != reviewed copy', steps.includes("t('transfer.savedNotReviewed')"));
  expect('22 review reason shown when rejected', steps.includes('partner-payout-review-reason'));
  expect('23 goto documents link', steps.includes('partner-transfer-goto-documents'));
  expect('24 no localStorage payout', !view.includes('localStorage') && !steps.includes('localStorage'));
  expect('25 no console.log of iban', !/console\.log\([^\)]*iban/i.test(view + steps));
}

console.log('\n— Completion / gates —');
{
  expect(
    '26 payout completion = profile complete not approved',
    /const payout =[\s\S]*payoutProfileComplete[\s\S]*payout\.complete/.test(model),
  );
  expect(
    '27 canSubmit needs payoutProfileComplete',
    /canSubmit =[\s\S]*payoutProfileComplete/.test(service),
  );
  expect(
    '28 canApprove needs payoutProfileApproved/reviewed',
    /canApprove =[\s\S]*payoutProfileApproved/.test(service) ||
      service.includes('payoutProfileApproved = profile.payoutProfile?.reviewStatus === OwnerPayoutReviewStatus.reviewed'),
  );
  expect('29 Next gated by stepValid for payout', !view.includes("currentStep !== 'payout'"));
  expect('30 editable draft|changes_requested', model.includes("'draft'") && model.includes("'changes_requested'"));
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
  expect('33 agreement step untouched', steps.includes("currentStep === 'agreement'"));
  expect('34 no OTP', !steps.toLowerCase().includes('otp') && !view.toLowerCase().includes('otp'));
  expect('35 Add Farm untouched', addFarmWizard.includes('add-farm-wizard'));
  expect('36 approved redirect intact', entry.includes('isApprovedOwnerForAddFarm'));
  expect('37 EN transfer.stepHint', Boolean(en.becomeOwner.transfer?.stepHint));
  expect('38 AR transfer.stepHint', Boolean(ar.becomeOwner.transfer?.stepHint));
  expect('39 EN privacy', Boolean(en.becomeOwner.transfer?.privacyNote));
  expect('40 AR privacy', Boolean(ar.becomeOwner.transfer?.privacyNote));
  expect('41 EN steps.payout Transfer details', en.becomeOwner.steps.payout === 'Transfer details');
  expect('42 AR steps.payout بيانات التحويل', ar.becomeOwner.steps.payout === 'بيانات التحويل');
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
  expect('46 rail keeps payout privacy', rail.includes('payoutPrivacyBody'));
  expect('47 AES key env not exposed in UI', !steps.includes('PARTNER_DATA_ENCRYPTION_KEY'));
}

console.log(`\nPO-4 Partner transfer details QA: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
