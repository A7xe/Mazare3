/**
 * Phase 3C.4D.4B — Central Property bookability / publication evaluator.
 *
 * Composes independent gates (Owner, Property status, Authority, Regulatory).
 * Does NOT require platform_verified or payout profile.
 * Does NOT activate DRAFT Owner Agreement.
 *
 * NEW Booking / first payment / publish → regulatory READY + authority approved.
 * Balance payment on already-confirmed Booking → do NOT use this gate.
 * Existing confirmed Bookings are never auto-cancelled here.
 */
import {
  prisma,
  PropertyStatus,
  OwnerStatus,
  PropertyAuthorityReviewStatus,
  BookingStatus,
} from '@mazare3/db';
import { AppError } from '../lib/errors.js';
import { evaluatePropertyRegulatoryReadiness } from './property-regulatory.service.js';

export type BookabilityPurpose =
  | 'publish'
  | 'new_booking'
  | 'owner_accept'
  | 'first_payment'
  | 'public_display';

/** Machine codes for Owner/Admin — never send raw to Customer. */
export type BookabilityBlockerCode =
  | 'property_not_found'
  | 'property_not_published'
  | 'owner_not_approved'
  | 'owner_suspended'
  | 'authority_not_approved'
  | 'authority_reassessment_required'
  | 'authority_under_review'
  | 'authority_action_required'
  | 'authority_rejected'
  | 'authority_not_submitted'
  | 'regulatory_not_ready'
  | 'regulatory_reassessment_required';

export type PublicBookabilityReason = 'unavailable' | null;

export type PropertyBookabilityResult = {
  propertyId: string;
  purpose: BookabilityPurpose;
  /** True when this purpose may proceed. */
  eligible: boolean;
  /** Alias for Customer-facing canBook (new_booking / public_display). */
  canBook: boolean;
  canPublish: boolean;
  canAcceptNewPaidBooking: boolean;
  /** Internal blocker codes (Owner/Admin). */
  blockers: BookabilityBlockerCode[];
  /** Customer-safe reason category only. */
  publicReason: PublicBookabilityReason;
  layers: {
    propertyStatus: string | null;
    ownerStatus: string | null;
    authorityReviewStatus: string | null;
    regulatoryReadiness: string | null;
    platformVerification: string | null;
  };
  regulatoryBlockingReasons: string[];
};

const CUSTOMER_UNAVAILABLE_EN = 'This Property is currently unavailable for Booking.';
const CUSTOMER_UNAVAILABLE_AR = 'هذا العقار غير متاح للحجز حالياً.';

export function customerUnavailableBookingMessage(locale?: 'ar' | 'en'): string {
  return locale === 'ar' ? CUSTOMER_UNAVAILABLE_AR : CUSTOMER_UNAVAILABLE_EN;
}

function authorityBlocker(
  status: PropertyAuthorityReviewStatus | null | undefined,
): BookabilityBlockerCode | null {
  if (!status || status === PropertyAuthorityReviewStatus.not_submitted) {
    return 'authority_not_submitted';
  }
  if (status === PropertyAuthorityReviewStatus.approved) return null;
  if (status === PropertyAuthorityReviewStatus.reassessment_required) {
    return 'authority_reassessment_required';
  }
  if (status === PropertyAuthorityReviewStatus.under_review) return 'authority_under_review';
  if (status === PropertyAuthorityReviewStatus.action_required) {
    return 'authority_action_required';
  }
  if (status === PropertyAuthorityReviewStatus.rejected) return 'authority_rejected';
  return 'authority_not_approved';
}

/**
 * SSOT evaluator for publication and NEW paid Booking eligibility.
 * Fail-closed. platform_verified is informational only (never a blocker).
 */
