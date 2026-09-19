/**
 * Phase 3C.4D.6 — Immutable Booking-time listing snapshot.
 * Financial economics remain on Booking / BookingLegalSnapshot (authoritative).
 * This snapshot is contractual listing evidence only — not government certification.
 */
import { createHash } from 'node:crypto';
import {
  prisma,
  BookingPropertySnapshotKind,
  type Prisma,
} from '@mazare3/db';
import { AppError } from '../lib/errors.js';
import { evaluatePropertyBookability } from './property-bookability.service.js';
import { resolvePropertyMediaPublicUrl } from '../lib/property-media-public-url.js';

export const BOOKING_LISTING_SNAPSHOT_SCHEMA_VERSION = 'booking-listing-snapshot-v1' as const;

export type BookingListingSnapshotPayloadV1 = {
  schemaVersion: typeof BOOKING_LISTING_SNAPSHOT_SCHEMA_VERSION;
  capturedAt: string;
  property: {
    id: string;
    slug: string;
    type: string;
    titleAr: string;
    titleEn: string | null;
    descriptionAr: string;
    descriptionEn: string | null;
    updatedAt: string;
  };
  capacity: {
    capacity: number;
    bedrooms: number;
    bathrooms: number;
    allowsOvernight: boolean;
    allowsFamilies: boolean;
    allowsYouth: boolean;
    allowsEvents: boolean;
  };
  amenities: Array<{ key: string; labelAr: string; labelEn: string }>;
  rules: Array<{ titleAr: string; titleEn: string | null }>;
  activities: Array<{ activityCode: string; otherDescription: string | null }>;
  pool: {
    poolsCount: number;
    hasIndoorPool: boolean;
    hasHeatedPool: boolean;
    profile: Record<string, unknown> | null;
    attestationVersion: string | null;
    attestedAt: string | null;
  };
  safetyDisclosures: Array<{
    category: string;
    descriptionAr: string;
    descriptionEn: string | null;
  }>;
  location: {
    city: string | null;
    area: string | null;
    approximateAddress: string | null;
    latitudeApprox: number | null;
    longitudeApprox: number | null;
  };
  media: Array<{
    mediaId: string;
    sortOrder: number;
    isPrimary: boolean;
    url: string;
    thumbnailUrl: string | null;
    altAr: string | null;
    altEn: string | null;
  }>;
  platformVerification: { status: string };
  gates: {
    regulatoryReadiness: string | null;
    bookabilityEligible: boolean;
    authorityReviewStatus: string | null;
    evaluatedAt: string;
    requirementSummaries: Array<{
      requirementType: string;
      applicability: string;
      complianceStatus: string;
    }>;
  };
  policyVersionRefs: {
    termsVersionId: string | null;
    cancellationPolicyVersionId: string | null;
    bookingTermsVersionId: string | null;
    privacyNoticeVersionId: string | null;
  };
  financialRef: {
    note: 'Booking financial columns + BookingLegalSnapshot remain authoritative';
    currency: string;
    totalAmount: number;
    platformCommissionPercent: number;
  };
};

function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_k, v) => {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const sorted: Record<string, unknown> = {};
      for (const key of Object.keys(v as object).sort()) {
        sorted[key] = (v as Record<string, unknown>)[key];
      }
      return sorted;
    }
    return v;
  });
}

export function hashListingSnapshotPayload(payload: unknown): string {
  return createHash('sha256').update(canonicalJson(payload)).digest('hex');
}

