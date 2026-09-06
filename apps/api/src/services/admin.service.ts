import {
  prisma,
  AvailabilitySlotStatus,
  BookingStatus,
  OwnerStatus,
  PropertyStatus,
  UserRole,
  UserStatus,
} from '@mazare3/db';
import type {
  AdminAuditLogRow,
  AdminAvailabilityQuery,
  AdminBookingRow,
  AdminDashboardSummary,
  AdminOwnerRow,
  AdminPropertyDetail,
  AdminPropertyRow,
  AdminUserDetail,
  AdminUserRow,
  OwnerAvailabilitySlotRow,
  PatchAdminAvailabilityInput,
  PatchAdminOwnerStatusInput,
  PatchAdminPropertyStatusInput,
  PatchAdminUserStatusInput,
} from '@mazare3/shared';
import { AppError } from '../lib/errors.js';
import { assertAdminPropertyStatusTransitionOrThrow, isAdminPropertyChangeReasonRefresh } from '../lib/property-status-fsm.js';
import { createAuditLog } from './audit.service.js';
import {
  notifyOwnerApproved,
  notifyPropertyChangesRequested,
  notifyPropertyPublished,
  notifyPropertyRejected,
} from './notification.service.js';
import { assertMediaForPublish } from '../lib/property-media-guards.js';
import { assertPropertyListingComplete } from '../lib/property-listing-guards.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { SLOT_HOLDING_STATUSES } from '../lib/payment-hold.js';
import { toPaymentDisplayStatus } from '../mappers/payment.mapper.js';
import { mapOwnerSlotRow } from '../lib/availability-times.js';
import {
  assertAndGenerateForPublish,
  getPropertyAvailabilityHealth,
} from './availability-rules.service.js';
import { approvePartner, rejectPartner, suspendPartner } from './partner-admin.service.js';
import { listAdminPropertyPromotions } from './promotion.service.js';
import { listAdminPropertyCoupons } from './coupon.service.js';
import { listAdminPropertyPlacements } from './placement.service.js';
import { resolvePropertyMediaPublicUrl } from '../lib/property-media-public-url.js';

function parseDateOnly(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d));
}

function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function decimalToNumber(value: { toNumber(): number } | number | null | undefined): number {
  if (value == null) return 0;
  return typeof value === 'number' ? value : value.toNumber();
}

function nullableDecimalToNumber(
  value: { toNumber(): number } | number | null | undefined,
): number | null {
  if (value == null) return null;
  return typeof value === 'number' ? value : value.toNumber();
}

function todayUtc(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function addDaysUtc(base: Date, days: number): Date {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

const SENSITIVE_META_KEYS = [
  'password',
  'token',
  'secret',
  'cookie',
  'hash',
  'jwt',
  'phone',
  'whatsapp',
  'exactaddress',
];

function sanitizeMetadata(meta: unknown): Record<string, unknown> | null {
  if (meta == null || typeof meta !== 'object' || Array.isArray(meta)) return null;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta as Record<string, unknown>)) {
    if (SENSITIVE_META_KEYS.some((s) => k.toLowerCase().includes(s))) continue;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      out[k] = sanitizeMetadata(v);
    } else {
      out[k] = v;
    }
  }
  return Object.keys(out).length ? out : null;
}

function mapAuditLog(row: {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  metadata: unknown;
  createdAt: Date;
  actor: { email: string | null; name: string | null } | null;
}): AdminAuditLogRow {
  return {
    id: row.id,
    action: row.action,
    actorEmail: row.actor?.email ?? null,
    actorName: row.actor?.name ?? null,
    entityType: row.entityType,
    entityId: row.entityId,
    metadata: sanitizeMetadata(row.metadata),
    createdAt: row.createdAt.toISOString(),
  };
}

