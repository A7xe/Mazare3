import { prisma, type UserRole } from '@mazare3/db';
import {
  computeOwnerPerformanceMetrics,
  isOwnerPerformanceRange,
  ownerPerformanceRangeStart,
  type OwnerPerformanceMetrics,
  type OwnerPerformanceRange,
} from '@mazare3/shared';
import { AppError } from '../lib/errors.js';
import { resolveOwnerScope } from './owner-access.js';

export function parseOwnerPerformanceRange(raw: unknown): OwnerPerformanceRange {
  const value = typeof raw === 'string' && raw.length ? raw : '30d';
  if (!isOwnerPerformanceRange(value)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'range must be 30d, 90d, or all');
  }
  return value;
}

async function metricsForOwnerProfile(
  ownerProfileId: string,
  range: OwnerPerformanceRange,
): Promise<OwnerPerformanceMetrics> {
  const from = ownerPerformanceRangeStart(range);
  const rows = await prisma.booking.findMany({
    where: {
      instantBookingEnabled: false,
      property: { ownerId: ownerProfileId },
      ...(from ? { createdAt: { gte: from } } : {}),
    },
    select: {
      status: true,
      ownerDecisionOutcome: true,
      createdAt: true,
      ownerDecisionAt: true,
      depositPaidAt: true,
      paymentState: true,
    },
  });
  return computeOwnerPerformanceMetrics(rows, range);
}

export async function getOwnerPerformance(
  userId: string,
  role: UserRole,
  rangeRaw: unknown,
): Promise<OwnerPerformanceMetrics> {
  const range = parseOwnerPerformanceRange(rangeRaw);
  const scope = await resolveOwnerScope(userId, role);
  if (!scope.ownerProfileId) {
    throw new AppError(400, 'OWNER_SCOPE_REQUIRED', 'Owner performance is scoped to a partner account');
  }
  return metricsForOwnerProfile(scope.ownerProfileId, range);
}

export async function getAdminPartnerPerformance(
  ownerProfileId: string,
  rangeRaw: unknown,
): Promise<OwnerPerformanceMetrics> {
  const range = parseOwnerPerformanceRange(rangeRaw);
  const profile = await prisma.ownerProfile.findUnique({
    where: { id: ownerProfileId },
    select: { id: true },
  });
  if (!profile) throw new AppError(404, 'NOT_FOUND', 'Partner not found');
  return metricsForOwnerProfile(ownerProfileId, range);
}
