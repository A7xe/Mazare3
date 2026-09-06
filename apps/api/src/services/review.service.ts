import {
  prisma,
  BookingStatus,
  BookingPaymentState,
  ReviewStatus,
  Prisma,
} from '@mazare3/db';
import { getPlatformTimeZone, todayDateIsoInZone } from '@mazare3/shared';
import type {
  CreateReviewInput,
  HideReviewInput,
  HomePublicTestimonial,
  PropertyReviewAdminRow,
  PublicPropertyReview,
} from '@mazare3/shared';
import { AppError } from '../lib/errors.js';
import { createAuditLog } from './audit.service.js';
import { isBookingFullyPaidFromLedger, refundedFilsFromRequests, succeededInstallmentFils } from '../lib/booking-ledger.js';
import { notifyReviewInvite, notifyReviewPublished } from './notification.service.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { resolveOwnerScope } from './owner-access.js';
import type { UserRole } from '@mazare3/db';

const reviewBookingInclude = {
  slot: { select: { date: true, endAt: true } },
  payments: true,
  refundRequests: { select: { status: true, approvedAmount: true, requestedAmount: true } },
  review: true,
  property: { select: { id: true, slug: true, titleAr: true, titleEn: true, owner: { select: { userId: true } } } },
  user: { select: { id: true, name: true } },
} as const;

type ReviewBookingRow = Prisma.BookingGetPayload<{ include: typeof reviewBookingInclude }>;

export type PropertyRatingStats = { averageRating: number; reviewCount: number };

export function roundRatingForDisplay(value: number): number {
  return Math.round(value * 10) / 10;
}

export async function getPublishedReviewStats(
  propertyIds: string[],
): Promise<Map<string, PropertyRatingStats>> {
  const map = new Map<string, PropertyRatingStats>();
  if (!propertyIds.length) return map;
  const grouped = await prisma.review.groupBy({
    by: ['propertyId'],
    where: { propertyId: { in: propertyIds }, status: ReviewStatus.published },
    _avg: { rating: true },
    _count: { _all: true },
  });
  for (const row of grouped) {
    const count = row._count._all;
    const avg = row._avg.rating ?? 0;
    map.set(row.propertyId, {
      reviewCount: count,
      averageRating: count > 0 ? roundRatingForDisplay(avg) : 0,
    });
  }
  return map;
}

/** Global top-rated property ids from published reviews (not newest-catalog scoped). */
export async function listTopRatedPublicPropertyIds(params: {
  propertyWhere?: Prisma.PropertyWhereInput;
  take?: number;
  /** When set, only these property ids are considered (e.g. availability-eligible). */
  eligiblePropertyIds?: string[] | null;
}): Promise<Array<{ propertyId: string; averageRating: number; reviewCount: number }>> {
  const take = params.take ?? 16;
  const eligible =
    params.eligiblePropertyIds === null
      ? null
      : params.eligiblePropertyIds === undefined
        ? undefined
        : params.eligiblePropertyIds;
  if (eligible && eligible.length === 0) return [];

  const grouped = await prisma.review.groupBy({
    by: ['propertyId'],
    where: {
      status: ReviewStatus.published,
      ...(eligible ? { propertyId: { in: eligible } } : {}),
      property: {
        status: 'published',
        owner: { status: 'approved' },
        ...(params.propertyWhere ?? {}),
      },
    },
    _avg: { rating: true },
    _count: { _all: true },
  });
  return grouped
    .map((row) => ({
      propertyId: row.propertyId,
      reviewCount: row._count._all,
      averageRating: row._count._all > 0 ? roundRatingForDisplay(row._avg.rating ?? 0) : 0,
    }))
    .filter((row) => row.reviewCount > 0)
    .sort((a, b) => {
      if (b.averageRating !== a.averageRating) return b.averageRating - a.averageRating;
      if (b.reviewCount !== a.reviewCount) return b.reviewCount - a.reviewCount;
      return a.propertyId.localeCompare(b.propertyId);
    })
    .slice(0, take);
}

/**
 * Ordered property ids for rating_desc browse: reviewed first (avg DESC, count DESC, id),
 * then zero-review properties (id ASC). Returns one page of ids without loading full cards.
 */
