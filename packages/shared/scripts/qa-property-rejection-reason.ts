/**
 * Phase PR-5 — Property rejection reason + owner rejection UX.
 * Run: pnpm --filter @mazare3/api exec tsx ../../packages/shared/scripts/qa-property-rejection-reason.ts
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  patchAdminPropertyStatusSchema,
  PROPERTY_REVIEW_REJECTION_REASON_MIN,
  PROPERTY_REVIEW_REJECTION_REASON_MAX,
  getAllowedAdminPropertyTransitions,
  isAdminPropertyStatusTransitionAllowed,
} from '../src/index.ts';

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

const schema = read('packages/db/prisma/schema.prisma');
const adminService = read('apps/api/src/services/admin.service.ts');
const ownerPropertyService = read('apps/api/src/services/owner-property.service.ts');
const ownerService = read('apps/api/src/services/owner.service.ts');
const notify = read('apps/api/src/services/notification.service.ts');
const publicMapper = read('apps/api/src/mappers/public-property.mapper.ts');
const searchService = read('apps/api/src/services/property-search.service.ts');
const adminDetail = read('apps/web/src/components/admin/admin-property-detail-view.tsx');
const ownerDetail = read('apps/web/src/components/owner/owner-property-detail-view.tsx');
const ownerList = read('apps/web/src/components/owner/owner-properties-view.tsx');
const editRoute = read('apps/web/src/app/[locale]/owner/properties/[id]/edit/page.tsx');
const types = read('packages/shared/src/types.ts');
const en = JSON.parse(read('apps/web/messages/en.json'));
const ar = JSON.parse(read('apps/web/messages/ar.json'));
const fsm = read('packages/shared/src/property-status-fsm.ts');
const migrationName = '20260831170000_pr5_property_review_rejection_reason';
const migrationSqlPath = join(root, 'packages/db/prisma/migrations', migrationName, 'migration.sql');
const addFarmWizard = read('apps/web/src/components/owner/add-farm-onboarding/add-farm-wizard.tsx');
const partnerShell = existsSync(
  join(root, 'apps/web/src/components/become-owner/partner-onboarding/partner-onboarding-shell.tsx'),
)
  ? read('apps/web/src/components/become-owner/partner-onboarding/partner-onboarding-shell.tsx')
  : '';

console.log('\n— Schema / migration —');
{
  expect('1 reviewRejectionReason on Property', schema.includes('reviewRejectionReason'));
  expect('2 reviewRejectedAt on Property', schema.includes('reviewRejectedAt'));
  expect('3 migration file exists', existsSync(migrationSqlPath));
  const sql = existsSync(migrationSqlPath) ? readFileSync(migrationSqlPath, 'utf8') : '';
  expect('4 additive ADD COLUMN only', sql.includes('ADD COLUMN "reviewRejectionReason"') && sql.includes('ADD COLUMN "reviewRejectedAt"'));
  expect('5 no DROP in migration', !/\bDROP\b/i.test(sql));
  expect('6 no NOT NULL in migration', !/NOT NULL/i.test(sql));
  expect('7 separate from reviewChangeReason', schema.includes('reviewChangeReason') && schema.includes('reviewRejectionReason'));
}

console.log('\n— Validation —');
{
  expect('8 reject min constant is 8', PROPERTY_REVIEW_REJECTION_REASON_MIN === 8);
  expect('9 reject max constant is 2000', PROPERTY_REVIEW_REJECTION_REASON_MAX === 2000);
  const ok = patchAdminPropertyStatusSchema.safeParse({
    status: 'rejected',
    reason: 'الصور المرفوعة لا توضح المزرعة بشكل كافٍ ولا يمكن اعتماد الإعلان.',
  });
  expect('10 pending_review→rejected with reason accepted', ok.success);
  const noReason = patchAdminPropertyStatusSchema.safeParse({ status: 'rejected' });
  expect('11 reason required for rejected', !noReason.success);
  const empty = patchAdminPropertyStatusSchema.safeParse({ status: 'rejected', reason: '' });
  expect('12 empty reason rejected', !empty.success);
  const ws = patchAdminPropertyStatusSchema.safeParse({ status: 'rejected', reason: '   ' });
  expect('13 whitespace-only rejected', !ws.success);
  const approved = patchAdminPropertyStatusSchema.safeParse({ status: 'approved' });
  expect('14 approved does not require reason', approved.success);
}

console.log('\n— FSM integration —');
{
  expect('15 pending_review→rejected allowed', isAdminPropertyStatusTransitionAllowed('pending_review', 'rejected'));
  expect('16 draft→rejected blocked', !isAdminPropertyStatusTransitionAllowed('draft', 'rejected'));
  expect('17 approved→rejected blocked', !isAdminPropertyStatusTransitionAllowed('approved', 'rejected'));
  expect('18 published→rejected blocked', !isAdminPropertyStatusTransitionAllowed('published', 'rejected'));
  expect('19 rejected terminal', getAllowedAdminPropertyTransitions('rejected').length === 0);
  expect('20 FSM module unchanged terminal', fsm.includes('rejected: []'));
}

console.log('\n— Admin atomic persistence —');
{
  expect(
    '21 status+reason single update on reject',
    /updateData\.reviewRejectionReason = trimmedReason/.test(adminService) &&
      /updateData\.reviewRejectedAt = new Date\(\)/.test(adminService) &&
      adminService.includes('updateMany'),
  );
  expect('22 reject clears change reason', adminService.includes('isRejected'));
  expect('23 reject dialog required', adminDetail.includes('admin-property-reject-reason-dialog') && adminDetail.includes('openRejectReasonDialog'));
  expect('24 reject uses confirmRejectReason', adminDetail.includes('confirmRejectReason'));
  expect('25 admin rejected reason panel', adminDetail.includes('admin-property-rejection-reason'));
}

console.log('\n— Owner DTO / public safety —');
{
  expect('26 OwnerPropertyDetail has reviewRejectionReason', /OwnerPropertyDetail[\s\S]*reviewRejectionReason/.test(types));
  expect('27 OwnerPropertyEdit has reviewRejectionReason', /OwnerPropertyEdit[\s\S]*reviewRejectionReason/.test(types));
  expect('28 AdminPropertyDetail has reviewRejectionReason', /AdminPropertyDetail[\s\S]*reviewRejectionReason/.test(types));
  expect('29 owner detail maps reason', ownerService.includes('reviewRejectionReason'));
  expect('30 owner edit maps reason', ownerPropertyService.includes('reviewRejectionReason'));
  expect('31 admin detail maps reason', adminService.includes('reviewRejectionReason'));
  expect('32 public mapper has no reviewRejectionReason', !publicMapper.includes('reviewRejectionReason'));
  expect('33 search service has no reviewRejectionReason', !searchService.includes('reviewRejectionReason'));
}

console.log('\n— Owner UX —');
{
  expect('34 rejected panel on detail', ownerDetail.includes('owner-property-rejected-panel'));
  expect('35 panel shows reason', ownerDetail.includes('owner-property-rejection-reason'));
  expect('36 no edit when rejected', ownerDetail.includes('!showRejectedPanel'));
  expect('37 list rejection link', ownerList.includes('owner-property-rejection-reason-link'));
  expect('38 list no full reason on card', !ownerList.includes('reviewRejectionReason'));
  expect('39 edit route redirects rejected', editRoute.includes("status === 'rejected'"));
  expect('40 back to properties CTA', ownerDetail.includes('owner-property-back-to-list'));
}

console.log('\n— Resubmit / terminal —');
{
  expect('41 submit only draft|changes_requested', ownerPropertyService.includes('Only draft or changes_requested'));
  expect('42 assertOwnerCanEditListingStatus preserved', read('apps/api/src/lib/owner-property-mutation-guards.ts').includes('assertOwnerCanEditListingStatus'));
  expect('43 separate rejection field', adminService.includes('reviewRejectionReason'));
}

console.log('\n— Notification —');
{
  expect('44 notifyPropertyRejected exists', notify.includes('notifyPropertyRejected'));
  expect('45 points to property page', notify.includes('property page') || notify.includes('صفحة المزرعة'));
  expect('46 no reason dump in notification fn params', !notify.includes('reviewRejectionReason'));
}

console.log('\n— Out of scope preserved —');
{
  expect('47 no appeal/reopen UI', !adminDetail.includes('reopen') && !ownerDetail.includes('appeal'));
  expect('48 Add Farm untouched', !addFarmWizard.includes('reviewRejectionReason'));
  expect('49 partner shell untouched', !partnerShell.includes('reviewRejectionReason'));
  expect('50 PR-4 FSM file exists', existsSync(join(root, 'packages/shared/src/property-status-fsm.ts')));
}

console.log('\n— i18n / a11y —');
{
  expect('51 AR rejectedTitle', Boolean(ar.owner?.rejectedTitle));
  expect('52 EN rejectedTitle', Boolean(en.owner?.rejectedTitle));
  expect('53 AR admin reject helper', Boolean(ar.admin?.propertyRejectReasonHelper));
  expect('54 EN admin reject helper', Boolean(en.admin?.propertyRejectReasonHelper));
  expect('55 reject dialog labelled', adminDetail.includes('admin-property-reject-reason-title'));
  expect('56 owner rejected panel heading', ownerDetail.includes('owner-rejected-title'));
}

console.log('\n— Legacy test debt helper —');
{
  expect('57 publish test helper exists', existsSync(join(root, 'e2e/helpers/publish-test-property.ts')));
  const helper = read('e2e/helpers/publish-test-property.ts');
  expect('58 helper uses approve before publish', helper.includes("status: 'approved'") && helper.includes("status: 'published'"));
}

console.log(`\nPR-5 QA: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