export async function buildListingSnapshotPayload(params: {
  propertyId: string;
  booking: {
    currency: string;
    totalAmount: { toNumber(): number } | number;
    platformCommissionPercent: { toNumber(): number } | number;
  };
  policyVersionRefs?: {
    termsVersionId?: string | null;
    cancellationPolicyVersionId?: string | null;
    bookingTermsVersionId?: string | null;
    privacyNoticeVersionId?: string | null;
  };
  /** Prefer passing when already evaluated (avoids nested writes inside Booking TX). */
  gateSummary?: {
    layers: {
      regulatoryReadiness: string | null;
      authorityReviewStatus: string | null;
    };
    eligible: boolean;
  };
  tx?: Prisma.TransactionClient;
}): Promise<BookingListingSnapshotPayloadV1> {
  const db = params.tx ?? prisma;
  const property = await db.property.findUniqueOrThrow({
    where: { id: params.propertyId },
    include: {
      amenities: { include: { amenity: true } },
      rules: { orderBy: { sortOrder: 'asc' } },
      activities: { where: { active: true } },
      media: {
        where: { removedFromListingAt: null },
        orderBy: { sortOrder: 'asc' },
      },
      poolSafetyProfile: true,
      safetyDisclosures: { where: { active: true }, orderBy: { createdAt: 'asc' } },
      regulatoryRequirements: {
        select: {
          requirementType: true,
          applicability: true,
          complianceStatus: true,
        },
      },
    },
  });

  const bookability =
    params.gateSummary ??
    (await evaluatePropertyBookability(params.propertyId, 'new_booking'));

  const media = property.media.map((m, i) => ({
    mediaId: m.id,
    sortOrder: m.sortOrder,
    isPrimary: i === 0,
    url: resolvePropertyMediaPublicUrl(m),
    thumbnailUrl: m.thumbnailUrl,
    altAr: m.altAr,
    altEn: m.altEn,
  }));

  const poolProfile = property.poolSafetyProfile
    ? {
        waterFeatureKind: property.poolSafetyProfile.waterFeatureKind,
        isIndoor: property.poolSafetyProfile.isIndoor,
        isOutdoor: property.poolSafetyProfile.isOutdoor,
        minDepthMeters:
          property.poolSafetyProfile.minDepthMeters != null
            ? Number(property.poolSafetyProfile.minDepthMeters)
            : null,
        maxDepthMeters:
          property.poolSafetyProfile.maxDepthMeters != null
            ? Number(property.poolSafetyProfile.maxDepthMeters)
            : null,
        childrenAllowed: property.poolSafetyProfile.childrenAllowed,
        childrenRequireAdultSupervision:
          property.poolSafetyProfile.childrenRequireAdultSupervision,
        seasonality: property.poolSafetyProfile.seasonality,
        accessRestrictionsAr: property.poolSafetyProfile.accessRestrictionsAr,
        accessRestrictionsEn: property.poolSafetyProfile.accessRestrictionsEn,
        otherWarningsAr: property.poolSafetyProfile.otherWarningsAr,
        otherWarningsEn: property.poolSafetyProfile.otherWarningsEn,
        depthSource: 'owner_provided' as const,
      }
    : null;

  const totalAmount =
    typeof params.booking.totalAmount === 'number'
      ? params.booking.totalAmount
      : params.booking.totalAmount.toNumber();
  const commissionPercent =
    typeof params.booking.platformCommissionPercent === 'number'
      ? params.booking.platformCommissionPercent
      : params.booking.platformCommissionPercent.toNumber();

  return {
    schemaVersion: BOOKING_LISTING_SNAPSHOT_SCHEMA_VERSION,
    capturedAt: new Date().toISOString(),
    property: {
      id: property.id,
      slug: property.slug,
      type: property.type,
      titleAr: property.titleAr,
      titleEn: property.titleEn,
      descriptionAr: property.descriptionAr,
      descriptionEn: property.descriptionEn,
      updatedAt: property.updatedAt.toISOString(),
    },
    capacity: {
      capacity: property.capacity,
      bedrooms: property.bedrooms,
      bathrooms: property.bathrooms,
      allowsOvernight: property.allowsOvernight,
      allowsFamilies: property.allowsFamilies,
      allowsYouth: property.allowsYouth,
      allowsEvents: property.allowsEvents,
    },
    amenities: property.amenities.map((a) => ({
      key: a.amenity.key,
      labelAr: a.amenity.labelAr,
      labelEn: a.amenity.labelEn,
    })),
    rules: property.rules.map((r) => ({
      titleAr: r.titleAr,
      titleEn: r.titleEn,
    })),
    activities: property.activities.map((a) => ({
      activityCode: a.activityCode,
      otherDescription: a.otherDescription,
    })),
    pool: {
      poolsCount: property.poolsCount,
      hasIndoorPool: property.hasIndoorPool,
      hasHeatedPool: property.hasHeatedPool,
      profile: poolProfile,
      attestationVersion: property.poolSafetyAttestationVersion,
      attestedAt: property.poolSafetyAttestedAt?.toISOString() ?? null,
    },
    safetyDisclosures: property.safetyDisclosures.map((d) => ({
      category: d.category,
      descriptionAr: d.descriptionAr,
      descriptionEn: d.descriptionEn,
    })),
    location: {
      city: property.city,
      area: property.area,
      approximateAddress: property.approximateAddress,
      latitudeApprox: property.latitudeApprox,
      longitudeApprox: property.longitudeApprox,
    },
    media,
    platformVerification: { status: property.verificationStatus },
    gates: {
      regulatoryReadiness: bookability.layers.regulatoryReadiness,
      bookabilityEligible: bookability.eligible,
      authorityReviewStatus: bookability.layers.authorityReviewStatus,
      evaluatedAt: new Date().toISOString(),
      requirementSummaries: property.regulatoryRequirements.map((r) => ({
        requirementType: r.requirementType,
        applicability: r.applicability,
        complianceStatus: r.complianceStatus,
      })),
    },
    policyVersionRefs: {
      termsVersionId: params.policyVersionRefs?.termsVersionId ?? null,
      cancellationPolicyVersionId:
        params.policyVersionRefs?.cancellationPolicyVersionId ?? null,
      bookingTermsVersionId: params.policyVersionRefs?.bookingTermsVersionId ?? null,
      privacyNoticeVersionId: params.policyVersionRefs?.privacyNoticeVersionId ?? null,
    },
    financialRef: {
      note: 'Booking financial columns + BookingLegalSnapshot remain authoritative',
      currency: params.booking.currency,
      totalAmount,
      platformCommissionPercent: commissionPercent,
    },
  };
}