export async function evaluatePropertyBookability(
  propertyId: string,
  purpose: BookabilityPurpose = 'new_booking',
): Promise<PropertyBookabilityResult> {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: {
      id: true,
      status: true,
      verificationStatus: true,
      authorityReviewStatus: true,
      owner: { select: { status: true } },
    },
  });

  const blockers: BookabilityBlockerCode[] = [];
  const emptyLayers = {
    propertyStatus: null as string | null,
    ownerStatus: null as string | null,
    authorityReviewStatus: null as string | null,
    regulatoryReadiness: null as string | null,
    platformVerification: null as string | null,
  };

  if (!property) {
    return {
      propertyId,
      purpose,
      eligible: false,
      canBook: false,
      canPublish: false,
      canAcceptNewPaidBooking: false,
      blockers: ['property_not_found'],
      publicReason: 'unavailable',
      layers: emptyLayers,
      regulatoryBlockingReasons: [],
    };
  }

  const layers = {
    propertyStatus: property.status,
    ownerStatus: property.owner.status,
    authorityReviewStatus: property.authorityReviewStatus,
    regulatoryReadiness: null as string | null,
    platformVerification: property.verificationStatus,
  };

  if (property.owner.status === OwnerStatus.suspended) {
    blockers.push('owner_suspended');
  } else if (property.owner.status !== OwnerStatus.approved) {
    blockers.push('owner_not_approved');
  }

  const needsPublished =
    purpose === 'new_booking' ||
    purpose === 'owner_accept' ||
    purpose === 'first_payment' ||
    purpose === 'public_display';
  if (needsPublished && property.status !== PropertyStatus.published) {
    blockers.push('property_not_published');
  }

  const authBlock = authorityBlocker(property.authorityReviewStatus);
  if (authBlock) blockers.push(authBlock);

  // Regulatory readiness (includes derived expiry + reassessmentRequired)
  const regulatory = await evaluatePropertyRegulatoryReadiness(propertyId);
  layers.regulatoryReadiness = regulatory.readiness;

  if (regulatory.readiness !== 'ready') {
    blockers.push('regulatory_not_ready');
  }
  if (regulatory.requirements.some((r) => r.reassessmentRequired)) {
    if (!blockers.includes('regulatory_reassessment_required')) {
      blockers.push('regulatory_reassessment_required');
    }
  }

  const eligible = blockers.length === 0;
  const publicReason: PublicBookabilityReason = eligible ? null : 'unavailable';

  return {
    propertyId,
    purpose,
    eligible,
    canBook: eligible && property.status === PropertyStatus.published,
    canPublish: eligible, // publish purpose: caller also checks media/listing/FSM
    canAcceptNewPaidBooking: eligible && property.status === PropertyStatus.published,
    blockers,
    publicReason,
    layers,
    regulatoryBlockingReasons: regulatory.blockingReasons,
  };
}

/** Throw Customer-safe AppError when NEW Booking / first payment / accept is blocked. */
export async function assertPropertyEligibleForNewPaidBooking(
  propertyId: string,
  purpose: 'new_booking' | 'owner_accept' | 'first_payment' = 'new_booking',
): Promise<PropertyBookabilityResult> {
  const result = await evaluatePropertyBookability(propertyId, purpose);
  if (!result.eligible) {
    throw new AppError(
      409,
      'PROPERTY_NOT_BOOKABLE',
      customerUnavailableBookingMessage('en'),
      {
        publicReason: result.publicReason,
        // Internal codes only in details for server logs / Owner-facing mappers — not for Customer UI copy
        purpose,
      },
    );
  }
  return result;
}

/** Throw when publish/republish cannot proceed due to authority/regulatory gates. */
export async function assertPropertyEligibleForPublish(
  propertyId: string,
): Promise<PropertyBookabilityResult> {
  const result = await evaluatePropertyBookability(propertyId, 'publish');
  if (!result.eligible) {
    throw new AppError(
      409,
      'PROPERTY_NOT_PUBLISHABLE',
      'Property cannot be published until authority and regulatory readiness are complete',
      {
        blockers: result.blockers,
        regulatoryReadiness: result.layers.regulatoryReadiness,
        authorityReviewStatus: result.layers.authorityReviewStatus,
        regulatoryBlockingReasons: result.regulatoryBlockingReasons,
      },
    );
  }
  return result;
}

/**
 * Future confirmed Bookings on a Property that is no longer NEW-Booking ready.
 * Surface-only — does NOT cancel/refund/penalize.
 */
export async function listFutureConfirmedBookingsForRegulatoryReview(propertyId: string) {
  const now = new Date();
  const rows = await prisma.booking.findMany({
    where: {
      propertyId,
      status: BookingStatus.confirmed,
      bookingStartAt: { gte: now },
    },
    select: {
      id: true,
      status: true,
      bookingStartAt: true,
      paymentState: true,
      remainingAmount: true,
      userId: true,
    },
    orderBy: { bookingStartAt: 'asc' },
    take: 100,
  });
  return rows.map((b) => ({
    id: b.id,
    status: b.status,
    bookingStartAt: b.bookingStartAt?.toISOString() ?? null,
    paymentState: b.paymentState,
    remainingAmount: Number(b.remainingAmount),
    signal: 'REGULATORY_REVIEW_AFFECTS_EXISTING_BOOKINGS' as const,
  }));
}

