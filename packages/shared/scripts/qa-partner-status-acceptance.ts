/**
 * Phase PO-6 — Partner status lifecycle + acceptance.
 * Run: cd apps/api && pnpm exec tsx ../../packages/shared/scripts/qa-partner-status-acceptance.ts
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

const machine = read('apps/api/src/lib/partner-verification-machine.ts');
const admin = read('apps/api/src/services/partner-admin.service.ts');
const onboarding = read('apps/api/src/services/partner-onboarding.service.ts');
const routesAdmin = read('apps/api/src/routes/admin.ts');
const routesOwner = read('apps/api/src/routes/owner.ts');
const statusPanel = read(
  'apps/web/src/components/become-owner/partner-onboarding/partner-status-panel.tsx',
);
const becomeOwner = read('apps/web/src/components/become-owner/become-owner-view.tsx');
const model = read(
  'apps/web/src/components/become-owner/partner-onboarding/partner-onboarding-model.ts',
);
const ownerGuard = read('apps/web/src/components/owner/owner-guard.tsx');
const entry = read('apps/web/src/lib/add-farm-entry.ts');
const addFarmWizard = read(
  'apps/web/src/components/owner/add-farm-onboarding/add-farm-wizard.tsx',
);
const apiPartner = read('apps/web/src/lib/api-partner.ts');
const prisma = read('packages/db/prisma/schema.prisma');
const en = JSON.parse(read('apps/web/messages/en.json'));
const ar = JSON.parse(read('apps/web/messages/ar.json'));
const envSample = (() => {
  try {
    return read('.env');
  } catch {
    return '';
  }
})();

console.log('\n— Environment safety —');
{
  const appEnv = /APP_ENV=(\w+)/.exec(envSample)?.[1] ?? '';
  const nodeEnv = /NODE_ENV=(\w+)/.exec(envSample)?.[1] ?? '';
  expect(
    '0 local/dev environment for mutations',
    appEnv === 'local' || nodeEnv === 'development' || appEnv === 'development',
    `APP_ENV=${appEnv} NODE_ENV=${nodeEnv}`,
  );
}

console.log('\n— Status machine —');
{
  expect(
    '1 editable draft|changes_requested only',
    machine.includes('PartnerVerificationStatus.draft') &&
      machine.includes('PartnerVerificationStatus.changes_requested') &&
      machine.includes('const EDITABLE:') &&
      !/const EDITABLE:[\s\S]{0,200}submitted/.test(machine),
  );
  expect('2 submit from draft|changes_requested', machine.includes('OWNER_SUBMIT_FROM'));
  expect('3 nextStatusOnSubmit → submitted', machine.includes('PartnerVerificationStatus.submitted'));
  expect('4 admin review start submitted→under_review', machine.includes('nextStatusOnAdminReviewStart'));
  expect('5 assertOwnerCanEdit throws ONBOARDING_READ_ONLY', machine.includes('ONBOARDING_READ_ONLY'));
}

console.log('\n— Submitted / under review UX —');
{
  expect('6 submitted status panel title key', statusPanel.includes('tracking.submittedTitle'));
  expect('7 under_review status panel', statusPanel.includes('tracking.underReviewTitle'));
  expect('8 EN submitted truthful', /received|submitted/i.test(en.becomeOwner.tracking.submittedTitle));
  expect('9 AR submitted', ar.becomeOwner.tracking.submittedTitle === 'تم استلام طلبك');
  expect('9b tracking timeline', statusPanel.includes('partner-tracking-timeline'));
  expect('9c return later hint', statusPanel.includes('statusUx.returnLaterHint'));
  expect('9d awaiting review label for submitted card', statusPanel.includes('statusUx.awaitingReview'));
  expect('10 AR under review', ar.becomeOwner.tracking.underReviewTitle === 'طلبك قيد المراجعة');
  expect('11 EN under review', /under review/i.test(en.becomeOwner.tracking.underReviewTitle));
  expect('12 no fake SLA 24h', !JSON.stringify(en.becomeOwner.tracking).includes('24 hours') && !JSON.stringify(ar.becomeOwner.tracking).includes('24 ساعة'));
  expect('13 pending hides wizard', becomeOwner.includes('showStatusOnly') && becomeOwner.includes('PENDING_PARTNER_STATUSES'));
  expect(
    '14 submitted not editable statuses',
    /EDITABLE_PARTNER_STATUSES[^=]*=\s*\[[^\]]*draft[^\]]*changes_requested[^\]]*\]/.test(model) &&
      !/EDITABLE_PARTNER_STATUSES[^=]*=\s*\[[^\]]*submitted/.test(model),
  );
}

console.log('\n— Changes requested —');
{
  expect('15 request-changes route', routesAdmin.includes('/partners/:id/request-changes'));
  expect('16 requestPartnerChanges service', admin.includes('requestPartnerChanges'));
  expect('17 sets changes_requested', admin.includes('PartnerVerificationStatus.changes_requested'));
  expect('18 applicant sees change reasons', statusPanel.includes('partner-correction-list') && onboarding.includes('changeRequestReason: v.changeRequestReason') && onboarding.includes('openChangeRequests'));
  expect(
    '19 applicant DTO has no audit/admin notes dump',
    !onboarding.includes('auditRows') &&
      !/buildOnboardingView[\s\S]{0,2000}createdByUserId/.test(onboarding),
  );
  expect('20 continue correction CTA', statusPanel.includes('partner-continue-correction'));
  expect('21 changes_requested editable', model.includes("'changes_requested'"));
}

console.log('\n— Corrections / resubmit —');
{
  expect('22 document supersede on replace', onboarding.includes('superseded') || onboarding.includes('supersede'));
  expect('23 payout reviewReason to applicant for correction', onboarding.includes('reviewReason:'));
  expect('24 submit endpoint reused', apiPartner.includes('/owner/onboarding/submit') && routesOwner.includes('/onboarding/submit'));
  expect('25 nextStatusOnSubmit on resubmit', onboarding.includes('nextStatusOnSubmit'));
  expect('26 submit clears changeRequestReason', /changeRequestReason: null/.test(onboarding));
  expect('27 agreement accept current-id gate', model.includes('hasAcceptedCurrentPartnerAgreement'));
}

console.log('\n— Admin approval gates —');
{
  expect(
    '28 canApprove needs docs approved + commercial (payout post-approval)',
    /canApprove =[\s\S]*requiredDocumentsApproved[\s\S]*commercialTermsReady/.test(onboarding) &&
      !/canApprove =[\s\S]*?payoutProfileApproved\s*&&/.test(onboarding),
  );
  expect('29 approvePartner uses canApprove', admin.includes('readiness.canApprove'));
  expect('30 approve route', routesAdmin.includes('/partners/:id/approve'));
  expect(
    '31 approve atomic transaction role+verification+owner',
    /approvePartner[\s\S]*\$transaction[\s\S]*verificationStatus: PartnerVerificationStatus.approved[\s\S]*OwnerStatus.approved[\s\S]*UserRole.owner/.test(
      admin,
    ),
  );
  expect('32 no Property create in approvePartner', !/approvePartner[\s\S]{0,1200}property\.create/i.test(admin));
  expect('33 rejectPartner service', admin.includes('rejectPartner'));
  expect('34 suspendPartner service', admin.includes('suspendPartner'));
}

console.log('\n— Session / Add Farm handoff —');
{
  expect('35 become-owner refreshSession on approved', becomeOwner.includes('refreshSession'));
  expect(
    '36 approved shows tracking success then Add Farm CTA (no forced redirect)',
    !becomeOwner.includes("router.replace('/owner/properties/new')") &&
      statusPanel.includes('partner-go-add-farm') &&
      statusPanel.includes('tracking.approvedTitle'),
  );
  expect('37 isApprovedOwnerForAddFarm', entry.includes('isApprovedOwnerForAddFarm'));
  expect('38 resolveAddFarmHref approved → wizard', entry.includes("'/owner/properties/new'"));
  expect('39 partner go add farm CTA', statusPanel.includes('partner-go-add-farm'));
  expect('40 approved title EN', /approved/i.test(en.becomeOwner.approvedTitle));
  expect('41 approved title AR', ar.becomeOwner.approvedTitle.includes('قبول') || ar.becomeOwner.approvedTitle.includes('اعتماد'));
  expect('42 goToAddFarm EN', en.becomeOwner.goToAddFarm === 'Add your first property');
  expect('43 goToAddFarm AR', ar.becomeOwner.goToAddFarm === 'أضف أول مزرعة');
}

console.log('\n— Deep link / security —');
{
  expect('44 Add Farm deep-link helper', ownerGuard.includes('isAddFarmDeepLink'));
  expect('45 non-owner Add Farm → become-owner', /role !== 'owner'[\s\S]{0,350}become-owner/.test(ownerGuard));
  expect('46 OwnerGuard still requires approved for children', ownerGuard.includes("ps === 'approved'"));
  expect('47 customers never setState allowed', !/role !== 'owner'[\s\S]{0,200}setState\('allowed'\)/.test(ownerGuard));
  expect('48 Add Farm wizard unchanged marker', addFarmWizard.includes('add-farm-wizard'));
}

console.log('\n— Duplicate / privacy / freeze —');
{
  expect('49 single OwnerVerificationProfile model', prisma.includes('model OwnerVerificationProfile'));
  expect('50 no OTP', !becomeOwner.toLowerCase().includes('otp') && !statusPanel.toLowerCase().includes('otp'));
  expect('51 no schema invent reviewComplete', !prisma.includes('reviewComplete'));
  expect('52 payout masked in onboarding DTO', onboarding.includes('ibanMasked:') && onboarding.includes("beneficiaryNameMasked: '••••'"));
  expect('53 no ibanCipher to applicant view', !/ibanCipher/.test(onboarding.match(/buildOnboardingView[\s\S]*return \{/)?.[0] ?? '') || !onboarding.includes('ibanCipher:'));
  expect('54 verification labels localized EN', Boolean(en.becomeOwner.verification?.submitted));
  expect('55 verification labels localized AR', Boolean(ar.becomeOwner.verification?.submitted));
  expect('56 markUnderReview on document review', admin.includes('markUnderReview'));
  expect('57 double submit blocked by machine', machine.includes('CANNOT_SUBMIT'));
  expect(
    '58 changes_requested canSubmit not blocked by open change rows',
    onboarding.includes('unresolvedBlocksSubmit') &&
      onboarding.includes('PartnerVerificationStatus.changes_requested'),
  );
}

console.log(`\nPO-6 Partner status acceptance QA: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