/**
 * Persist INITIAL listing snapshot. Idempotent on (bookingId, initial).
 * Must run inside Booking create transaction when possible.
 */
export async function createInitialBookingListingSnapshot(params: {
  bookingId: string;
  propertyId: string;
  booking: {
    currency: string;
    totalAmount: { toNumber(): number } | number;
    platformCommissionPercent: { toNumber(): number } | number;
  };
  policyVersionRefs?: {
    termsVersionId?: string | null;
    cancellationPolicyVersionId?: string | null;
    bookingTermsVersionId?: string | null;
    privacyNoticeVersionId?: string | null;
  };
  gateSummary?: {
    layers: {
      regulatoryReadiness: string | null;
      authorityReviewStatus: string | null;
    };
    eligible: boolean;
  };
  tx?: Prisma.TransactionClient;
}) {
  const db = params.tx ?? prisma;
  const existing = await db.bookingPropertySnapshot.findUnique({
    where: {
      bookingId_kind: {
        bookingId: params.bookingId,
        kind: BookingPropertySnapshotKind.initial,
      },
    },
  });
  if (existing) return existing;

  const property = await db.property.findUniqueOrThrow({
    where: { id: params.propertyId },
    select: { updatedAt: true },
  });

  const payload = await buildListingSnapshotPayload({
    ...params,
    gateSummary: params.gateSummary,
  });
  const integrityHash = hashListingSnapshotPayload(payload);

  return db.bookingPropertySnapshot.create({
    data: {
      bookingId: params.bookingId,
      kind: BookingPropertySnapshotKind.initial,
      schemaVersion: BOOKING_LISTING_SNAPSHOT_SCHEMA_VERSION,
      propertyId: params.propertyId,
      propertyUpdatedAt: property.updatedAt,
      payload: payload as unknown as Prisma.InputJsonValue,
      integrityHash,
    },
  });
}

export async function getInitialBookingListingSnapshot(bookingId: string) {
  return prisma.bookingPropertySnapshot.findUnique({
    where: {
      bookingId_kind: { bookingId, kind: BookingPropertySnapshotKind.initial },
    },
  });
}

/** Batch-load INITIAL snapshots for booking list enrichment (titles / evidence flags). */
export async function mapInitialListingSnapshotsByBookingIds(bookingIds: string[]) {
  if (bookingIds.length === 0) return new Map<string, Awaited<ReturnType<typeof getInitialBookingListingSnapshot>>>();
  const rows = await prisma.bookingPropertySnapshot.findMany({
    where: {
      bookingId: { in: bookingIds },
      kind: BookingPropertySnapshotKind.initial,
    },
  });
  return new Map(rows.map((r) => [r.bookingId, r]));
}