export async function listPropertyIdsOrderedByPublishedRating(params: {
  propertyWhere: Prisma.PropertyWhereInput;
  skip: number;
  take: number;
}): Promise<{ ids: string[]; total: number }> {
  const total = await prisma.property.count({ where: params.propertyWhere });
  if (total === 0 || params.take <= 0) return { ids: [], total };

  const grouped = await prisma.review.groupBy({
    by: ['propertyId'],
    where: {
      status: ReviewStatus.published,
      property: params.propertyWhere,
    },
    _avg: { rating: true },
    _count: { _all: true },
  });

  const ratedSorted = grouped
    .map((row) => ({
      propertyId: row.propertyId,
      reviewCount: row._count._all,
      averageRating: row._count._all > 0 ? roundRatingForDisplay(row._avg.rating ?? 0) : 0,
    }))
    .filter((row) => row.reviewCount > 0)
    .sort((a, b) => {
      if (b.averageRating !== a.averageRating) return b.averageRating - a.averageRating;
      if (b.reviewCount !== a.reviewCount) return b.reviewCount - a.reviewCount;
      return a.propertyId.localeCompare(b.propertyId);
    })
    .map((r) => r.propertyId);

  const start = params.skip;
  const end = params.skip + params.take;
  const pageIds: string[] = [];

  if (start < ratedSorted.length) {
    pageIds.push(...ratedSorted.slice(start, end));
  }

  const need = params.take - pageIds.length;
  if (need > 0) {
    const unratedSkip = Math.max(0, start - ratedSorted.length);
    const unrated = await prisma.property.findMany({
      where: {
        ...params.propertyWhere,
        ...(ratedSorted.length ? { id: { notIn: ratedSorted } } : {}),
      },
      orderBy: { id: 'asc' },
      skip: unratedSkip,
      take: need,
      select: { id: true },
    });
    pageIds.push(...unrated.map((p) => p.id));
  }

  return { ids: pageIds, total };
}

function customerDisplayName(name: string | null | undefined): string {
  const trimmed = name?.trim();
  if (!trimmed) return 'ضيف';
  return trimmed.split(/\s+/)[0] ?? 'ضيف';
}

export function visitHasEnded(params: {
  bookingEndAt: Date | null;
  slotEndAt: Date | null;
  slotDate: Date;
  now?: Date;
}): boolean {
  const now = params.now ?? new Date();
  const today = todayDateIsoInZone(getPlatformTimeZone());
  const slotIso = params.slotDate.toISOString().slice(0, 10);
  if (slotIso < today) return true;
  if (params.bookingEndAt && params.bookingEndAt.getTime() <= now.getTime()) return true;
  if (params.slotEndAt && params.slotEndAt.getTime() <= now.getTime()) return true;
  return false;
}

function isFullyRefunded(row: {
  paymentState: string;
  payments: ReviewBookingRow['payments'];
  refundRequests: Array<{
    status: string;
    approvedAmount: { toNumber(): number } | number | null;
    requestedAmount: { toNumber(): number } | number | null;
  }>;
}): boolean {
  if (row.paymentState === BookingPaymentState.refunded) return true;
  const captured = succeededInstallmentFils(row.payments).total;
  if (captured <= 0) return false;
  return refundedFilsFromRequests(row.refundRequests) >= captured;
}

export function classifyReviewEligibility(row: {
  userId: string;
  status: BookingStatus | string;
  paymentState: BookingPaymentState | string;
  paymentCollectionMode: string;
  customerPayableTotal: { toNumber(): number } | number;
  payments: ReviewBookingRow['payments'];
  refundRequests: Array<{
    status: string;
    approvedAmount: { toNumber(): number } | number | null;
    requestedAmount: { toNumber(): number } | number | null;
  }>;
  review?: { id: string } | null;
  bookingEndAt: Date | null;
  slot: { date: Date; endAt: Date | null };
}, userId: string) {
  if (row.userId !== userId) {
    return { eligible: false as const, reason: 'not_owner' };
  }
  if (row.review) {
    return { eligible: false as const, reason: 'already_reviewed' };
  }
  if (row.status !== BookingStatus.confirmed) {
    return { eligible: false as const, reason: 'not_confirmed' };
  }
  if (
    !isBookingFullyPaidFromLedger({
      paymentState: row.paymentState,
      collectionMode: row.paymentCollectionMode,
      customerPayableTotal: row.customerPayableTotal,
      payments: row.payments,
    })
  ) {
    return { eligible: false as const, reason: 'not_fully_paid' };
  }
  if (isFullyRefunded(row)) {
    return { eligible: false as const, reason: 'fully_refunded' };
  }
  if (
    !visitHasEnded({
      bookingEndAt: row.bookingEndAt,
      slotEndAt: row.slot.endAt,
      slotDate: row.slot.date,
    })
  ) {
    return { eligible: false as const, reason: 'visit_not_ended' };
  }
  return { eligible: true as const, reason: null };
}

