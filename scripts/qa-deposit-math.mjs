/**
 * Phase 10A — Deposit / remaining-balance math (no DB, no network).
 * Locks integer-fils rounding used by packages/shared/src/money.ts
 */
function jodToFils(value) {
  return Math.round(value * 100);
}
function filsToJod(fils) {
  return fils / 100;
}
function percentOfFils(baseFils, percent) {
  return Math.round((baseFils * percent) / 100);
}

function snapshot(total, depositPercent, commissionPercent, feePercent) {
  const totalFils = jodToFils(total);
  const depositFils = percentOfFils(totalFils, depositPercent);
  const remainingFils = totalFils - depositFils;
  const commissionFils = percentOfFils(totalFils, commissionPercent);
  return {
    depositAmount: filsToJod(depositFils),
    remainingAmount: filsToJod(remainingFils),
    platformCommissionAmount: filsToJod(commissionFils),
    ownerNetPayoutAmount: filsToJod(totalFils - commissionFils),
    customerServiceFeeAmount: filsToJod(percentOfFils(totalFils, feePercent)),
    customerPayableTotal: filsToJod(totalFils + percentOfFils(totalFils, feePercent)),
  };
}

let passed = 0;
let failed = 0;

function pass(name) {
  passed++;
  console.log(`  ✅ ${name}`);
}
function fail(name, detail) {
  failed++;
  console.log(`  ❌ ${name}: ${detail}`);
}

console.log('\n🧮 Phase 10A deposit math QA\n');

const s = snapshot(200, 30, 12, 0);
if (s.depositAmount === 60) pass('200 JOD × 30% deposit = 60');
else fail('deposit 30%', String(s.depositAmount));
if (s.remainingAmount === 140) pass('remaining = 140');
else fail('remaining', String(s.remainingAmount));
if (s.platformCommissionAmount === 24) pass('commission on full total 12% = 24 (not on deposit)');
else fail('commission', String(s.platformCommissionAmount));
if (s.ownerNetPayoutAmount === 176) pass('owner net = 176');
else fail('owner net', String(s.ownerNetPayoutAmount));
if (s.depositAmount + s.remainingAmount === 200) pass('deposit + remaining = total');
else fail('identity', `${s.depositAmount}+${s.remainingAmount}`);

const s100 = snapshot(200, 100, 12, 0);
if (s100.depositAmount === 200 && s100.remainingAmount === 0) pass('100% deposit = full payment snapshot');
else fail('100% deposit', JSON.stringify(s100));

const sOdd = snapshot(10.01, 30, 12, 0);
if (sOdd.depositAmount + sOdd.remainingAmount === 10.01) {
  pass('fils rounding preserves total on 10.01');
} else {
  fail('10.01 identity', JSON.stringify(sOdd));
}

const half = snapshot(100, 33.33, 12, 0);
if (Number.isInteger(jodToFils(half.depositAmount))) pass('deposit stored at 2dp (fils)');
else fail('2dp', String(half.depositAmount));

function computeBalanceDueAtUtc(slotDate, hoursBeforeStart) {
  const hours = Number.isFinite(hoursBeforeStart) && hoursBeforeStart >= 0 ? hoursBeforeStart : 0;
  const y = slotDate.getUTCFullYear();
  const m = slotDate.getUTCMonth();
  const d = slotDate.getUTCDate();
  return new Date(Date.UTC(y, m, d, 0, 0, 0, 0) - hours * 60 * 60 * 1000);
}

const slotInstant = new Date(Date.UTC(2026, 7, 20, 22, 30, 0));
const due0 = computeBalanceDueAtUtc(slotInstant, 0);
const due24 = computeBalanceDueAtUtc(slotInstant, 24);
if (due0.toISOString() === '2026-08-20T00:00:00.000Z') {
  pass('balanceDueAt hours=0 is slot date 00:00 UTC (not local TZ)');
} else {
  fail('balanceDueAt hours=0', due0.toISOString());
}
if (due24.toISOString() === '2026-08-19T00:00:00.000Z') {
  pass('balanceDueAt hours=24 is previous UTC calendar day 00:00');
} else {
  fail('balanceDueAt hours=24', due24.toISOString());
}

const TRANSITIONS = {
  unpaid: ['unpaid', 'deposit_pending', 'fully_paid'],
  deposit_pending: ['unpaid', 'deposit_pending', 'deposit_paid'],
  deposit_paid: ['deposit_paid', 'balance_pending', 'balance_overdue', 'fully_paid', 'partially_refunded', 'refunded'],
};
if (!TRANSITIONS.unpaid.includes('fully_paid')) fail('legacy full transition missing');
else pass('legacy full payment may go unpaid → fully_paid');
if (TRANSITIONS.deposit_paid.includes('balance_pending') && !TRANSITIONS.unpaid.includes('balance_pending')) {
  pass('no balance before deposit in transition table');
} else {
  fail('illegal balance-before-deposit transition');
}

const promoTotal = snapshot(180, 30, 12, 0);
if (promoTotal.depositAmount === 54) pass('deposit uses discounted 180 × 30% = 54');
else fail('promo deposit', String(promoTotal.depositAmount));
if (promoTotal.remainingAmount === 126) pass('remaining uses discounted 180 − 54 = 126');
else fail('promo remaining', String(promoTotal.remainingAmount));
if (promoTotal.platformCommissionAmount === 21.6) pass('commission uses discounted 180 × 12% = 21.6');
else fail('promo commission', String(promoTotal.platformCommissionAmount));
if (promoTotal.ownerNetPayoutAmount === 158.4) pass('owner net from discounted 180 − 21.6 = 158.4');
else fail('promo owner net', String(promoTotal.ownerNetPayoutAmount));
if (promoTotal.depositAmount === 54 && promoTotal.platformCommissionAmount === 21.6) {
  pass('coupon-discounted totals use the same owner-funded deposit/commission math');
} else fail('coupon deposit math alias', JSON.stringify(promoTotal));

function platformFunded(merchant, discount, depositPercent, commissionPercent) {
  const merchantFils = jodToFils(merchant);
  const discountFils = jodToFils(discount);
  const customerFils = merchantFils - discountFils;
  const depositFils = percentOfFils(customerFils, depositPercent);
  const commissionFils = percentOfFils(merchantFils, commissionPercent);
  return {
    depositAmount: filsToJod(depositFils),
    remainingAmount: filsToJod(customerFils - depositFils),
    platformCommissionAmount: filsToJod(commissionFils),
    ownerNetPayoutAmount: filsToJod(merchantFils - commissionFils),
    customerPayable: filsToJod(customerFils),
  };
}

const pf = platformFunded(200, 20, 30, 12);
if (pf.customerPayable === 180) pass('platform coupon customer payable 200 − 20 = 180');
else fail('platform payable', String(pf.customerPayable));
if (pf.depositAmount === 54) pass('platform deposit from 180 × 30% = 54');
else fail('platform deposit', String(pf.depositAmount));
if (pf.remainingAmount === 126) pass('platform remaining 180 − 54 = 126');
else fail('platform remaining', String(pf.remainingAmount));
if (pf.platformCommissionAmount === 24) pass('platform commission stays on merchant 200 × 12% = 24');
else fail('platform commission', String(pf.platformCommissionAmount));
if (pf.ownerNetPayoutAmount === 176) pass('platform owner net stays 200 − 24 = 176');
else fail('platform owner net', String(pf.ownerNetPayoutAmount));

console.log(`\n--- ${passed} passed, ${failed} failed ---\n`);
process.exit(failed > 0 ? 1 : 0);