/** Apply snapshotted identity onto a booking summary when available. */
export function applyListingSnapshotIdentity<T extends {
  propertyTitleAr: string;
  propertyTitleEn: string;
  approximateLocation?: string;
  listingSnapshotStatus?: 'available' | 'LEGACY_SNAPSHOT_UNAVAILABLE';
}>(
  summary: T,
  snap: { payload: unknown } | null | undefined,
): T {
  if (!snap) {
    summary.listingSnapshotStatus = 'LEGACY_SNAPSHOT_UNAVAILABLE';
    return summary;
  }
  const p = snap.payload as BookingListingSnapshotPayloadV1;
  summary.propertyTitleAr = p.property?.titleAr ?? summary.propertyTitleAr;
  summary.propertyTitleEn =
    p.property?.titleEn ?? p.property?.titleAr ?? summary.propertyTitleEn;
  if (summary.approximateLocation !== undefined) {
    summary.approximateLocation =
      p.location?.approximateAddress?.trim() ||
      [p.location?.area, p.location?.city].filter(Boolean).join(', ') ||
      summary.approximateLocation;
  }
  summary.listingSnapshotStatus = 'available';
  return summary;
}

export async function assertBookingHasInitialListingSnapshot(bookingId: string) {
  const row = await getInitialBookingListingSnapshot(bookingId);
  if (!row) {
    throw new AppError(
      409,
      'BOOKING_LISTING_SNAPSHOT_MISSING',
      'Booking listing snapshot is required before payment',
    );
  }
  return row;
}

/** Customer-safe view — no storage keys, no internal blocker dumps beyond gate summary. */
export function toCustomerListingSnapshotView(row: {
  id: string;
  schemaVersion: string;
  createdAt: Date;
  integrityHash: string | null;
  payload: unknown;
} | null) {
  if (!row) {
    return { status: 'LEGACY_SNAPSHOT_UNAVAILABLE' as const, snapshot: null };
  }
  const p = row.payload as BookingListingSnapshotPayloadV1;
  return {
    status: 'available' as const,
    snapshot: {
      id: row.id,
      schemaVersion: row.schemaVersion,
      capturedAt: p.capturedAt ?? row.createdAt.toISOString(),
      property: p.property,
      capacity: p.capacity,
      amenities: p.amenities,
      rules: p.rules,
      activities: p.activities,
      pool: p.pool,
      safetyDisclosures: p.safetyDisclosures,
      location: p.location,
      media: (p.media ?? []).map((m) => ({
        mediaId: m.mediaId,
        sortOrder: m.sortOrder,
        isPrimary: m.isPrimary,
        url: m.url,
        thumbnailUrl: m.thumbnailUrl,
        altAr: m.altAr,
        altEn: m.altEn,
      })),
      platformVerification: p.platformVerification,
      policyVersionRefs: p.policyVersionRefs,
      gates: {
        regulatoryReadiness: p.gates?.regulatoryReadiness ?? null,
        authorityReviewStatus: p.gates?.authorityReviewStatus ?? null,
        evaluatedAt: p.gates?.evaluatedAt ?? null,
      },
      integrityHash: row.integrityHash,
      label: 'at_time_of_booking' as const,
    },
  };
}

/** Owner-safe view — same Customer-safe listing facts (no Customer PII added). */
export function toOwnerListingSnapshotView(
  row: Parameters<typeof toCustomerListingSnapshotView>[0],
) {
  return toCustomerListingSnapshotView(row);
}

export function toAdminListingSnapshotView(row: {
  id: string;
  schemaVersion: string;
  createdAt: Date;
  integrityHash: string | null;
  propertyId: string;
  payload: unknown;
} | null) {
  const base = toCustomerListingSnapshotView(row);
  if (base.status !== 'available' || !row) return base;
  const p = row.payload as BookingListingSnapshotPayloadV1;
  const recomputed = hashListingSnapshotPayload(p);
  return {
    ...base,
    snapshot: {
      ...base.snapshot!,
      propertyId: row.propertyId,
      gates: p.gates,
      financialRef: p.financialRef,
      hashMatches: row.integrityHash ? row.integrityHash === recomputed : null,
      label: 'at_time_of_booking' as const,
    },
  };
}