function mapPublicReview(row: {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: Date;
  customer: { name: string | null };
}): PublicPropertyReview {
  return {
    id: row.id,
    rating: row.rating,
    comment: row.comment,
    createdAt: row.createdAt.toISOString(),
    customerDisplayName: customerDisplayName(row.customer.name),
  };
}

function mapAdminReview(row: {
  id: string;
  bookingId: string;
  rating: number;
  comment: string | null;
  status: ReviewStatus;
  hiddenReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  booking: { publicCode: string };
  property: { id: string; slug: string; titleAr: string; titleEn: string | null };
  customer: { id: string; name: string | null };
}): PropertyReviewAdminRow {
  return {
    id: row.id,
    bookingId: row.bookingId,
    publicCode: row.booking.publicCode,
    propertyId: row.property.id,
    propertySlug: row.property.slug,
    propertyTitleAr: row.property.titleAr,
    propertyTitleEn: row.property.titleEn ?? row.property.titleAr,
    customerId: row.customer.id,
    customerDisplayName: customerDisplayName(row.customer.name),
    rating: row.rating,
    comment: row.comment,
    status: row.status,
    hiddenReason: row.hiddenReason,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listPublishedReviewsForProperty(
  propertyId: string,
  limit = 20,
): Promise<PublicPropertyReview[]> {
  const rows = await prisma.review.findMany({
    where: { propertyId, status: ReviewStatus.published },
    include: { customer: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  return rows.map(mapPublicReview);
}

const HOME_TESTIMONIAL_TAKE = 6;

/**
 * Latest published reviews with non-empty comments on publicly eligible properties.
 * Single batched query — suitable for homepage testimonials.
 */
export async function listHomePublicTestimonials(
  take = HOME_TESTIMONIAL_TAKE,
): Promise<HomePublicTestimonial[]> {
  const limit = Math.max(1, Math.min(take, 12));
  const rows = await prisma.review.findMany({
    where: {
      status: ReviewStatus.published,
      comment: { not: null },
      property: {
        status: 'published',
        owner: { status: 'approved' },
      },
    },
    include: {
      customer: { select: { name: true } },
      property: {
        select: { titleAr: true, titleEn: true, city: true },
      },
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit * 2,
  });

  const out: HomePublicTestimonial[] = [];
  for (const row of rows) {
    const comment = row.comment?.trim() ?? '';
    if (!comment) continue;
    out.push({
      id: row.id,
      rating: row.rating,
      comment,
      createdAt: row.createdAt.toISOString(),
      customerDisplayName: customerDisplayName(row.customer.name),
      propertyTitleAr: row.property.titleAr,
      propertyTitleEn: row.property.titleEn ?? row.property.titleAr,
      propertyCity: row.property.city ?? '',
    });
    if (out.length >= limit) break;
  }
  return out;
}

export async function createBookingReview(
  userId: string,
  bookingId: string,
  input: CreateReviewInput,
): Promise<{
  id: string;
  rating: number;
  comment: string | null;
  status: 'published' | 'hidden';
  createdAt: string;
}> {
  const row = await prisma.booking.findFirst({
    where: { id: bookingId },
    include: reviewBookingInclude,
  });
  if (!row) throw new AppError(404, 'NOT_FOUND', 'Booking not found');

  const verdict = classifyReviewEligibility(row, userId);
  if (!verdict.eligible) {
    const status =
      verdict.reason === 'not_owner'
        ? 403
        : verdict.reason === 'already_reviewed'
          ? 409
          : 400;
    const code =
      verdict.reason === 'not_owner'
        ? 'FORBIDDEN'
        : verdict.reason === 'already_reviewed'
          ? 'ALREADY_REVIEWED'
          : verdict.reason === 'visit_not_ended'
            ? 'VISIT_NOT_ENDED'
            : verdict.reason === 'not_fully_paid'
              ? 'NOT_FULLY_PAID'
              : verdict.reason === 'fully_refunded'
                ? 'FULLY_REFUNDED'
                : 'NOT_ELIGIBLE';
    throw new AppError(status, code, 'This booking cannot be reviewed');
  }

  try {
    const created = await prisma.review.create({
      data: {
        bookingId: row.id,
        propertyId: row.propertyId,
        customerId: userId,
        rating: input.rating,
        comment: input.comment?.trim() || null,
        status: ReviewStatus.published,
      },
    });

    void notifyReviewPublished({
      ownerUserId: row.property.owner.userId,
      propertyTitleAr: row.property.titleAr,
      rating: created.rating,
      reviewId: created.id,
    }).catch((err) => console.error('[notifications] review.published', err));

    return {
      id: created.id,
      rating: created.rating,
      comment: created.comment,
      status: created.status,
      createdAt: created.createdAt.toISOString(),
    };
  } catch (err) {
    if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'P2002') {
      throw new AppError(409, 'ALREADY_REVIEWED', 'This booking already has a review');
    }
    throw err;
  }
}

export async function maybeInviteReview(userId: string, bookingId: string) {
  const row = await prisma.booking.findFirst({
    where: { id: bookingId, userId },
    include: reviewBookingInclude,
  });
  if (!row) return;
  if (!classifyReviewEligibility(row, userId).eligible) return;
  await notifyReviewInvite({ userId, bookingId });
}

export async function listOwnerReviews(userId: string, role: string) {
  const scope = await resolveOwnerScope(userId, role as UserRole);
  if (!scope.ownerProfileId) {
    throw new AppError(400, 'OWNER_SCOPE_REQUIRED', 'Reviews are scoped to a partner account');
  }
  const rows = await prisma.review.findMany({
    where: { property: { ownerId: scope.ownerProfileId } },
    include: {
      booking: { select: { publicCode: true } },
      property: { select: { id: true, slug: true, titleAr: true, titleEn: true } },
      customer: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  return rows.map(mapAdminReview).map((r) => ({
    ...r,
    hiddenReason: undefined,
  }));
}

export async function listAdminReviews(): Promise<PropertyReviewAdminRow[]> {
  const rows = await prisma.review.findMany({
    include: {
      booking: { select: { publicCode: true } },
      property: { select: { id: true, slug: true, titleAr: true, titleEn: true } },
      customer: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  return rows.map(mapAdminReview);
}

export async function hideReview(
  adminUserId: string,
  reviewId: string,
  input: HideReviewInput,
  req?: AuthenticatedRequest,
) {
  const row = await prisma.review.findUnique({ where: { id: reviewId } });
  if (!row) throw new AppError(404, 'NOT_FOUND', 'Review not found');
  const updated = await prisma.review.update({
    where: { id: reviewId },
    data: {
      status: ReviewStatus.hidden,
      hiddenReason: input.reason.trim(),
      hiddenAt: new Date(),
      hiddenByUserId: adminUserId,
    },
    include: {
      booking: { select: { publicCode: true } },
      property: { select: { id: true, slug: true, titleAr: true, titleEn: true } },
      customer: { select: { id: true, name: true } },
    },
  });
  await createAuditLog({
    actorUserId: adminUserId,
    action: 'review.hidden',
    entityType: 'review',
    entityId: reviewId,
    metadata: { reason: input.reason.trim() },
    req,
  });
  return mapAdminReview(updated);
}

export async function restoreReview(
  adminUserId: string,
  reviewId: string,
  req?: AuthenticatedRequest,
) {
  const row = await prisma.review.findUnique({ where: { id: reviewId } });
  if (!row) throw new AppError(404, 'NOT_FOUND', 'Review not found');
  const updated = await prisma.review.update({
    where: { id: reviewId },
    data: {
      status: ReviewStatus.published,
      hiddenAt: null,
      hiddenByUserId: null,
    },
    include: {
      booking: { select: { publicCode: true } },
      property: { select: { id: true, slug: true, titleAr: true, titleEn: true } },
      customer: { select: { id: true, name: true } },
    },
  });
  await createAuditLog({
    actorUserId: adminUserId,
    action: 'review.restored',
    entityType: 'review',
    entityId: reviewId,
    req,
  });
  return mapAdminReview(updated);
}

export async function reviewsForBookings(bookingIds: string[]) {
  if (!bookingIds.length) return new Map<string, { id: string; rating: number; comment: string | null; status: ReviewStatus; createdAt: Date }>();
  const rows = await prisma.review.findMany({
    where: { bookingId: { in: bookingIds } },
  });
  return new Map(rows.map((r) => [r.bookingId, r]));
}