export async function getAdminSummary(
  actorUserId: string,
  req?: AuthenticatedRequest,
): Promise<AdminDashboardSummary> {
  const today = todayUtc();
  const weekEnd = addDaysUtc(today, 7);
  const activeStatuses = [BookingStatus.confirmed];

  const [
    usersCount,
    customersCount,
    ownersCount,
    propertiesCount,
    publishedPropertiesCount,
    bookingsCount,
    todayBookingsCount,
    weekBookingsCount,
    revenueAgg,
    recentLogs,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: UserRole.customer } }),
    prisma.user.count({ where: { role: UserRole.owner } }),
    prisma.property.count(),
    prisma.property.count({ where: { status: PropertyStatus.published } }),
    prisma.booking.count(),
    prisma.booking.count({
      where: { status: { in: activeStatuses }, slot: { date: today } },
    }),
    prisma.booking.count({
      where: {
        status: { in: activeStatuses },
        slot: { date: { gte: today, lte: weekEnd } },
      },
    }),
    prisma.booking.aggregate({
      where: { status: { in: activeStatuses }, slot: { date: { gte: today } } },
      _sum: { totalAmount: true },
    }),
    prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { actor: { select: { email: true, name: true } } },
    }),
  ]);

  await createAuditLog({
    actorUserId,
    action: 'admin.dashboard_accessed',
    entityType: 'admin',
    req,
  });

  return {
    usersCount,
    customersCount,
    ownersCount,
    propertiesCount,
    publishedPropertiesCount,
    bookingsCount,
    todayBookingsCount,
    weekBookingsCount,
    estimatedRevenueJod: decimalToNumber(revenueAgg._sum.totalAmount ?? 0),
    recentAuditLogs: recentLogs.map(mapAuditLog),
  };
}

export async function listAdminUsers(): Promise<AdminUserRow[]> {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      createdAt: true,
    },
  });
  return users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    status: u.status,
    createdAt: u.createdAt.toISOString(),
  }));
}

export async function getAdminUserById(id: string): Promise<AdminUserDetail | null> {
  const u = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      locale: true,
      createdAt: true,
    },
  });
  if (!u) return null;
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    status: u.status,
    locale: u.locale,
    createdAt: u.createdAt.toISOString(),
  };
}

export async function patchAdminUserStatus(
  actorUserId: string,
  userId: string,
  input: PatchAdminUserStatusInput,
  req?: AuthenticatedRequest,
): Promise<AdminUserDetail> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AppError(404, 'NOT_FOUND', 'User not found');
  }

  if (user.role === UserRole.admin && input.status !== UserStatus.active) {
    const activeAdmins = await prisma.user.count({
      where: { role: UserRole.admin, status: UserStatus.active },
    });
    if (activeAdmins <= 1) {
      throw new AppError(400, 'LAST_ADMIN', 'Cannot suspend the last active admin account');
    }
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { status: input.status as UserStatus },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      locale: true,
      createdAt: true,
    },
  });

  await createAuditLog({
    actorUserId,
    action: 'admin.user_status_updated',
    entityType: 'user',
    entityId: userId,
    metadata: { previousStatus: user.status, newStatus: input.status },
    req,
  });

  return {
    id: updated.id,
    name: updated.name,
    email: updated.email,
    role: updated.role,
    status: updated.status,
    locale: updated.locale,
    createdAt: updated.createdAt.toISOString(),
  };
}

export async function listAdminOwners(): Promise<AdminOwnerRow[]> {
  const profiles = await prisma.ownerProfile.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      user: { select: { email: true } },
      _count: { select: { properties: true } },
    },
  });

  const rows: AdminOwnerRow[] = [];
  for (const p of profiles) {
    const bookingsCount = await prisma.booking.count({
      where: { property: { ownerId: p.id } },
    });
    rows.push({
      id: p.id,
      userId: p.userId,
      displayName: p.displayName,
      businessName: p.businessName,
      email: p.user.email,
      status: p.status,
      city: p.city,
      area: p.area,
      propertiesCount: p._count.properties,
      bookingsCount,
      createdAt: p.createdAt.toISOString(),
      rejectionReason: p.rejectionReason,
    });
  }
  return rows;
}

export async function patchAdminOwnerStatus(
  actorUserId: string,
  ownerProfileId: string,
  input: PatchAdminOwnerStatusInput,
  req?: AuthenticatedRequest,
): Promise<AdminOwnerRow> {
  if (input.status === 'approved') {
    await approvePartner({
      actorUserId,
      ownerProfileId,
      input: {},
      req,
    });
  } else if (input.status === 'rejected') {
    await rejectPartner({
      actorUserId,
      ownerProfileId,
      reason: input.rejectionReason?.trim() || '',
      req,
    });
  } else if (input.status === 'suspended') {
    await suspendPartner({
      actorUserId,
      ownerProfileId,
      reason: input.rejectionReason?.trim() || 'Owner account suspended',
      req,
    });
  } else {
    throw new AppError(
      400,
      'USE_PARTNER_WORKFLOW',
      'Use the partner onboarding endpoints to change application status. Pending reset is not supported.',
    );
  }

  const owners = await listAdminOwners();
  const row = owners.find((o) => o.id === ownerProfileId);
  if (!row) {
    throw new AppError(500, 'INTERNAL', 'Failed to load owner after update');
  }
  return row;
}

