/**
 * Read-only payment integrity counts. Prints aggregates only — no PII / no secrets.
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '../packages/db/generated/client/index.js';

function loadRootEnvKeys() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const text = readFileSync(resolve(root, '.env'), 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1);
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key && process.env[key] == null) process.env[key] = value;
  }
}

loadRootEnvKeys();
const prisma = new PrismaClient();

function n(v) {
  return typeof v === 'number' ? v : Number(v);
}

async function main() {
  const [
    bookings,
    payments,
    payoutsNotFullyPaid,
  ] = await Promise.all([
    prisma.booking.findMany({
      select: {
        id: true,
        paymentCollectionMode: true,
        remainingAmount: true,
        depositAmount: true,
        customerPayableTotal: true,
        paymentState: true,
        createdAt: true,
      },
    }),
    prisma.payment.findMany({
      select: {
        id: true,
        bookingId: true,
        purpose: true,
        status: true,
        amount: true,
        customerPayableAmount: true,
        payoutStatus: true,
      },
    }),
    prisma.payment.count({
      where: {
        payoutStatus: { in: ['eligible', 'pending', 'paid'] },
        booking: { paymentState: { not: 'fully_paid' } },
      },
    }),
  ]);

  const fullMode = bookings.filter((b) => b.paymentCollectionMode === 'full').length;
  const depositMode = bookings.filter((b) => b.paymentCollectionMode === 'deposit_balance').length;
  const fullZeroRemaining = bookings.filter(
    (b) => b.paymentCollectionMode === 'full' && n(b.remainingAmount) === 0,
  ).length;
  const legacyRemainingNonZero = bookings.filter(
    (b) => b.paymentCollectionMode === 'full' && n(b.remainingAmount) !== 0,
  ).length;
  const newBookingsMissingSnapshot = bookings.filter(
    (b) =>
      b.paymentCollectionMode === 'deposit_balance' &&
      (b.depositAmount == null || b.remainingAmount == null || b.customerPayableTotal == null),
  ).length;

  const succeeded = payments.filter((p) => p.status === 'succeeded');
  const succeededFullPurpose = succeeded.filter((p) => p.purpose === 'full').length;
  const oldPaymentsNotFull = payments.filter((p) => {
    const b = bookings.find((row) => row.id === p.bookingId);
    return b?.paymentCollectionMode === 'full' && p.purpose !== 'full';
  }).length;
  const missingPurpose = payments.filter((p) => p.purpose == null).length;
  const mixedFullOnDeposit = succeeded.filter((p) => {
    const b = bookings.find((row) => row.id === p.bookingId);
    return b?.paymentCollectionMode === 'deposit_balance' && p.purpose === 'full';
  }).length;
  const capturedByBooking = new Map();
  for (const p of succeeded) {
    const amt = n(p.customerPayableAmount ?? p.amount);
    capturedByBooking.set(p.bookingId, (capturedByBooking.get(p.bookingId) ?? 0) + amt);
  }
  let overCaptured = 0;
  for (const b of bookings) {
    const cap = capturedByBooking.get(b.id) ?? 0;
    const due = n(b.customerPayableTotal);
    if (due > 0 && cap > due + 0.009) overCaptured++;
  }

  console.log('\n📊 Payment integrity (counts only)\n');
  console.log(`  bookings_total=${bookings.length} full_mode=${fullMode} deposit_mode=${depositMode}`);
  console.log(`  legacy_full_remaining_zero=${fullZeroRemaining}/${fullMode}`);
  console.log(`  legacy_full_remaining_nonzero=${legacyRemainingNonZero}`);
  console.log(`  payments_total=${payments.length} succeeded=${succeeded.length} succeeded_purpose_full=${succeededFullPurpose}`);
  console.log(`  payments_null_purpose=${missingPurpose}`);
  console.log(`  full_mode_payments_not_purpose_full=${oldPaymentsNotFull}`);
  console.log(`  new_bookings_missing_snapshot=${newBookingsMissingSnapshot}`);
  console.log(`  over_captured_bookings=${overCaptured}`);
  console.log(`  payout_eligible_or_pending_or_paid_without_fully_paid=${payoutsNotFullyPaid}`);
  console.log(`  mixed_full_purpose_on_deposit_mode=${mixedFullOnDeposit}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
