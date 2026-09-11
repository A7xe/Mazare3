/**
 * Phase PO-3 — Requirements + Documents.
 * Run: pnpm --filter @mazare3/api exec tsx ../../packages/shared/scripts/qa-partner-requirements-documents.ts
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { partnerDocumentTypeSchema } from '../src/schemas/partner.ts';

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
const stepper = read(
  'apps/web/src/components/become-owner/partner-onboarding/partner-onboarding-stepper.tsx',
);
const reqConfig = read('apps/api/src/config/partner-requirements.config.ts');
const service = read('apps/api/src/services/partner-onboarding.service.ts');
const magic = read('apps/api/src/lib/partner-file-magic.ts');
const storage = read('apps/api/src/services/partner-documents/private-storage.ts');
const storageConfig = read('apps/api/src/config/partner-document-storage.config.ts');
const publicMapper = read('apps/api/src/mappers/public-property.mapper.ts');
const ownerRoutes = read('apps/api/src/routes/owner.ts');
const prisma = read('packages/db/prisma/schema.prisma');
const schema = read('packages/shared/src/schemas/partner.ts');
const apiPartner = read('apps/web/src/lib/api-partner.ts');
const addFarmWizard = read(
  'apps/web/src/components/owner/add-farm-onboarding/add-farm-wizard.tsx',
);
const entry = read('apps/web/src/lib/add-farm-entry.ts');
const en = JSON.parse(read('apps/web/messages/en.json'));
const ar = JSON.parse(read('apps/web/messages/ar.json'));

console.log('\n— Combined Documents step (merged Requirements UX) —');
{
  expect('1 requirementsForEntity exported', reqConfig.includes('export function requirementsForEntity'));
  expect('2 service uses requirementsForEntity', service.includes('requirementsForEntity('));
  expect('3 individual auth optional', reqConfig.includes("entityType: 'individual'") && /management_authorization[\s\S]*required: false/.test(reqConfig));
  expect('4 business registration required', /business_registration[\s\S]*required: true/.test(reqConfig));
  expect('5 identity required for all', /documentType: 'identity'[\s\S]*required: true/.test(reqConfig));
  expect('6 no invented trade_license type', !reqConfig.includes('trade_license') && !schema.includes('trade_license'));
  expect(
    '7 canonical document types',
    partnerDocumentTypeSchema.options.join(',') ===
      'identity,property_ownership,management_authorization,business_registration,payout_proof,other',
  );
  expect(
    '8 Documents step uses API requirements list',
    steps.includes('requirements.map') && steps.includes('partner-documents-list'),
  );
  expect(
    '9 no standalone Requirements panel',
    !steps.includes('partner-step-requirements-panel') && !steps.includes("currentStep === 'requirements'"),
  );
  expect(
    '10 no informational requirements Next skip',
    !view.includes("currentStep === 'requirements'"),
  );
  expect(
    '10b legacy ?step=requirements resolves to documents',
    model.includes('resolvePartnerOnboardingStepId') && model.includes("requirements: 'documents'"),
  );
}

console.log('\n— Completion / submit gate —');
{
  expect(
    '11 no informational requirementsDone section',
    !model.includes('const requirementsDone = entity && contact') &&
      !/requirements:\s*requirementsDone/.test(model),
  );
  expect(
    '12 documents completion uses requiredDocumentsComplete / uploads',
    /const documents =[\s\S]*requiredDocumentsComplete[\s\S]*r\.required[\s\S]*currentDocument/.test(model),
  );
  expect(
    '12b documents completion aligns with uploads not approval',
    model.includes('requiredDocumentsComplete') && !/const documents =[\s\S]*requiredDocumentsApproved/.test(model),
  );
  expect(
    '13 canSubmit needs requiredDocumentsComplete not Approved',
    /const canSubmit =[\s\S]*requiredDocumentsComplete &&[\s\S]*!requiredDocumentsApproved/.test(service) ||
      (/canSubmit =[\s\S]*requiredDocumentsComplete/.test(service) &&
        /canApprove =[\s\S]*requiredDocumentsApproved/.test(service)),
  );
  expect(
    '14 Next documents blocked when missing required',
    view.includes('missingRequiredPartnerDocuments') && view.includes("t('docs.missingRequired'"),
  );
  expect('15 optional docs do not block stepValid', /currentStep === 'documents'[\s\S]*r\.required[\s\S]*currentDocument/.test(view));
}

console.log('\n— Documents UX / states —');
{
  expect('16 documents panel testid', steps.includes('partner-step-documents-panel'));
  expect('17 privacy note on documents', steps.includes("t('docs.privacyNote')"));
  expect('18 formats hint uses PARTNER_DOC_MAX_MB_DEFAULT', steps.includes('PARTNER_DOC_MAX_MB_DEFAULT') && model.includes('PARTNER_DOC_MAX_MB_DEFAULT = 8'));
  expect('19 partnerDocumentUiState mapping', model.includes('partnerDocumentUiState') && model.includes('needs_attention'));
  expect('20 upload != accepted copy', steps.includes("t('docs.uploadNotApproval')"));
  expect('21 accepted only from approved status', /reviewStatus === 'approved'[\s\S]*accepted/.test(model) || model.includes("if (doc.reviewStatus === 'approved') return 'accepted'"));
  expect('22 replace label used', steps.includes("t('replaceFile')"));
  expect('23 no delete UI invent', !steps.includes('deletePartnerDocument') && !steps.includes('partner-doc-delete'));
  expect('24 rejectionReason shown when present', steps.includes('rejectionReason'));
  expect('25 no storageKey in UI', !steps.includes('storageKey') && !apiPartner.includes('storageKey'));
}

console.log('\n— Storage / validation / security —');
{
  expect('26 private KYC storage providers', storageConfig.includes('local_private') && storageConfig.includes('cloudflare_r2_private'));
  expect('27 private-storage module', storage.includes('putPartnerDocument') || storage.includes('getPartnerDocumentStorage'));
  expect('28 magic MIME PDF/JPEG/PNG/WebP', magic.includes('application/pdf') && magic.includes('image/webp'));
  expect('29 default max 8MB', magic.includes("PARTNER_DOCUMENT_MAX_MB ?? '8'"));
  expect(
    '30 public mapper has no KYC document fields',
    !publicMapper.includes('OwnerDocument') &&
      !publicMapper.includes('partner-documents') &&
      !publicMapper.includes('originalFileName') &&
      !publicMapper.includes('rejectionReason'),
  );
  expect('31 owner document file route private', ownerRoutes.includes('/onboarding/documents') && ownerRoutes.includes(':id/file'));
  expect('32 upload uses requirementId FormData', apiPartner.includes("form.append('requirementId'"));
  expect('33 client validatePartnerDocumentFile', model.includes('validatePartnerDocumentFile') && view.includes('validatePartnerDocumentFile'));
  expect('34 failed upload keeps uploadingId clear', /catch[\s\S]*finally[\s\S]*setUploadingId\(null\)/.test(view));
}

console.log('\n— Entity change / freeze / i18n —');
{
  expect('35 entity change no silent delete in patch', !/entityType[\s\S]*deleteMany.*documents/.test(service));
  expect('36 no OTP', !steps.toLowerCase().includes('otp') && !view.toLowerCase().includes('otp'));
  expect('37 payout setup lives on owner route (PF-5)', existsSync(join(root, 'apps/web/src/app/[locale]/owner/payout/page.tsx')));
  expect('38 agreement lives in Review (PF-3)', steps.includes('partner-review-section-agreement') && !steps.includes("currentStep === 'agreement'"));
  expect('39 Add Farm wizard untouched', addFarmWizard.includes('add-farm-wizard'));
  expect('40 approved redirect helper intact', entry.includes('isApprovedOwnerForAddFarm'));
  expect('41 EN docs.stepHint mentions partner type', String(en.becomeOwner.docs?.stepHint ?? '').includes('partner type'));
  expect('42 AR docs.stepHint mentions نوع الشريك', String(ar.becomeOwner.docs?.stepHint ?? '').includes('نوع الشريك'));
  expect('43 EN docs.privacyNote', Boolean(en.becomeOwner.docs?.privacyNote));
  expect('44 AR docs.privacyNote', Boolean(ar.becomeOwner.docs?.privacyNote));
  expect('45 EN uploaded status label is Uploaded', en.becomeOwner.reqs.state.uploaded === 'Uploaded');
  expect('46 AR uploaded status تم الرفع', ar.becomeOwner.reqs.state.uploaded === 'تم الرفع');
  expect('47 EN accepted != uploaded', en.becomeOwner.reqs.state.accepted !== en.becomeOwner.reqs.state.uploaded);
  expect('48 no PO-3 migration invent', !prisma.includes('PartnerDocumentOcr') && !schema.includes('phoneVerified'));
  expect('49 supersede on replace in service', service.includes('superseded') && service.includes('supersededById'));
  expect('50 rail docs progress', rail.includes('shell.docsProgress') && rail.includes('countRequiredPartnerDocuments'));
  expect('51 editable statuses draft|changes_requested', model.includes("'draft'") && model.includes("'changes_requested'"));
  expect('52 pending submitted|under_review', model.includes("'submitted'") && model.includes("'under_review'"));
  expect('53 stepper uses 4 columns', stepper.includes('md:grid-cols-4') && !stepper.includes('md:grid-cols-5'));
  expect('54 rail progress uses PARTNER_ONBOARDING_STEPS.length', rail.includes('PARTNER_ONBOARDING_STEPS.length'));
}

console.log(`\nPO-3 Partner requirements/documents QA: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
