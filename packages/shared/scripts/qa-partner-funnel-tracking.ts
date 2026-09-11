/**
 * PF-4 — Partner application tracking + changes_requested UX.
 * Run: cd apps/api && pnpm exec dotenv -e ../../.env -- tsx ../../packages/shared/scripts/qa-partner-funnel-tracking.ts
 */
import { readdirSync, readFileSync } from 'node:fs';
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
const statusPanel = read(
  'apps/web/src/components/become-owner/partner-onboarding/partner-status-panel.tsx',
);
const view = read('apps/web/src/components/become-owner/become-owner-view.tsx');
const stepsUi = read(
  'apps/web/src/components/become-owner/partner-onboarding/partner-wizard-steps.tsx',
);
const onboardingSvc = read('apps/api/src/services/partner-onboarding.service.ts');
const adminSvc = read('apps/api/src/services/partner-admin.service.ts');
const machine = read('apps/api/src/lib/partner-verification-machine.ts');
const schema = read('packages/db/prisma/schema.prisma');
const envExample = read('.env.example');
const en = JSON.parse(read('apps/web/messages/en.json'));
const ar = JSON.parse(read('apps/web/messages/ar.json'));
const migrations = readdirSync(join(root, 'packages/db/prisma/migrations'));
const landing = read(
  'apps/web/src/components/become-owner/partner-onboarding/partner-entry-landing.tsx',
);

console.log('\n=== PF-4 Partner Funnel Tracking ===\n');

console.log('— Status mapping / timeline —');
{
  expect('1 derivePartnerTrackingTimeline', model.includes('derivePartnerTrackingTimeline'));
  expect('2 submitted → received current', model.includes("received = 'current'") || /submitted[\s\S]*received = 'current'/.test(model));
  expect('3 under_review milestone', model.includes("'under_review'"));
  expect('4 changes_requested requires_action', model.includes("'requires_action'"));
  expect('5 approved decision approved', model.includes("decision = 'approved'"));
  expect('6 rejected decision rejected', model.includes("decision = 'rejected'"));
  expect('7 suspended distinct copy', Boolean(ar.becomeOwner.tracking?.suspendedTitle));
  expect('8 no new PartnerVerificationStatus enum values', !schema.includes('awaiting_docs') && !schema.includes('partner_tracking'));
  expect('9 timeline uses real status', statusPanel.includes('derivePartnerTrackingTimeline(status)'));
  expect('10 farm_setup marketplace group', model.includes("group: 'marketplace'") && model.includes("'farm_setup'"));
  expect('11 publish future only', model.includes("'publish'") && model.includes("state: 'future'"));
  expect('12 no fake review time copy', !String(ar.becomeOwner.tracking?.underReviewBody ?? '').includes('24') && !String(en.becomeOwner.tracking?.underReviewBody ?? '').includes('24 hours'));
  expect('13 AR submitted title', ar.becomeOwner.tracking.submittedTitle === 'تم استلام طلبك');
  expect('14 AR changes title', ar.becomeOwner.tracking.changesTitle.includes('إجراء'));
  expect('15 AR approved title', ar.becomeOwner.tracking.approvedTitle.includes('شريك'));
  expect('16 EN approved not listing claim', String(en.becomeOwner.tracking.approvalNotListing).toLowerCase().includes('does not mean'));
}

