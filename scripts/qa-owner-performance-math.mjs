/**
 * Phase 10C.2D — Owner-approval performance metric formulas (no API).
 */

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

function close(a, b) {
  return Math.abs(a - b) < 1e-9;
}

function rate(numerator, denominator) {
  if (denominator === 0) return null;
  return numerator / denominator;
}

function compute(rows) {
  const accepted = rows.filter((r) => r.ownerDecisionOutcome === 'accepted').length;
  const rejected = rows.filter((r) => r.ownerDecisionOutcome === 'rejected').length;
  const timedOut = rows.filter((r) => r.ownerDecisionOutcome === 'timed_out').length;
  const awaitingDecision = rows.filter(
    (r) => r.status === 'pending_owner_approval' && !r.ownerDecisionOutcome,
  ).length;
  const responded = accepted + rejected;
  const resolved = accepted + rejected + timedOut;
  const responseMs = [];
  for (const row of rows) {
    if (row.ownerDecisionOutcome !== 'accepted' && row.ownerDecisionOutcome !== 'rejected') continue;
    if (!row.createdAt || !row.ownerDecisionAt) continue;
    responseMs.push(row.ownerDecisionAt.getTime() - row.createdAt.getTime());
  }
  return {
    awaitingDecision,
    accepted,
    rejected,
    timedOut,
    responded,
    resolved,
    responseRate: rate(responded, resolved),
    acceptanceRate: rate(accepted, responded),
    rejectionRate: rate(rejected, responded),
    timeoutRate: rate(timedOut, resolved),
    averageResponseMinutes:
      responseMs.length === 0
        ? null
        : responseMs.reduce((sum, ms) => sum + ms, 0) / responseMs.length / 60_000,
  };
}

const rows = [
  {
    status: 'pending_payment',
    ownerDecisionOutcome: 'accepted',
    createdAt: new Date('2026-08-01T10:00:00Z'),
    ownerDecisionAt: new Date('2026-08-01T10:10:00Z'),
  },
  {
    status: 'cancelled',
    ownerDecisionOutcome: 'rejected',
    createdAt: new Date('2026-08-01T10:00:00Z'),
    ownerDecisionAt: new Date('2026-08-01T10:20:00Z'),
  },
  {
    status: 'expired',
    ownerDecisionOutcome: 'timed_out',
    createdAt: new Date('2026-08-01T10:00:00Z'),
    ownerDecisionAt: null,
  },
  {
    status: 'pending_owner_approval',
    ownerDecisionOutcome: null,
    createdAt: new Date('2026-08-01T10:00:00Z'),
    ownerDecisionAt: null,
  },
];

const m = compute(rows);
if (m.awaitingDecision === 1) pass('pending excluded from resolved denominators');
else fail('pending', m.awaitingDecision);

if (m.accepted === 1 && m.rejected === 1 && m.timedOut === 1 && m.responded === 2 && m.resolved === 3) {
  pass('count buckets');
} else fail('counts', JSON.stringify(m));

if (close(m.responseRate, 2 / 3)) pass('responseRate = responded / resolved');
else fail('responseRate', m.responseRate);

if (close(m.acceptanceRate, 1 / 2)) pass('acceptanceRate = accepted / responded');
else fail('acceptanceRate', m.acceptanceRate);

if (close(m.rejectionRate, 1 / 2)) pass('rejectionRate = rejected / responded');
else fail('rejectionRate', m.rejectionRate);

if (close(m.timeoutRate, 1 / 3)) pass('timeoutRate = timedOut / resolved');
else fail('timeoutRate', m.timeoutRate);

if (close(m.averageResponseMinutes, 15)) pass('average response minutes (10 + 20) / 2');
else fail('averageResponseMinutes', m.averageResponseMinutes);

const empty = compute([]);
if (
  empty.responseRate == null &&
  empty.acceptanceRate == null &&
  empty.rejectionRate == null &&
  empty.timeoutRate == null &&
  empty.averageResponseMinutes == null
) {
  pass('zero denominators return null');
} else fail('null rates', JSON.stringify(empty));

const laterExpired = compute([
  {
    status: 'expired',
    ownerDecisionOutcome: 'accepted',
    createdAt: new Date('2026-08-01T10:00:00Z'),
    ownerDecisionAt: new Date('2026-08-01T10:05:00Z'),
  },
]);
if (laterExpired.accepted === 1 && laterExpired.timedOut === 0) {
  pass('accepted-then-expired still counts as accepted');
} else fail('accepted later expired', JSON.stringify(laterExpired));

console.log(`\n10C.2D math: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
