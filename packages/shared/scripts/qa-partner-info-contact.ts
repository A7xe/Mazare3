/**
 * Phase PO-2 — Partner Information + Contact.
 * Run: pnpm --filter @mazare3/api exec tsx ../../packages/shared/scripts/qa-partner-info-contact.ts
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { patchPartnerOnboardingProfileSchema } from '../src/schemas/partner.ts';

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
const schema = read('packages/shared/src/schemas/partner.ts');
const service = read('apps/api/src/services/partner-onboarding.service.ts');
const prisma = read('packages/db/prisma/schema.prisma');
const publicMapper = read('apps/api/src/mappers/public-property.mapper.ts');
const addFarmWizard = read(
  'apps/web/src/components/owner/add-farm-onboarding/add-farm-wizard.tsx',
);
const entry = read('apps/web/src/lib/add-farm-entry.ts');
const en = JSON.parse(read('apps/web/messages/en.json'));
const ar = JSON.parse(read('apps/web/messages/ar.json'));
const migrationsDir = join(root, 'packages/db/prisma/migrations');

console.log('\n— Domain fields / no invent —');
{
  expect('1 entityType individual|business', schema.includes("z.enum(['individual', 'business'])"));
  expect('2 displayName in patch schema', schema.includes('displayName:'));
  expect('3 businessName optional nullable', schema.includes('businessName:'));
  expect('4 phone in patch schema', schema.includes('phone:'));
  expect('5 city/area/bio in patch', schema.includes('city:') && schema.includes('bio:'));
  expect('6 approximateFarmCount exists', schema.includes('approximateFarmCount:'));
  expect('7 legalName/operating*/contactEmail exist', schema.includes('legalName:') && schema.includes('contactEmail:'));
  expect('8 no partnerFullName invent', !steps.includes('partnerFullName') && !schema.includes('partnerFullName'));
  expect('9 no role enum invent', !prisma.includes('PartnerRole') && !schema.includes('partnerRole'));
  expect('10 no OTP invent', !steps.toLowerCase().includes('otp') && !view.toLowerCase().includes('otp'));
  expect('11 entity cards use individual/business', steps.includes("entityType: 'individual'") && steps.includes("entityType: 'business'"));
  expect('12 property title/price not in entity step', !/currentStep === 'entity'[\s\S]*basePrice/.test(steps));
}