export async function listAdminProperties(): Promise<AdminPropertyRow[]> {
  const properties = await prisma.property.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      owner: { include: { user: { select: { email: true } } } },
      media: { orderBy: { sortOrder: 'asc' }, take: 1 },
      _count: { select: { bookings: true } },
    },
  });

  return properties.map((p) => ({
    id: p.id,
    slug: p.slug,
    titleAr: p.titleAr,
    titleEn: p.titleEn ?? p.titleAr,
    ownerDisplayName: p.owner.displayName,
    ownerEmail: p.owner.user.email,
    area: p.area,
    city: p.city,
    status: p.status,
    verificationStatus: p.verificationStatus,
    basePrice: nullableDecimalToNumber(p.basePrice),
    currency: p.currency,
    bookingsCount: p._count.bookings,
    imageUrl: p.media[0] ? resolvePropertyMediaPublicUrl(p.media[0]) : undefined,
  }));
}

export async function getAdminPropertyById(id: string): Promise<AdminPropertyDetail | null> {
  const p = await prisma.property.findUnique({
    where: { id },
    include: {
      owner: { include: { user: { select: { email: true } } } },
      media: { orderBy: { sortOrder: 'asc' } },
      amenities: { include: { amenity: true } },
      _count: { select: { bookings: true } },
    },
  });
  if (!p) return null;

  return {
    id: p.id,
    slug: p.slug,
    titleAr: p.titleAr,
    titleEn: p.titleEn ?? p.titleAr,
    ownerDisplayName: p.owner.displayName,
    ownerEmail: p.owner.user.email,
    area: p.area,
    city: p.city,
    status: p.status,
    verificationStatus: p.verificationStatus,
    basePrice: nullableDecimalToNumber(p.basePrice),
    currency: p.currency,
    bookingsCount: p._count.bookings,
    imageUrl: p.media[0] ? resolvePropertyMediaPublicUrl(p.media[0]) : undefined,
    media: p.media.map((m) => ({
      id: m.id,
      propertyId: m.propertyId,
      url: resolvePropertyMediaPublicUrl(m),
      storageKey: m.storageKey ?? null,
      type: 'image',
      altAr: m.altAr,
      altEn: m.altEn,
      sortOrder: m.sortOrder,
      isCover: m.sortOrder === 0,
      createdAt: m.createdAt.toISOString(),
    })),
    capacity: p.capacity,
    allowsOvernight: p.allowsOvernight,
    descriptionAr: p.descriptionAr,
    descriptionEn: p.descriptionEn ?? '',
    approximateAddress: p.approximateAddress,
    exactAddress: p.exactAddress,
    latitudeApprox: p.latitudeApprox,
    longitudeApprox: p.longitudeApprox,
    latitudeExact: p.latitudeExact,
    longitudeExact: p.longitudeExact,
    arrivalInstructionsAr: p.arrivalInstructionsAr,
    arrivalInstructionsEn: p.arrivalInstructionsEn,
    type: p.type,
    amenityKeys: p.amenities.map((a) => a.amenity.key),
    availabilityHealth: await getPropertyAvailabilityHealth(id),
    promotions: await listAdminPropertyPromotions(id),
    coupons: await listAdminPropertyCoupons(id),
    placements: await listAdminPropertyPlacements(id),
    reviewChangeReason: p.reviewChangeReason ?? null,
    reviewChangeRequestedAt: p.reviewChangeRequestedAt?.toISOString() ?? null,
    reviewRejectionReason: p.reviewRejectionReason ?? null,
    reviewRejectedAt: p.reviewRejectedAt?.toISOString() ?? null,
  };
}