console.log('\n— Change requests —');
{
  expect('17 openChangeRequests on DTO', onboardingSvc.includes('openChangeRequests'));
  expect('18 no schema change for openChangeRequests field', !schema.includes('openChangeRequests'));
  expect('19 derivePartnerCorrectionActions', model.includes('derivePartnerCorrectionActions'));
  expect('20 stepForPartnerChangeFieldKey', model.includes('stepForPartnerChangeFieldKey'));
  expect('21 document: → documents', /document:[\s\S]*return 'documents'/.test(model));
  expect('22 payout fieldKey → review (PF-5 post-approval)', /isPayoutRelatedPartnerFieldKey[\s\S]*return 'review'/.test(model) || model.includes("payout: 'review'"));
  expect('23 agreement → review', /agreement[\s\S]*return 'review'/.test(model));
  expect('24 about → entity', model.includes("return 'entity'"));
  expect('25 details → contact', model.includes("return 'contact'"));
  expect('26 no standalone agreement step', !stepsUi.includes("currentStep === 'agreement'"));
  expect('27 correction list UI', statusPanel.includes('partner-correction-list'));
  expect('28 document deep link CTA', statusPanel.includes('partner-correction-cta-'));
  expect('29 multiple actions count', statusPanel.includes('tracking.actionsCount'));
  expect('30 admin still creates change requests', adminSvc.includes('ownerOnboardingChangeRequest.create'));
}

console.log('\n— Resubmit / editability / routing —');
{
  expect('31 resubmit CTA', statusPanel.includes('partner-resubmit') && statusPanel.includes('tracking.resubmitCta'));
  expect('32 resubmit gated on canSubmit', statusPanel.includes('readiness.canSubmit'));
  expect('33 editable draft|changes_requested', model.includes("'draft'") && model.includes("'changes_requested'"));
  expect('34 no auto redirect Add Farm on become-owner', !view.includes("router.replace('/owner/properties/new')"));
  expect('35 approved Add Farm CTA', statusPanel.includes('partner-go-add-farm'));
  expect('36 approval != listing copy', statusPanel.includes('partner-approval-not-listing'));
  expect('37 existing farms My Farms CTA', statusPanel.includes('partner-go-my-farms'));
  expect('38 changes_requested tracking first', view.includes('isChangesRequested && !wizardOpen') || view.includes('isChangesRequested && !wizardOpen'.replace(/\s/g, '')) || view.includes('(isChangesRequested && !wizardOpen)'));
  expect('39 back to tracking', view.includes('partner-back-to-tracking'));
  expect('40 timeline testid', statusPanel.includes('partner-tracking-timeline'));
}

console.log('\n— Regressions / freezes —');
{
  expect('41 no Partner payout wizard step', !stepsUi.includes('partner-step-payout-panel'));
  expect('42 agreement in Review', stepsUi.includes('partner-review-section-agreement'));
  expect('43 private R2', onboardingSvc.includes('private-storage'));
  expect('44 PF-1 hero', landing.includes('partner-acquisition-hero'));
  expect('45 PF-2 lazy GET', onboardingSvc.includes('findOwnerOnboarding') && onboardingSvc.includes('started: false'));
  expect('46 four wizard steps', /'entity',\s*'contact',\s*'documents',\s*'review'/.test(model));
  expect('47 no PF-4 migration', !migrations.some((m) => /pf-?4|tracking/i.test(m)));
  expect('48 no env invent', !envExample.includes('PARTNER_TRACKING') && !envExample.includes('PF4'));
  expect('49 status machine untouched markers', machine.includes('OWNER_SUBMIT_FROM') && machine.includes('changes_requested'));
  expect('50 owner-application-status testid preserved', statusPanel.includes('owner-application-status'));
  expect('51 partner-status-chip preserved', statusPanel.includes('partner-status-chip'));
  expect('52 legacy_approved maps as approved UI', statusPanel.includes("status === 'legacy_approved'") && !String(ar.becomeOwner.tracking.approvedTitle).toLowerCase().includes('legacy'));
  expect(
    '53 suspended has no Add Farm CTA branch',
    !statusPanel.includes("status === 'suspended'") ||
      !/suspended[\s\S]{0,200}partner-go-add-farm/.test(statusPanel),
  );
  expect('53b Add Farm only under isApproved block', /isApproved \? \([\s\S]*partner-go-add-farm/.test(statusPanel));
  expect('54 rejected no reapply CTA invent', !statusPanel.includes('reapply') && !statusPanel.includes('Apply again'));
}

console.log(`\nPF-4 Tracking QA: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