console.log('\n— Step 1 UX / validation —');
{
  expect('13 entity panel testid', steps.includes('partner-step-entity-panel'));
  expect('14 Step1 title uses steps.entity', steps.includes("t('steps.entity')"));
  expect('15 Step1 hint info.stepHint', steps.includes("t('info.stepHint')"));
  expect('16 farmCount optional label', steps.includes("t('optional')") && steps.includes('farmCount'));
  expect('17 Step1 Next omits phone from entity save', /currentStep === 'entity'[\s\S]*saveProfile\(\{[\s\S]*displayName[\s\S]*bio[\s\S]*\}\)/.test(view) && /currentStep === 'entity'[\s\S]*saveProfile\(\{[\s\S]*?\}\)/.test(view));
  const entitySave = view.match(/if \(currentStep === 'entity'\) \{[\s\S]*?\} else if \(currentStep === 'contact'\)/);
  expect('18 entity save has no phone field', Boolean(entitySave && !entitySave[0].includes('phone:')));
  expect(
    '19 entity save has displayName city area bio',
    view.includes("if (currentStep === 'entity')") &&
      /await saveProfile\(\{\s*entityType:[\s\S]*displayName:[\s\S]*city:[\s\S]*area:[\s\S]*bio:/.test(view),
  );
  expect('20 validateCurrentStep for entity', view.includes('validateCurrentStep'));
  expect('21 entity completion without phone', /const entity =[\s\S]*entityType[\s\S]*bio[\s\S]*;/.test(model) && !/const entity =[\s\S]*phone\.length[\s\S]*bio/.test(model));
  const entityOk = patchPartnerOnboardingProfileSchema.safeParse({
    entityType: 'individual',
    displayName: 'Test Partner',
    city: 'Amman',
    area: 'Abdoun',
    bio: 'A short bio that is long enough here.',
  });
  expect('22 schema accepts Step1 payload', entityOk.success);
  const shortBio = patchPartnerOnboardingProfileSchema.safeParse({ bio: 'too short' });
  expect('23 schema rejects short bio', !shortBio.success);
}

console.log('\n— Step 2 contact —');
{
  expect('24 contact panel testid', steps.includes('partner-step-contact-panel'));
  expect('25 primary phone on contact step', steps.includes("t('contact.phone')") && steps.includes('owner-apply-phone'));
  expect('26 phone not labeled verified', !steps.includes('Verified') && !String(en.becomeOwner.contact?.phoneHint ?? '').toLowerCase().includes('verified ownership'));
  expect('27 no OTP UI', !steps.includes('otp') && !steps.includes('verification code'));
  expect('28 account email read-only', steps.includes('partner-account-email') && steps.includes('readOnly'));
  expect('29 contactEmail optional editable', steps.includes('owner-apply-contactEmail'));
  expect('30 contact privacy note', steps.includes('partner-contact-privacy'));
  expect('31 contact next hint', steps.includes('partner-contact-next-hint'));
  const contactSave = view.match(/if \(currentStep === 'contact'\) \{[\s\S]*?\} else \{/);
  expect('32 contact save includes phone', Boolean(contactSave && contactSave[0].includes('phone:')));
  expect('33 contact completion requires phone', model.includes('phone.length >= 8') && model.includes('const contact'));
  expect('34 failed save does not advance (catch sets saveOk false)', view.includes('setSaveOk(false)') && view.includes('setStep'));
}

console.log('\n— Privacy / public / hydration —');
{
  expect('35 OwnerProfile phone comment private', prisma.includes('never exposed on public listing UI') || prisma.includes('phone'));
  expect('36 public mapper has no owner phone', !publicMapper.includes('phone') && !publicMapper.includes('contactEmail'));
  expect('37 single onboarding fetch on mount', (view.match(/fetchPartnerOnboarding\(/g) || []).length >= 1);
  expect('38 no stepParam hydration dep race like Add Farm', !view.includes('stepParam') || !view.includes('[draftParam'));
  expect('39 approved redirect intact', view.includes("router.replace('/owner/properties/new')"));
  expect('40 Add Farm wizard untouched marker', addFarmWizard.includes('hydratedDraftRef'));
  expect('41 Add Farm entry routing intact', entry.includes('resolveAddFarmHref'));
}

console.log('\n— Status / docs / payout freeze —');
{
  expect('42 changes_requested editable', model.includes("'changes_requested'"));
  expect('43 submitted/under_review pending', model.includes("'submitted'") && model.includes("'under_review'"));
  expect('44 documents step still present', steps.includes("currentStep === 'documents'"));
  expect('45 payout step still present', steps.includes("currentStep === 'payout'"));
  expect('46 agreement step still present', steps.includes("currentStep === 'agreement'"));
  expect('47 submit still uses readiness.canSubmit', steps.includes('readiness.canSubmit'));
  expect('48 profileComplete still includes phone+entity', service.includes('profile.phone.trim().length >= 8') && service.includes('v.entityType'));
}

console.log('\n— i18n / schema freeze —');
{
  expect('49 EN info.stepHint', Boolean(en.becomeOwner.info?.stepHint));
  expect('50 AR info.stepHint', Boolean(ar.becomeOwner.info?.stepHint));
  expect('51 EN contact.privacyNote', Boolean(en.becomeOwner.contact?.privacyNote));
  expect('52 AR contact.privacyNote', String(ar.becomeOwner.contact?.privacyNote ?? '').includes('زوار'));
  expect('53 EN steps.entity Partner information', en.becomeOwner.steps.entity === 'Partner information');
  expect('54 AR steps.entity معلومات الشريك', ar.becomeOwner.steps.entity === 'معلومات الشريك');
  expect('55 EN steps.contact Contact details', en.becomeOwner.steps.contact === 'Contact details');
  expect('56 AR steps.contact بيانات التواصل', ar.becomeOwner.steps.contact === 'بيانات التواصل');
  expect('57 no PO-2 migration invent', !existsSync(join(migrationsDir, '20260831140000_po2')));
  expect('58 no phoneVerified field', !prisma.includes('phoneVerified'));
}

console.log(`\nPO-2 Partner info/contact QA: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
