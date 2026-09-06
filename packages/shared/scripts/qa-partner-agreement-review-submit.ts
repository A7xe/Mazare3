/**
 * Phase PO-5 — Agreement + Review + Submit.
 * Run: pnpm --filter @mazare3/api exec tsx ../../packages/shared/scripts/qa-partner-agreement-review-submit.ts
 */
import { readFileSync } from 'node:fs';
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
const steps = read(
  'apps/web/src/components/become-owner/partner-onboarding/partner-wizard-steps.tsx',
);
const model = read(
  'apps/web/src/components/become-owner/partner-onboarding/partner-onboarding-model.ts',
);
const statusPanel = read(
  'apps/web/src/components/become-owner/partner-onboarding/partner-status-panel.tsx',
);
const service = read('apps/api/src/services/partner-onboarding.service.ts');
const machine = read('apps/api/src/lib/partner-verification-machine.ts');
const routes = read('apps/api/src/routes/owner.ts');
const prisma = read('packages/db/prisma/schema.prisma');
const apiPartner = read('apps/web/src/lib/api-partner.ts');
const addFarmWizard = read(
  'apps/web/src/components/owner/add-farm-onboarding/add-farm-wizard.tsx',
);
const entry = read('apps/web/src/lib/add-farm-entry.ts');
const en = JSON.parse(read('apps/web/messages/en.json'));
const ar = JSON.parse(read('apps/web/messages/ar.json'));

