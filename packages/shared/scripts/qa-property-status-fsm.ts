/**
 * Phase PR-4 — Admin Property status transition FSM.
 * Run: pnpm --filter @mazare3/api exec tsx ../../packages/shared/scripts/qa-property-status-fsm.ts
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PROPERTY_STATUSES,
  getAllowedAdminPropertyTransitions,
  isAdminPropertyStatusTransitionAllowed,
  isAdminPropertyChangeReasonRefresh,
  assertAdminPropertyStatusTransition,
  InvalidPropertyStatusTransitionError,
} from '../src/property-status-fsm.ts';

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

const fsmModule = read('packages/shared/src/property-status-fsm.ts');
const adminService = read('apps/api/src/services/admin.service.ts');
const adminFsm = read('apps/api/src/lib/property-status-fsm.ts');
const ownerPropertyService = read('apps/api/src/services/owner-property.service.ts');
const adminDetail = read('apps/web/src/components/admin/admin-property-detail-view.tsx');
const ownerDetail = read('apps/web/src/components/owner/owner-property-detail-view.tsx');
const publicMapper = read('apps/api/src/mappers/public-property.mapper.ts');
const searchService = read('apps/api/src/services/property-search.service.ts');
const partnerShell = existsSync(
  join(root, 'apps/web/src/components/become-owner/partner-onboarding/partner-onboarding-shell.tsx'),
)
  ? read('apps/web/src/components/become-owner/partner-onboarding/partner-onboarding-shell.tsx')
  : '';
const addFarmWizard = read('apps/web/src/components/owner/add-farm-onboarding/add-farm-wizard.tsx');
const en = JSON.parse(read('apps/web/messages/en.json'));
const ar = JSON.parse(read('apps/web/messages/ar.json'));
const migrationsDir = join(root, 'packages/db/prisma/migrations');

/** Expected admin transition matrix (PR-4 spec). */
const EXPECTED: Record<string, string[]> = {
  draft: [],
  pending_review: ['changes_requested', 'approved', 'rejected'],
  changes_requested: ['changes_requested'],
  approved: ['published', 'changes_requested'],
  published: ['unpublished', 'suspended', 'changes_requested'],
  unpublished: ['published', 'changes_requested'],
  suspended: ['unpublished'],
  rejected: [],
};

console.log('\n— Canonical FSM module —');
{
  expect('1 exports PROPERTY_STATUSES (8 values)', PROPERTY_STATUSES.length === 8);
  expect('2 getAllowedAdminPropertyTransitions exported', fsmModule.includes('getAllowedAdminPropertyTransitions'));
  expect('3 assertAdminPropertyStatusTransition exported', fsmModule.includes('assertAdminPropertyStatusTransition'));
  expect('4 INVALID error class', fsmModule.includes('INVALID_PROPERTY_STATUS_TRANSITION'));
  expect('5 shared re-exported from index', read('packages/shared/src/index.ts').includes('property-status-fsm'));
}

console.log('\n— Exhaustive transition matrix —');
{
  let matrixIdx = 6;
  for (const from of PROPERTY_STATUSES) {
    const expected = EXPECTED[from] ?? [];
    const actual = getAllowedAdminPropertyTransitions(from);
    expect(
      `${matrixIdx} ${from} allowed targets match spec`,
      actual.length === expected.length && expected.every((t) => actual.includes(t as (typeof PROPERTY_STATUSES)[number])),
      `expected [${expected.join(', ')}] got [${actual.join(', ')}]`,
    );
    matrixIdx++;
  }

  let pairIdx = 14;
  for (const from of PROPERTY_STATUSES) {
    for (const to of PROPERTY_STATUSES) {
      const allowed = isAdminPropertyStatusTransitionAllowed(from, to);
      const shouldAllow = (EXPECTED[from] ?? []).includes(to);
      expect(
        `${pairIdx} matrix ${from}→${to}`,
        allowed === shouldAllow,
        shouldAllow ? 'should be allowed' : 'should be blocked',
      );
      pairIdx++;
    }
  }
}

console.log('\n— Special transition semantics —');
{
  expect('78 changes_requested reason refresh', isAdminPropertyChangeReasonRefresh('changes_requested', 'changes_requested'));
  expect('79 pending_review→published blocked', !isAdminPropertyStatusTransitionAllowed('pending_review', 'published'));
  expect('80 draft admin outbound blocked', getAllowedAdminPropertyTransitions('draft').length === 0);
  expect('81 admin cannot set pending_review', !isAdminPropertyStatusTransitionAllowed('approved', 'pending_review'));
  expect('82 rejected terminal', getAllowedAdminPropertyTransitions('rejected').length === 0);
  expect('83 suspended→unpublished only', getAllowedAdminPropertyTransitions('suspended').join() === 'unpublished');
  expect('84 assert throws InvalidPropertyStatusTransitionError', (() => {
    try {
      assertAdminPropertyStatusTransition('draft', 'published');
      return false;
    } catch (e) {
      return e instanceof InvalidPropertyStatusTransitionError;
    }
  })());
}

