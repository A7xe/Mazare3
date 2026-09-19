/**
 * PF-6 — Narrow payout-readiness settlement mark-paid guard.
 * Run: cd apps/api && pnpm exec dotenv -e ../../.env -- tsx ../../packages/shared/scripts/qa-owner-payout-settlement-guard.ts
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

const readiness = read('apps/api/src/lib/owner-payout-readiness.ts');
const settlement = read('apps/api/src/services/owner-settlement.service.ts');
const payoutOps = read('apps/api/src/services/payout-operations.service.ts');
const adminSettlements = read('apps/web/src/components/admin/admin-partner-settlements.tsx');
const partnerOnboarding = read('apps/api/src/services/partner-onboarding.service.ts');
const schema = read('packages/db/prisma/schema.prisma');

console.log('\n=== PF-6 Owner payout settlement guard ===\n');

console.log('— Derived readiness —');
expect(
  '1 readiness states',
  readiness.includes('not_configured') &&
    readiness.includes('pending_review') &&
    readiness.includes('ready') &&
    readiness.includes('needs_attention'),
);
expect(
  '2 isOwnerPayoutReady uses reviewed',
  readiness.includes('OwnerPayoutReviewStatus.reviewed') ||
    readiness.includes("result: 'READY'") ||
    readiness.includes("=== 'ready'"),
);
expect('3 assert throws PAYOUT_DESTINATION_REQUIRED', readiness.includes('PAYOUT_DESTINATION_REQUIRED'));
expect('4 assert looks up OwnerPayoutProfile', readiness.includes('ownerPayoutProfile.findUnique'));

console.log('\n— Server mark-paid boundary —');
expect(
  '5 settlement mark-paid calls assert',
  settlement.includes('assertOwnerHasReviewedPayoutDestination') &&
    /markOwnerSettlementPaid[\s\S]*assertOwnerHasReviewedPayoutDestination/.test(settlement),
);
expect(
  '6 admin payout mark-paid calls assert',
  payoutOps.includes('assertOwnerHasReviewedPayoutDestination') &&
    /markAdminPayoutPaid[\s\S]*assertOwnerHasReviewedPayoutDestination/.test(payoutOps),
);
expect(
  '7 assert before status paid transition',
  /assertOwnerHasReviewedPayoutDestination[\s\S]*OwnerSettlementStatus\.paid/.test(settlement) ||
    /assertOwnerHasReviewedPayoutDestination[\s\S]*status: OwnerSettlementStatus\.paid/.test(settlement),
);
expect(
  '8 create/finalize settlements do not require payout destination',
  !/createOwnerSettlement[\s\S]{0,400}assertOwnerHasReviewedPayoutDestination/.test(settlement) &&
    !/finalizeOwnerSettlement[\s\S]{0,400}assertOwnerHasReviewedPayoutDestination/.test(settlement),
);

console.log('\n— Admin UX block —');
expect('9 admin payoutIncomplete copy key used', adminSettlements.includes('settlements.payoutIncomplete'));
expect('10 mark-paid disabled when !payoutReady', adminSettlements.includes('!payoutReady'));
expect('11 payoutReady prop from reviewed', adminSettlements.includes('payoutReady'));

console.log('\n— Partner vs payout separation —');
expect(
  '12 Partner canApprove without payoutProfileApproved',
  !/canApprove\s*=\s*[\s\S]*?payoutProfileApproved\s*&&/.test(partnerOnboarding),
);
expect(
  '13 Partner canSubmit without payoutProfileComplete',
  !/canSubmit\s*=\s*[\s\S]*?payoutProfileComplete\s*&&/.test(partnerOnboarding),
);
expect('14 no approved_pending_payout status', !schema.includes('approved_pending_payout'));
expect('15 OwnerPayoutReviewStatus preserved', schema.includes('enum OwnerPayoutReviewStatus'));

console.log('\n— Arithmetic freeze —');
expect(
  '16 settlement service does not invent commission rewrite near mark-paid',
  !/markOwnerSettlementPaid[\s\S]{0,800}commissionPercent\s*=/.test(settlement),
);
expect('17 readiness helper has no amount math', !/ownerNet|commissionBps|decimal/.test(readiness));

console.log(`\nPF-6 settlement guard QA: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