export async function patchAdminPropertyStatus(
  actorUserId: string,
  propertyId: string,
  input: PatchAdminPropertyStatusInput,
  req?: AuthenticatedRequest,
): Promise<AdminPropertyDetail> {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    include: { owner: { select: { userId: true } } },
  });
  if (!property) {
    throw new AppError(404, 'NOT_FOUND', 'Property not found');
  }

  const currentStatus = property.status;
  const targetStatus = input.status as PropertyStatus;
  const isReasonRefresh = isAdminPropertyChangeReasonRefresh(currentStatus, targetStatus);

  assertAdminPropertyStatusTransitionOrThrow(currentStatus, targetStatus);

  if (targetStatus === PropertyStatus.changes_requested) {
    const trimmedReason = input.reason?.trim() ?? '';
    if (!trimmedReason) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Reason is required when requesting changes', {
        field: 'reason',
      });
    }
  }

  if (targetStatus === PropertyStatus.rejected) {
    const trimmedRejectionReason = input.reason?.trim() ?? '';
    if (!trimmedRejectionReason) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Reason is required when rejecting a property', {
        field: 'reason',
      });
    }
  }

  if (targetStatus === PropertyStatus.published && !isReasonRefresh) {
    await assertMediaForPublish(propertyId);
    assertPropertyListingComplete(property);
    await assertAndGenerateForPublish(propertyId, property.status);
  }

  const isChangesRequested = targetStatus === PropertyStatus.changes_requested;
  const isRejected = targetStatus === PropertyStatus.rejected;
  const trimmedReason = input.reason?.trim() ?? '';

  const updateData: {
    status?: PropertyStatus;
    reviewChangeReason?: string | null;
    reviewChangeRequestedAt?: Date | null;
    reviewRejectionReason?: string | null;
    reviewRejectedAt?: Date | null;
  } = {};

  if (isChangesRequested) {
    updateData.reviewChangeReason = trimmedReason;
    updateData.reviewChangeRequestedAt = new Date();
    if (!isReasonRefresh) {
      updateData.status = PropertyStatus.changes_requested;
    }
  } else if (isRejected) {
    updateData.status = PropertyStatus.rejected;
    updateData.reviewRejectionReason = trimmedReason;
    updateData.reviewRejectedAt = new Date();
    updateData.reviewChangeReason = null;
    updateData.reviewChangeRequestedAt = null;
  } else {
    updateData.status = targetStatus;
    updateData.reviewChangeReason = null;
    updateData.reviewChangeRequestedAt = null;
  }

  const updated = await prisma.property.updateMany({
    where: { id: propertyId, status: currentStatus },
    data: updateData,
  });

  if (updated.count !== 1) {
    throw new AppError(
      409,
      'INVALID_PROPERTY_STATUS_TRANSITION',
      `Cannot transition property from ${currentStatus} to ${targetStatus}`,
      { from: currentStatus, to: targetStatus },
    );
  }

  await createAuditLog({
    actorUserId,
    action: isReasonRefresh ? 'admin.property_change_reason_refresh' : 'admin.property_status_updated',
    entityType: 'property',
    entityId: propertyId,
    metadata: {
      previousStatus: currentStatus,
      newStatus: targetStatus,
      ...(isChangesRequested ? { hasReviewChangeReason: true } : {}),
      ...(isRejected ? { hasReviewRejectionReason: true } : {}),
    },
    req,
  });

  if (targetStatus === PropertyStatus.published) {
    void notifyPropertyPublished({
      ownerUserId: property.owner.userId,
      propertyId,
      titleAr: property.titleAr,
      titleEn: property.titleEn ?? property.titleAr,
    }).catch((err) => console.error('[notifications] admin.property_published', err));
  } else if (isChangesRequested) {
    void notifyPropertyChangesRequested({
      ownerUserId: property.owner.userId,
      propertyId,
      titleAr: property.titleAr,
    }).catch((err) => console.error('[notifications] admin.property_changes_requested', err));
  } else if (isRejected) {
    void notifyPropertyRejected({
      ownerUserId: property.owner.userId,
      propertyId,
      titleAr: property.titleAr,
      titleEn: property.titleEn ?? property.titleAr,
    }).catch((err) => console.error('[notifications] admin.property_rejected', err));
  }

  const detail = await getAdminPropertyById(propertyId);
  return detail!;
}