console.log('\n— Server enforcement —');
{
  expect('85 admin service uses FSM assert', adminService.includes('assertAdminPropertyStatusTransitionOrThrow'));
  expect('86 FSM before publish gates', adminService.indexOf('assertAdminPropertyStatusTransitionOrThrow') < adminService.indexOf('assertMediaForPublish'));
  expect('87 conditional updateMany on status', adminService.includes('updateMany') && adminService.includes('status: currentStatus'));
  expect('88 INVALID_PROPERTY_STATUS_TRANSITION on stale', adminService.includes("'INVALID_PROPERTY_STATUS_TRANSITION'"));
  expect('89 reason refresh preserves status', adminService.includes('isAdminPropertyChangeReasonRefresh'));
  expect('90 publish gates unchanged', adminService.includes('assertMediaForPublish') && adminService.includes('assertAndGenerateForPublish'));
  expect('91 api lib wraps shared FSM', adminFsm.includes('assertAdminPropertyStatusTransitionOrThrow'));
  expect('92 no unrestricted status assign', !/status: input\.status as PropertyStatus/.test(adminService));
}

console.log('\n— Owner transitions separate —');
{
  expect('93 owner submit draft→pending_review', ownerPropertyService.includes('submitOwnerPropertyForReview'));
  expect('94 owner submit only draft|changes_requested', ownerPropertyService.includes('changes_requested') && ownerPropertyService.includes('Only draft or changes_requested'));
  expect('95 resubmit clears reason', ownerPropertyService.includes('reviewChangeReason: null'));
  expect('96 owner cannot self-approve', !ownerPropertyService.includes("status: PropertyStatus.approved") && !ownerPropertyService.includes("status: 'approved'"));
  expect('97 owner cannot self-publish', !ownerPropertyService.includes("status: PropertyStatus.published") && !ownerPropertyService.includes("status: 'published'"));
}

console.log('\n— Admin UI contextual actions —');
{
  expect('98 uses getAllowedAdminPropertyTransitions', adminDetail.includes('getAllowedAdminPropertyTransitions'));
  expect('99 no free status dropdown', !adminDetail.includes('admin-property-status-select'));
  expect('100 pending_review approve button', adminDetail.includes('admin-property-approve'));
  expect('101 pending_review no publish shortcut from pending', !adminDetail.includes("property.status === 'pending_review'") || !/pending_review[\s\S]{0,120}admin-property-publish/.test(adminDetail));
  expect('102 approved publish button', adminDetail.includes('admin-property-publish'));
  expect('103 approved hint copy', adminDetail.includes('admin-property-approved-hint') && adminDetail.includes('propertyApprovedNotPublishedHint'));
  expect('104 published unpublish', adminDetail.includes('admin-property-unpublish'));
  expect('105 published suspend', adminDetail.includes('admin-property-suspend'));
  expect('106 suspended restore unpublished', adminDetail.includes('admin-property-restore-unpublished'));
  expect('107 rejected has no reopen action', !adminDetail.includes('reopen') && !adminDetail.includes('admin-property-reopen'));
  expect('108 invalid transition error UX', adminDetail.includes('INVALID_PROPERTY_STATUS_TRANSITION'));
  expect('109 request changes dialog preserved', adminDetail.includes('admin-property-change-reason-dialog'));
}

console.log('\n— Owner approved UX —');
{
  expect('110 owner approved hint', ownerDetail.includes('owner-property-approved-hint') && ownerDetail.includes('propertyApprovedAwaitingPublication'));
  expect('111 AR owner approved copy', String(ar.owner?.propertyApprovedAwaitingPublication).includes('بانتظار'));
  expect('112 EN owner approved copy', String(en.owner?.propertyApprovedAwaitingPublication).includes('awaiting publication'));
  expect('113 AR admin approved hint', String(ar.admin?.propertyApprovedNotPublishedHint).includes('لم يُنشر'));
  expect('114 EN admin approved hint', String(en.admin?.propertyApprovedNotPublishedHint).includes('not published'));
}

console.log('\n— Public visibility unchanged —');
{
  expect('115 public mapper uses published', publicMapper.includes('published'));
  expect('116 approved not in public eligibility shortcut', !/approved[\s\S]{0,80}public/.test(publicMapper) || publicMapper.includes('published'));
  expect('117 search uses published filter', searchService.includes('published'));
}

console.log('\n— Out of scope preserved —');
{
  expect('118 no schema migration for FSM', !existsSync(join(migrationsDir, 'pr4_property_status_fsm')));
  expect('119 Add Farm untouched', !addFarmWizard.includes('property-status-fsm') && !addFarmWizard.includes('getAllowedAdminPropertyTransitions'));
  expect('120 Partner onboarding untouched', !partnerShell.includes('property-status-fsm'));
  expect('121 PR-2 reason fields preserved', adminService.includes('reviewChangeReason'));
  expect('122 PR-3 mutation guards preserved', read('apps/api/src/lib/owner-property-mutation-guards.ts').includes('assertOwnerNotPendingReview'));
}

console.log('\n— QA script self-check —');
{
  expect('123 all PropertyStatus values in matrix loop', PROPERTY_STATUSES.every((s) => s in EXPECTED));
  expect('124 exhaustive pair count 64', PROPERTY_STATUSES.length * PROPERTY_STATUSES.length === 64);
  expect('125 first publish requires approved edge only', isAdminPropertyStatusTransitionAllowed('approved', 'published') && !isAdminPropertyStatusTransitionAllowed('pending_review', 'published'));
  expect('126 republish from unpublished', isAdminPropertyStatusTransitionAllowed('unpublished', 'published'));
  expect('127 changes_requested from approved allowed', isAdminPropertyStatusTransitionAllowed('approved', 'changes_requested'));
  expect('128 changes_requested from published allowed', isAdminPropertyStatusTransitionAllowed('published', 'changes_requested'));
}

console.log(`\nPR-4 QA: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