export async function getAdminListingSnapshotComparison(bookingId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, propertyId: true },
  });
  if (!booking) throw new AppError(404, 'NOT_FOUND', 'Booking not found');

  const snap = await getInitialBookingListingSnapshot(bookingId);
  const current = await buildListingSnapshotPayload({
    propertyId: booking.propertyId,
    booking: { currency: 'JOD', totalAmount: 0, platformCommissionPercent: 0 },
  });

  return {
    bookingId,
    atTimeOfBooking: toAdminListingSnapshotView(snap),
    currentListing: {
      label: 'current_listing' as const,
      property: current.property,
      capacity: current.capacity,
      amenities: current.amenities,
      rules: current.rules,
      activities: current.activities,
      pool: current.pool,
      safetyDisclosures: current.safetyDisclosures,
      media: current.media.map((m) => ({
        mediaId: m.mediaId,
        sortOrder: m.sortOrder,
        isPrimary: m.isPrimary,
        url: m.url,
      })),
      platformVerification: current.platformVerification,
    },
  };
}

export async function getCustomerBookingListingSnapshot(userId: string, bookingId: string) {
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, userId },
    select: { id: true },
  });
  if (!booking) throw new AppError(404, 'NOT_FOUND', 'Booking not found');
  const snap = await getInitialBookingListingSnapshot(bookingId);
  return toCustomerListingSnapshotView(snap);
}

export async function getOwnerBookingListingSnapshot(
  ownerUserId: string,
  role: string,
  bookingId: string,
) {
  const { resolveOwnerScope } = await import('./owner-access.js');
  const scope = await resolveOwnerScope(ownerUserId, role as never);
  const booking = await prisma.booking.findFirst({
    where: {
      id: bookingId,
      ...(scope.isAdmin ? {} : { property: { ownerId: scope.ownerProfileId! } }),
    },
    select: { id: true },
  });
  if (!booking) throw new AppError(404, 'NOT_FOUND', 'Booking not found');
  const snap = await getInitialBookingListingSnapshot(bookingId);
  return toOwnerListingSnapshotView(snap);
}

/** Read-only preflight */
export async function runBookingListingSnapshotPreflightReport() {
  const [totalBookings, withSnapshot, duplicateAnomalies] = await Promise.all([
    prisma.booking.count(),
    prisma.bookingPropertySnapshot.count({
      where: { kind: BookingPropertySnapshotKind.initial },
    }),
    prisma.$queryRaw<{ bookingId: string; c: bigint }[]>`
      SELECT "bookingId", COUNT(*)::bigint AS c
      FROM "BookingPropertySnapshot"
      WHERE kind = 'initial'
      GROUP BY "bookingId"
      HAVING COUNT(*) > 1
    `.catch(() => [] as { bookingId: string; c: bigint }[]),
  ]);

  const legacyWithoutSnapshot = totalBookings - withSnapshot;

  const snapshots = await prisma.bookingPropertySnapshot.findMany({
    where: { kind: BookingPropertySnapshotKind.initial },
    select: { id: true, integrityHash: true, payload: true, propertyId: true },
    take: 500,
  });

  let hashMismatches = 0;
  let missingMediaRefs = 0;
  for (const s of snapshots) {
    const p = s.payload as BookingListingSnapshotPayloadV1;
    if (s.integrityHash && s.integrityHash !== hashListingSnapshotPayload(p)) {
      hashMismatches += 1;
    }
    for (const m of p.media ?? []) {
      const exists = await prisma.propertyMedia.findUnique({
        where: { id: m.mediaId },
        select: { id: true },
      });
      if (!exists) missingMediaRefs += 1;
    }
  }

  const propertiesWithBookings = await prisma.property.count({
    where: { bookings: { some: {} } },
  });

  return {
    generatedAt: new Date().toISOString(),
    mutation: false,
    note: 'Read-only. No Personal Data. Legacy Bookings are not backfilled.',
    counts: {
      totalBookings,
      bookingsWithInitialSnapshot: withSnapshot,
      legacyBookingsWithoutSnapshot: Math.max(0, legacyWithoutSnapshot),
      duplicateInitialSnapshotAnomalies: duplicateAnomalies.length,
      integrityHashMismatchesSampled: hashMismatches,
      snapshotMediaRefsMissingSampled: missingMediaRefs,
      propertiesWithHistoricalBookings: propertiesWithBookings,
    },
  };
}