/**
 * Admin package: publication + new-Booking eligibility + affected future Bookings.
 */
export async function getPropertyBookabilityAdminPackage(propertyId: string) {
  const [forPublish, forBooking, futureConfirmed] = await Promise.all([
    evaluatePropertyBookability(propertyId, 'publish'),
    evaluatePropertyBookability(propertyId, 'new_booking'),
    listFutureConfirmedBookingsForRegulatoryReview(propertyId),
  ]);

  const regulatoryAffectsExisting =
    !forBooking.eligible && futureConfirmed.length > 0
      ? {
          signal: 'REGULATORY_REVIEW_AFFECTS_EXISTING_BOOKINGS' as const,
          futureConfirmedCount: futureConfirmed.length,
          bookings: futureConfirmed,
        }
      : null;

  return {
    publication: {
      eligible: forPublish.eligible,
      blockers: forPublish.blockers,
      layers: forPublish.layers,
      regulatoryBlockingReasons: forPublish.regulatoryBlockingReasons,
    },
    newBooking: {
      eligible: forBooking.eligible,
      canBook: forBooking.canBook,
      blockers: forBooking.blockers,
      layers: forBooking.layers,
      regulatoryBlockingReasons: forBooking.regulatoryBlockingReasons,
      publicReason: forBooking.publicReason,
    },
    regulatoryAffectsExistingBookings: regulatoryAffectsExisting,
    /** Explicit: platform_verified never required for book/publish */
    platformVerifiedRequired: false,
  };
}

/** Read-only Production rollout preflight counts (no mutations, no document contents). */
export async function runRegulatoryGatePreflightReport() {
  const [
    totalProperties,
    publishedProperties,
    authorityApproved,
    futureConfirmedOnPublished,
  ] = await Promise.all([
    prisma.property.count(),
    prisma.property.count({ where: { status: PropertyStatus.published } }),
    prisma.property.count({
      where: { authorityReviewStatus: PropertyAuthorityReviewStatus.approved },
    }),
    prisma.booking.count({
      where: {
        status: BookingStatus.confirmed,
        bookingStartAt: { gte: new Date() },
        property: { status: PropertyStatus.published },
      },
    }),
  ]);

  const published = await prisma.property.findMany({
    where: { status: PropertyStatus.published },
    select: {
      id: true,
      slug: true,
      authorityReviewStatus: true,
      verificationStatus: true,
      owner: { select: { status: true } },
    },
  });

  let regulatoryReady = 0;
  let publishedNotReady = 0;
  let readyButAuthorityBlocked = 0;
  let expiredBlockingEvidence = 0;
  let publishedBookable = 0;
  const publishedNotReadySamples: Array<{ id: string; slug: string; readiness: string }> = [];
  let futureConfirmedOnNonReady = 0;

  for (const p of published) {
    const evalResult = await evaluatePropertyBookability(p.id, 'new_booking');
    if (evalResult.eligible) publishedBookable += 1;
    if (evalResult.layers.regulatoryReadiness === 'ready') {
      regulatoryReady += 1;
      if (evalResult.blockers.some((b) => b.startsWith('authority_'))) {
        readyButAuthorityBlocked += 1;
      }
    } else {
      publishedNotReady += 1;
      if (publishedNotReadySamples.length < 25) {
        publishedNotReadySamples.push({
          id: p.id,
          slug: p.slug,
          readiness: evalResult.layers.regulatoryReadiness ?? 'unknown',
        });
      }
      if (evalResult.layers.regulatoryReadiness === 'expired_or_blocked') {
        expiredBlockingEvidence += 1;
      }
      const future = await prisma.booking.count({
        where: {
          propertyId: p.id,
          status: BookingStatus.confirmed,
          bookingStartAt: { gte: new Date() },
        },
      });
      futureConfirmedOnNonReady += future;
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    mutation: false,
    note: 'Read-only preflight. Inspect before enabling regulatory gate in Production. No private document contents.',
    counts: {
      totalProperties,
      publishedProperties,
      authorityApproved,
      regulatoryReadyPublished: regulatoryReady,
      publishedButNotRegulatoryReady: publishedNotReady,
      readyButAuthorityBlocked,
      publishedFullyBookable: publishedBookable,
      propertiesWithExpiredBlockingEvidence: expiredBlockingEvidence,
      futureConfirmedBookingsOnPublished: futureConfirmedOnPublished,
      futureConfirmedBookingsOnPublishedNonReady: futureConfirmedOnNonReady,
    },
    samples: {
      publishedNotReady: publishedNotReadySamples,
    },
  };
}