export async function listAdminBookings(): Promise<AdminBookingRow[]> {
  const bookings = await prisma.booking.findMany({
    orderBy: [{ slot: { date: 'desc' } }, { createdAt: 'desc' }],
    include: {
      user: { select: { name: true, email: true } },
      property: {
        include: { owner: { select: { displayName: true } } },
      },
      slot: { select: { date: true, period: true } },
      payments: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  });

  return bookings.map((b) => {
    const pay = b.payments[0];
    return {
      id: b.id,
      publicCode: b.publicCode,
      status: b.status,
      customerName: b.user.name,
      customerEmail: b.user.email,
      propertySlug: b.property.slug,
      propertyTitleAr: b.property.titleAr,
      propertyTitleEn: b.property.titleEn ?? b.property.titleAr,
      ownerDisplayName: b.property.owner.displayName,
      date: formatDateOnly(b.slot.date),
      period: b.slot.period,
      guestsCount: b.guestsCount,
      totalAmount: decimalToNumber(b.totalAmount),
      currency: b.currency,
      createdAt: b.createdAt.toISOString(),
      paymentStatus: toPaymentDisplayStatus(pay, b.status),
      customerPayableAmount: pay ? decimalToNumber(pay.customerPayableAmount) : null,
      platformCommissionAmount: decimalToNumber(b.platformCommissionAmount),
      ownerNetPayoutAmount: decimalToNumber(b.ownerNetPayoutAmount),
      payoutStatus: b.paymentState === 'fully_paid' ? pay?.payoutStatus ?? null : 'not_ready',
      payoutAvailableAt:
        b.paymentState === 'fully_paid' ? pay?.payoutAvailableAt?.toISOString() ?? null : null,
      refundStatus: pay?.refundStatus ?? null,
      cancellationRefundAmount:
        pay?.cancellationRefundAmount != null
          ? decimalToNumber(pay.cancellationRefundAmount)
          : null,
      paymentState: b.paymentState,
      paymentCollectionMode: b.paymentCollectionMode,
      isFullyPaid: b.paymentState === 'fully_paid',
    };
  });
}

export async function listAdminAvailability(
  query: AdminAvailabilityQuery,
): Promise<OwnerAvailabilitySlotRow[]> {
  const fromDate = parseDateOnly(query.from);
  const toDate = parseDateOnly(query.to);

  const property = await prisma.property.findUnique({
    where: { id: query.propertyId },
    select: { id: true },
  });
  if (!property) {
    throw new AppError(404, 'NOT_FOUND', 'Property not found');
  }

  const slots = await prisma.availabilitySlot.findMany({
    where: {
      propertyId: query.propertyId,
      date: { gte: fromDate, lte: toDate },
    },
    orderBy: [{ date: 'asc' }, { period: 'asc' }],
    include: {
      bookings: {
        where: { status: { in: SLOT_HOLDING_STATUSES } },
        select: { id: true },
        take: 1,
      },
    },
  });

  return slots.map((s) =>
    mapOwnerSlotRow({
      ...s,
      hasActiveBooking: s.bookings.length > 0 || s.status === AvailabilitySlotStatus.booked,
    }),
  );
}

export async function patchAdminAvailabilitySlot(
  actorUserId: string,
  slotId: string,
  input: PatchAdminAvailabilityInput,
  req?: AuthenticatedRequest,
): Promise<OwnerAvailabilitySlotRow> {
  const slot = await prisma.availabilitySlot.findUnique({
    where: { id: slotId },
    include: {
      property: { select: { id: true } },
      bookings: {
        where: { status: { in: SLOT_HOLDING_STATUSES } },
        select: { id: true },
        take: 1,
      },
    },
  });

  if (!slot) {
    throw new AppError(404, 'NOT_FOUND', 'Availability slot not found');
  }

  const hasActive =
    slot.bookings.length > 0 || slot.status === AvailabilitySlotStatus.booked;

  if (hasActive) {
    throw new AppError(
      409,
      'SLOT_HAS_ACTIVE_BOOKING',
      'Cannot modify a slot with an active booking',
    );
  }

  const prevStatus = slot.status;
  const prevPrice = decimalToNumber(slot.price);

  const data: {
    status?: AvailabilitySlotStatus;
    price?: number;
    priceOverridden?: boolean;
  } = {};
  if (input.status !== undefined) {
    data.status =
      input.status === 'blocked'
        ? AvailabilitySlotStatus.blocked
        : AvailabilitySlotStatus.available;
  }
  if (input.price !== undefined) {
    data.price = input.price;
    data.priceOverridden = true;
  }

  const updated = await prisma.availabilitySlot.update({
    where: { id: slotId },
    data,
  });

  await createAuditLog({
    actorUserId,
    action: 'admin.availability_updated',
    entityType: 'availability_slot',
    entityId: slotId,
    metadata: {
      propertyId: slot.propertyId,
      previousStatus: prevStatus,
      newStatus: updated.status,
      previousPrice: prevPrice,
      newPrice: input.price ?? prevPrice,
    },
    req,
  });

  return mapOwnerSlotRow({
    ...updated,
    hasActiveBooking: false,
  });
}

export async function listAdminAuditLogs(limit = 100): Promise<AdminAuditLogRow[]> {
  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { actor: { select: { email: true, name: true } } },
  });
  return logs.map(mapAuditLog);
}

export async function getAdminAvailabilityHealth(propertyId: string) {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { id: true },
  });
  if (!property) {
    throw new AppError(404, 'NOT_FOUND', 'Property not found');
  }
  return getPropertyAvailabilityHealth(propertyId);
}