console.log('\n— Agreement source / versioning —');
{
  expect('1 PartnerAgreement model', prisma.includes('model PartnerAgreement'));
  expect('2 PartnerAgreementAcceptance model', prisma.includes('model PartnerAgreementAcceptance'));
  expect('3 agreement content from API fields', steps.includes('agreement.contentAr') || steps.includes('agreementContent'));
  expect(
    '4 legal body not duplicated in localization',
    !JSON.stringify(en.becomeOwner).includes('contentAr') &&
      !('legalBody' in (en.becomeOwner.agreementUx ?? {})) &&
      !('legalBody' in (ar.becomeOwner.agreementUx ?? {})),
  );
  expect('5 version displayed via agreementVersion', steps.includes("t('agreementVersion'"));
  expect(
    '6 current-id acceptance gate in model',
    model.includes('hasAcceptedCurrentPartnerAgreement') &&
      model.includes('acceptedAgreement.agreementId === view.currentAgreement.id'),
  );
  expect(
    '7 readiness.agreementAccepted uses active agreement id',
    /agreementAccepted = Boolean\(\s*activeAgreement &&[\s\S]*agreementId === activeAgreement\.id/.test(
      service,
    ),
  );
  expect('8 accept endpoint POST partner-agreement/accept', routes.includes('/partner-agreement/accept'));
  expect(
    '9 UI accept calls acceptPartnerAgreement',
    view.includes('acceptPartnerAgreement') && apiPartner.includes('/owner/partner-agreement/accept'),
  );
  expect(
    '10 client-only checkbox does not complete agreement',
    model.includes('readiness.agreementAccepted') &&
      !/const agreement =\s*acceptedTerms/.test(model) &&
      steps.includes('hasAcceptedCurrentPartnerAgreement(onboarding)'),
  );
}

console.log('\n— Accepted ≠ approved / commercial —');
{
  expect('11 acceptedNotApproved copy', steps.includes("t('agreementUx.acceptedNotApproved')"));
  expect(
    '12 no Approved partner after accept copy',
    !steps.includes('Verified partner') && !en.becomeOwner.agreementUx.acceptedTitle.includes('Approved'),
  );
  expect(
    '13 commercial from onboarding.commercialTerms',
    steps.includes('onboarding?.commercialTerms') && steps.includes('commissionPercent'),
  );
  expect(
    '14 no invented commission calculator',
    !steps.includes('commission *') && !steps.includes('calculateCommission'),
  );
  expect(
    '15 commercial_terms is admin approve gate not submit',
    /canSubmit =[\s\S]*!unresolvedChanges[\s\S]*canOwnerSubmitOnboarding/.test(service) &&
      /canApprove =[\s\S]*commercialTermsReady/.test(service),
  );
}

console.log('\n— Review summaries —');
{
  expect('16 review panel', steps.includes('partner-step-review-panel'));
  expect('17 entity summary section', steps.includes('partner-review-section-entity'));
  expect('18 contact summary section', steps.includes('partner-review-section-contact'));
  expect('19 documents summary uses partnerDocumentUiState', steps.includes('partnerDocumentUiState'));
  expect('20 uploaded != accepted states in model', model.includes("'uploaded'") && model.includes("'accepted'"));
  expect('21 rejected docs -> needs_attention', model.includes("reviewStatus === 'rejected'") && model.includes("'needs_attention'"));
  expect('22 payout masked in review', steps.includes('partner-review-iban-masked') && steps.includes('ibanMasked'));
  expect('23 payout UI saved != reviewed', model.includes("'saved'") && model.includes("'reviewed'"));
  expect('24 full IBAN never in review markup', !/partner-review[\s\S]*payout\.iban[^M]/.test(steps));
  expect('25 agreement summary uses hasAcceptedCurrent', /partner-review-section-agreement[\s\S]*hasAcceptedCurrentPartnerAgreement/.test(steps));
}

console.log('\n— Applicant readiness / navigation —');
{
  expect('26 APPLICANT_SUBMIT_MISSING_KEYS excludes admin approved', model.includes('APPLICANT_SUBMIT_MISSING_KEYS') && !model.includes("'required_documents_approved'"));
  expect('27 applicantSubmitMissingKeys filters readiness', model.includes('applicantSubmitMissingKeys'));
  expect(
    '28 review complete only when canSubmit',
    /const review = view\.readiness\.canSubmit/.test(model),
  );
  expect(
    '29 opening review does not auto-complete',
    !view.includes("setCompletion") && !model.includes('reviewVisited'),
  );
  expect(
    '30 100% = section completion / ready to submit not approved',
    model.includes('partnerProgressPercent') &&
      !en.becomeOwner.reviewUx.readyHint.toLowerCase().includes('approved partner'),
  );
  expect('31 missing profile -> entity/contact', model.includes("key === 'profile'") && model.includes("completion.entity ? 'contact' : 'entity'"));
  expect('32 missing docs -> documents', model.includes("key === 'required_documents'") && model.includes("return 'documents'"));
  expect('33 missing payout -> payout', model.includes("key === 'payout_profile'") && model.includes("return 'payout'"));
  expect('34 missing agreement -> agreement', model.includes("key === 'agreement'") && model.includes("return 'agreement'"));
  expect('35 edit/complete buttons in review', steps.includes('partner-review-edit-') && steps.includes("t('reviewUx.complete')"));
  expect('36 applicantVsAdmin note', steps.includes('partner-review-applicant-vs-admin'));
  expect('37 submit disabled when !canSubmit', steps.includes('!onboarding.readiness.canSubmit'));
}

console.log('\n— Submit / status machine —');
{
  expect('38 submit uses submitPartnerOnboarding', view.includes('submitPartnerOnboarding('));
  expect('39 submit endpoint /owner/onboarding/submit', apiPartner.includes('/owner/onboarding/submit') && routes.includes('/onboarding/submit'));
  expect(
    '40 client never PATCHes verificationStatus',
    !view.includes('verificationStatus:') && !steps.includes('verificationStatus:'),
  );
  expect('41 nextStatusOnSubmit -> submitted', machine.includes('PartnerVerificationStatus.submitted'));
  {
    const submitStart = service.indexOf('export async function submitPartnerOnboarding');
    const submitEnd = service.indexOf('export async function putPartnerPayoutProfile');
    const submitFn = submitStart >= 0 && submitEnd > submitStart ? service.slice(submitStart, submitEnd) : '';
    expect(
      '42 submit does not set User.role owner',
      Boolean(submitFn) && !/role:\s*['\"]owner['\"]/.test(submitFn) && !submitFn.includes('user.update'),
    );
  }
  expect(
    '43 submit sets OwnerStatus.pending',
    /submitPartnerOnboarding[\s\S]*status: OwnerStatus\.pending/.test(service),
  );
  expect('44 double submit blocked by canOwnerSubmitOnboarding', machine.includes('canOwnerSubmitOnboarding') && service.includes('nextStatusOnSubmit'));
  expect('45 after submit wizard closes', view.includes('setWizardOpen(false)'));
  expect('46 status panel for submitted', statusPanel.includes("status === 'submitted'") && statusPanel.includes('statusUx.submittedTitle'));
  expect('47 no fake SLA promise', statusPanel.includes('statusUx.noSla') && !en.becomeOwner.statusUx.submittedBody.includes('24 hours'));
  expect('48 under_review status-only path', model.includes("'under_review'") && machine.includes('nextStatusOnAdminReviewStart'));
  expect('49 changes_requested editable', model.includes("'changes_requested'") && machine.includes('canOwnerEditOnboarding'));
  expect('50 resubmit via same submit endpoint', service.includes('nextStatusOnSubmit') && apiPartner.includes('/owner/onboarding/submit'));
}

console.log('\n— Safety / freeze / i18n —');
{
  expect('51 no OTP', !view.toLowerCase().includes('otp') && !steps.toLowerCase().includes('otp'));
  expect('52 Add Farm wizard untouched marker', addFarmWizard.includes('add-farm-wizard'));
  expect('53 approved redirect intact', entry.includes('isApprovedOwnerForAddFarm'));
  expect('54 no schema invent for reviewComplete', !prisma.includes('reviewComplete') && !prisma.includes('wizardComplete'));
  expect('55 EN agreementUx + reviewUx', Boolean(en.becomeOwner.agreementUx?.stepHint) && Boolean(en.becomeOwner.reviewUx?.submitCta));
  expect('56 AR agreementUx + reviewUx', Boolean(ar.becomeOwner.agreementUx?.stepHint) && Boolean(ar.becomeOwner.reviewUx?.submitCta));
  expect(
    '57 submit CTA wording',
    en.becomeOwner.reviewUx.submitCta === 'Submit application for review' &&
      ar.becomeOwner.reviewUx.submitCta === 'إرسال الطلب للمراجعة',
  );
  expect(
    '58 step titles',
    en.becomeOwner.steps.agreement === 'Agreement' &&
      en.becomeOwner.steps.review === 'Review application' &&
      ar.becomeOwner.steps.agreement === 'الاتفاقية' &&
      ar.becomeOwner.steps.review === 'مراجعة الطلب',
  );
  expect('59 no storageKey / ibanCipher in UI', !steps.includes('storageKey') && !steps.includes('ibanCipher'));
  expect('60 agreement content scrollable + focusable', steps.includes('partner-agreement-content') && steps.includes('tabIndex={0}'));
  expect('61 what happens next section', steps.includes('partner-review-what-next'));
  expect('62 versionChanged warning', steps.includes('partner-agreement-version-refresh'));
  expect(
    '63 canSubmit excludes document/payout approval',
    (() => {
      const normalized = service.replace(/\r\n/g, '\n');
      const blocks = [...normalized.matchAll(/const canSubmit =([\s\S]*?);/g)].map((m) => m[1]);
      return (
        blocks.length > 0 &&
        blocks.every(
          (b) =>
            b.includes('requiredDocumentsComplete') &&
            b.includes('payoutProfileComplete') &&
            b.includes('agreementAccepted') &&
            !b.includes('requiredDocumentsApproved') &&
            !b.includes('payoutProfileApproved'),
        )
      );
    })(),
  );
  expect('64 ONBOARDING_INCOMPLETE mapped safely', view.includes("err.code === 'ONBOARDING_INCOMPLETE'") && view.includes("t('missingHint')"));
  expect('65 accept requires checkbox before persist', view.includes("t('agreementUx.mustAccept')"));
}

console.log(`\nPO-5 Partner agreement/review/submit QA: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
