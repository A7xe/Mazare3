import {
  prisma,
  AvailabilitySlotStatus,
  AvailabilityPeriod,
  CheckInStatus,
  BookingVisitOutcome,
  PropertyAuthorityReviewStatus,
  RegulatoryApplicability,
  RegulatoryComplianceStatus,
} from '@mazare3/db';
import { AppError } from '../lib/errors.js';
import { ensureRegulatoryAssessmentsForProperty } from './property-regulatory.service.js';
import { evaluatePropertyBookability } from './property-bookability.service.js';

function parseDateOnly(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d));
}

function uniquePastDate(bookingId: string, offset: number): Date {
  let hash = 0;
  for (let i = 0; i < bookingId.length; i++) hash = (hash + bookingId.charCodeAt(i) * (i + 1)) % 10007;
  return new Date(Date.UTC(1993, 0, 1 + ((hash + offset) % 2500)));
}

/**
 * QA only: move THIS booking's slot date into the past without creating a duplicate
 * (propertyId, date, period) row. Does not delete existing data.
 */
export async function qaBackdateBookingSlot(bookingId: string, dateIso?: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { slot: { select: { id: true, propertyId: true, period: true } } },
  });
  if (!booking) {
    throw new AppError(404, 'NOT_FOUND', 'Booking not found');
  }

  const candidates: Date[] = [];
  if (dateIso && /^\d{4}-\d{2}-\d{2}$/.test(dateIso)) {
    candidates.push(parseDateOnly(dateIso));
  }
  for (let i = 0; i < 80; i++) {
    candidates.push(uniquePastDate(bookingId, i));
  }

  let applied: Date | null = null;
  for (const date of candidates) {
    const clash = await prisma.availabilitySlot.findFirst({
      where: {
        propertyId: booking.slot.propertyId,
        period: booking.slot.period,
        date,
        id: { not: booking.availabilitySlotId },
      },
      select: { id: true },
    });
    if (clash) continue;
    await prisma.availabilitySlot.update({
      where: { id: booking.availabilitySlotId },
      data: { date },
    });
    applied = date;
    break;
  }

  if (!applied) {
    throw new AppError(409, 'SLOT_UNAVAILABLE', 'Could not backdate slot to a unique past date');
  }

  return { bookingId, date: applied.toISOString().slice(0, 10) };
}

/** QA only: set payoutAvailableAt in the past so admin can mark paid. */
export async function qaBackdatePayoutEligible(paymentId: string) {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    select: { id: true },
  });
  if (!payment) {
    throw new AppError(404, 'NOT_FOUND', 'Payment not found');
  }
  const past = new Date(Date.now() - 48 * 60 * 60 * 1000);
  await prisma.payment.update({
    where: { id: paymentId },
    data: { payoutAvailableAt: past },
  });
  return { paymentId, payoutAvailableAt: past.toISOString() };
}

export async function qaSetPayoutAvailableAt(paymentId: string, hoursFromNow: number) {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    select: { id: true },
  });
  if (!payment) throw new AppError(404, 'NOT_FOUND', 'Payment not found');
  const at = new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
  await prisma.payment.update({
    where: { id: paymentId },
    data: { payoutAvailableAt: at },
  });
  return { paymentId, payoutAvailableAt: at.toISOString() };
}

/**
 * QA only: return an existing future available slot, or create one unique future
 * slot for this property. Never deletes bookings or payments.
 */
