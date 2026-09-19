/**
 * Phase 3C.4E.3 — Real DB concurrency stress for holding-slot exclusivity.
 * Run: pnpm qa:booking-slot-concurrency
 *
 * Creates temporary fixtures, races 10 concurrent holding inserts on ONE slot,
 * then races non-conflicting inserts on DIFFERENT slots. Cleans up after.
 */
import {
  prisma,
  BookingStatus,
  BookingPaymentState,
  PaymentCollectionMode,
  AvailabilitySlotStatus,
  AvailabilityPeriod,
} from '@mazare3/db';
import { randomBytes } from 'node:crypto';

function code() {
  return `S3${randomBytes(4).toString('hex').toUpperCase()}`;
}

function baseBookingData(params: {
  userId: string;
  propertyId: string;
  availabilitySlotId: string;
  status: BookingStatus;
  publicCode: string;
}) {
  return {
    publicCode: params.publicCode,
    userId: params.userId,
    propertyId: params.propertyId,
    availabilitySlotId: params.availabilitySlotId,
    guestsCount: 2,
    totalAmount: 100,
    currency: 'JOD',
    status: params.status,
    paymentCollectionMode: PaymentCollectionMode.deposit_balance,
    paymentState: BookingPaymentState.unpaid,
    depositPercent: 30,
    depositAmount: 30,
    remainingAmount: 70,
    platformCommissionPercent: 18,
    platformCommissionAmount: 18,
    ownerNetPayoutAmount: 82,
    customerServiceFeeAmount: 0,
    customerPayableTotal: 100,
    originalSlotPrice: 100,
  };
}

async function main() {
  console.log('\nPhase 3C.4E.3 Booking Slot Concurrency\n');

  const index = await prisma.$queryRaw<Array<{ indexname: string }>>`
    SELECT indexname FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'Booking_one_holding_per_availability_slot'
  `;
  if (index.length === 0) {
    console.error('FAIL: partial unique index missing — apply migration first');
    process.exit(2);
  }
  console.log('  ✅ index Booking_one_holding_per_availability_slot present');

  const user = await prisma.user.findFirst({
    where: { status: 'active' },
    select: { id: true },
  });
  const property = await prisma.property.findFirst({
    where: { status: 'published' },
    select: { id: true },
  });
  if (!user || !property) {
    console.error('SKIP: need active user + published property');
    process.exit(0);
  }

  const stamp = Date.now();
  const raceDate = new Date();
  raceDate.setUTCFullYear(raceDate.getUTCFullYear() + 3);
  raceDate.setUTCMonth(0, 15);
  raceDate.setUTCHours(0, 0, 0, 0);

  const raceSlot = await prisma.availabilitySlot.create({
    data: {
      propertyId: property.id,
      date: raceDate,
      period: AvailabilityPeriod.morning,
      price: 100,
      status: AvailabilitySlotStatus.available,
    },
  });

  const otherSlots = [];
  for (let i = 0; i < 5; i++) {
    const d = new Date(raceDate);
    d.setUTCDate(d.getUTCDate() + 1 + i);
    otherSlots.push(
      await prisma.availabilitySlot.create({
        data: {
          propertyId: property.id,
          date: d,
          period: AvailabilityPeriod.evening,
          price: 100,
          status: AvailabilitySlotStatus.available,
        },
      }),
    );
  }

  const createdIds: string[] = [];
  const cleanup = async () => {
    if (createdIds.length) {
      await prisma.booking.deleteMany({ where: { id: { in: createdIds } } });
    }
    await prisma.availabilitySlot.deleteMany({
      where: { id: { in: [raceSlot.id, ...otherSlots.map((s) => s.id)] } },
    });
  };

  try {
    // 10-way race on SAME slot
    const attempts = Array.from({ length: 10 }, (_, i) =>
      prisma.booking
        .create({
          data: baseBookingData({
            userId: user.id,
            propertyId: property.id,
            availabilitySlotId: raceSlot.id,
            status: BookingStatus.pending_payment,
            publicCode: `${code()}${i}`,
          }),
        })
        .then((b) => {
          createdIds.push(b.id);
          return { ok: true as const, id: b.id };
        })
        .catch((err: { code?: string }) => {
          if (err?.code === 'P2002') return { ok: false as const, code: 'P2002' };
          throw err;
        }),
    );

    const results = await Promise.all(attempts);
    const wins = results.filter((r) => r.ok).length;
    const losses = results.filter((r) => !r.ok).length;
    console.log(`  same-slot race: wins=${wins} losses=${losses}`);
    if (wins !== 1 || losses !== 9) {
      console.error('FAIL: expected exactly 1 winner and 9 conflicts');
      await cleanup();
      process.exit(1);
    }
    console.log('  ✅ 10-way concurrency: 1 success, 9 conflicts');

    // Holding count must be 1
    const holders = await prisma.booking.count({
      where: {
        availabilitySlotId: raceSlot.id,
        status: { in: ['pending_payment', 'pending_owner_approval', 'pending', 'confirmed'] },
      },
    });
    if (holders !== 1) {
      console.error('FAIL: holder count', holders);
      await cleanup();
      process.exit(1);
    }
    console.log('  ✅ exactly one holding Booking on raced slot');

    // Cancelled does not block — set winner cancelled, insert another
    const winnerId = (results.find((r) => r.ok) as { ok: true; id: string }).id;
    await prisma.booking.update({
      where: { id: winnerId },
      data: { status: BookingStatus.cancelled, cancelledAt: new Date() },
    });
    const afterCancel = await prisma.booking.create({
      data: baseBookingData({
        userId: user.id,
        propertyId: property.id,
        availabilitySlotId: raceSlot.id,
        status: BookingStatus.confirmed,
        publicCode: code(),
      }),
    });
    createdIds.push(afterCancel.id);
    console.log('  ✅ cancelled release allows new holding Booking');

    // Different slots concurrent — all should succeed
    const multi = await Promise.all(
      otherSlots.map((s, i) =>
        prisma.booking.create({
          data: baseBookingData({
            userId: user.id,
            propertyId: property.id,
            availabilitySlotId: s.id,
            status: BookingStatus.confirmed,
            publicCode: `${code()}D${i}`,
          }),
        }),
      ),
    );
    createdIds.push(...multi.map((b) => b.id));
    console.log(`  ✅ ${multi.length} concurrent different-slot Bookings succeeded`);

    // Different property same date/period allowed (create second property slot if needed)
    const otherProp = await prisma.property.findFirst({
      where: { status: 'published', id: { not: property.id } },
      select: { id: true },
    });
    if (otherProp) {
      const otherPropSlot = await prisma.availabilitySlot.create({
        data: {
          propertyId: otherProp.id,
          date: raceDate,
          period: AvailabilityPeriod.morning,
          price: 90,
          status: AvailabilitySlotStatus.available,
        },
      });
      const cross = await prisma.booking.create({
        data: baseBookingData({
          userId: user.id,
          propertyId: otherProp.id,
          availabilitySlotId: otherPropSlot.id,
          status: BookingStatus.confirmed,
          publicCode: code(),
        }),
      });
      createdIds.push(cross.id);
      await prisma.booking.delete({ where: { id: cross.id } });
      await prisma.availabilitySlot.delete({ where: { id: otherPropSlot.id } });
      console.log('  ✅ different Property same calendar slot allowed');
    } else {
      console.log('  ⚠ skip cross-property (only one published property)');
    }

    console.log('\nConcurrency QA OK\n');
  } finally {
    await cleanup();
    await prisma.$disconnect();
  }
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