export async function qaEnsureAvailableSlot(slug: string) {
  const property = await prisma.property.findFirst({
    where: { slug },
    select: { id: true, basePrice: true },
  });
  if (!property) {
    throw new AppError(404, 'NOT_FOUND', 'Property not found');
  }
  if (property.basePrice == null) {
    throw new AppError(400, 'PROPERTY_LISTING_INCOMPLETE', 'Property has no base price');
  }

  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 4));
  const existing = await prisma.availabilitySlot.findFirst({
    where: {
      propertyId: property.id,
      status: AvailabilitySlotStatus.available,
      date: { gte: from },
    },
    orderBy: { date: 'desc' },
  });
  if (existing) {
    return {
      date: existing.date.toISOString().slice(0, 10),
      period: existing.period,
      price: Number(existing.price),
    };
  }

  const stamp = Date.now();
  for (let i = 0; i < 40; i++) {
    const date = new Date(Date.UTC(2028, 0, 1 + ((stamp + i * 7) % 360)));
    const period = (
      [
        AvailabilityPeriod.morning,
        AvailabilityPeriod.evening,
        AvailabilityPeriod.full_day,
        AvailabilityPeriod.overnight,
      ] as const
    )[i % 4]!;
    const clash = await prisma.availabilitySlot.findFirst({
      where: { propertyId: property.id, date, period },
      select: { id: true, status: true, price: true, date: true, period: true },
    });
    if (clash) {
      if (clash.status === AvailabilitySlotStatus.available) {
        return {
          date: clash.date.toISOString().slice(0, 10),
          period: clash.period,
          price: Number(clash.price),
        };
      }
      continue;
    }
    try {
      const created = await prisma.availabilitySlot.create({
        data: {
          propertyId: property.id,
          date,
          period,
          price: property.basePrice,
          status: AvailabilitySlotStatus.available,
        },
      });
      return {
        date: created.date.toISOString().slice(0, 10),
        period: created.period,
        price: Number(created.price),
        created: true,
        stamp,
      };
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === 'P2002') continue;
      throw err;
    }
  }

  throw new AppError(409, 'SLOT_UNAVAILABLE', 'Could not create a unique QA availability slot');
}

/** QA only: move booking.createdAt into the past for range-filter tests. */
export async function qaBackdateBookingCreatedAt(bookingId: string, daysAgo = 40) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { id: true },
  });
  if (!booking) throw new AppError(404, 'NOT_FOUND', 'Booking not found');
  const n = Number.isFinite(daysAgo) && daysAgo > 0 ? Math.min(daysAgo, 400) : 40;
  const createdAt = new Date(Date.now() - n * 24 * 60 * 60 * 1000);
  await prisma.booking.update({
    where: { id: bookingId },
    data: { createdAt },
  });
  return { bookingId, createdAt: createdAt.toISOString() };
}

/**
 * QA only: mark a booking as a verified successful visit for review eligibility tests.
 * Does not invent financial entries.
 */
export async function qaMarkVerifiedVisit(bookingId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, visitOutcome: true },
  });
  if (!booking) throw new AppError(404, 'NOT_FOUND', 'Booking not found');

  const now = new Date();
  const updated = await prisma.booking.update({
    where: { id: bookingId },
    data: {
      checkInStatus: CheckInStatus.verified,
      checkInVerifiedAt: now,
      visitOutcome: BookingVisitOutcome.completed,
      visitOutcomeAt: now,
      visitOutcomeSource: 'qa.mark_verified_visit',
    },
    select: {
      id: true,
      checkInStatus: true,
      visitOutcome: true,
      visitOutcomeAt: true,
    },
  });
  return {
    bookingId: updated.id,
    checkInStatus: updated.checkInStatus,
    visitOutcome: updated.visitOutcome,
    visitOutcomeAt: updated.visitOutcomeAt?.toISOString() ?? null,
  };
}

/**
 * QA only: make a published Property eligible for NEW paid Booking locally.
 * Sets authority approved + minimal regulatory readiness (N/A confirmed).
 * Does not invent Customer PII or financial entries.
 */
export async function qaEnsurePropertyBookable(slug: string) {
  const property = await prisma.property.findFirst({
    where: { slug },
    select: { id: true, status: true },
  });
  if (!property) throw new AppError(404, 'NOT_FOUND', 'Property not found');

  await prisma.property.update({
    where: { id: property.id },
    data: {
      authorityReviewStatus: PropertyAuthorityReviewStatus.approved,
      authorityReviewedAt: new Date(),
      authorityAttestedAt: new Date(),
      authorityAttestationVersion: 'qa.local',
    },
  });

  const activityCount = await prisma.propertyActivity.count({
    where: { propertyId: property.id, active: true },
  });
  if (activityCount === 0) {
    await prisma.propertyActivity.create({
      data: {
        propertyId: property.id,
        activityCode: 'day_use',
        active: true,
      },
    });
  }

  await ensureRegulatoryAssessmentsForProperty(property.id);
  await prisma.propertyRegulatoryRequirement.updateMany({
    where: { propertyId: property.id },
    data: {
      applicability: RegulatoryApplicability.not_applicable_confirmed,
      complianceStatus: RegulatoryComplianceStatus.not_assessed,
      reassessmentRequired: false,
    },
  });

  const gate = await evaluatePropertyBookability(property.id, 'new_booking');
  return {
    propertyId: property.id,
    slug,
    eligible: gate.eligible,
    blockers: gate.blockers,
  };
}
