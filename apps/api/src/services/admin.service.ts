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
import { createAuditLog } from './audit.service.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { SLOT_HOLDING_STATUSES } from '../lib/payment-hold.js';
import { toPaymentDisplayStatus } from '../mappers/payment.mapper.js';

function parseDateOnly(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d));
}

function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function decimalToNumber(value: { toNumber(): number } | number): number {
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
  actor: { email: string; name: string | null } | null;
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
  const profile = await prisma.ownerProfile.findUnique({
    where: { id: ownerProfileId },
    include: { user: { select: { id: true, role: true } } },
  });
  if (!profile) {
    throw new AppError(404, 'NOT_FOUND', 'Owner profile not found');
  }

  const prevStatus = profile.status;
  const data: {
    status: OwnerStatus;
    rejectionReason?: string | null;
  } = {
    status: input.status as OwnerStatus,
  };

  if (input.status === 'rejected') {
    data.rejectionReason = input.rejectionReason?.trim() || 'Application rejected';
  } else if (input.status === 'approved') {
    data.rejectionReason = null;
  } else if (input.status === 'pending') {
    data.rejectionReason = null;
  }

  await prisma.$transaction(async (tx) => {
    await tx.ownerProfile.update({
      where: { id: ownerProfileId },
      data,
    });

    if (input.status === 'approved') {
      await tx.user.update({
        where: { id: profile.userId },
        data: { role: UserRole.owner },
      });
    } else if (input.status === 'rejected' || input.status === 'suspended') {
      if (profile.user.role === UserRole.owner) {
        await tx.user.update({
          where: { id: profile.userId },
          data: { role: UserRole.customer },
        });
      }
    }
  });

  const actionMap = {
    approved: 'admin.owner_approved',
    rejected: 'admin.owner_rejected',
    suspended: 'admin.owner_suspended',
    pending: 'admin.owner_status_updated',
  } as const;

  await createAuditLog({
    actorUserId,
    action: actionMap[input.status] ?? 'admin.owner_status_updated',
    entityType: 'owner_profile',
    entityId: ownerProfileId,
    metadata: { previousStatus: prevStatus, newStatus: input.status },
    req,
  });

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
    basePrice: decimalToNumber(p.basePrice),
    currency: p.currency,
    bookingsCount: p._count.bookings,
    imageUrl: p.media[0]?.url,
  }));
}

export async function getAdminPropertyById(id: string): Promise<AdminPropertyDetail | null> {
  const p = await prisma.property.findUnique({
    where: { id },
    include: {
      owner: { include: { user: { select: { email: true } } } },
      media: { orderBy: { sortOrder: 'asc' }, take: 1 },
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
    basePrice: decimalToNumber(p.basePrice),
    currency: p.currency,
    bookingsCount: p._count.bookings,
    imageUrl: p.media[0]?.url,
    capacity: p.capacity,
    allowsOvernight: p.allowsOvernight,
    descriptionAr: p.descriptionAr,
    descriptionEn: p.descriptionEn ?? '',
    approximateAddress: p.approximateAddress,
    exactAddress: p.exactAddress,
    type: p.type,
    amenityKeys: p.amenities.map((a) => a.amenity.key),
  };
}

export async function patchAdminPropertyStatus(
  actorUserId: string,
  propertyId: string,
  input: PatchAdminPropertyStatusInput,
  req?: AuthenticatedRequest,
): Promise<AdminPropertyDetail> {
  const property = await prisma.property.findUnique({ where: { id: propertyId } });
  if (!property) {
    throw new AppError(404, 'NOT_FOUND', 'Property not found');
  }

  await prisma.property.update({
    where: { id: propertyId },
    data: { status: input.status as PropertyStatus },
  });

  await createAuditLog({
    actorUserId,
    action: 'admin.property_status_updated',
    entityType: 'property',
    entityId: propertyId,
    metadata: { previousStatus: property.status, newStatus: input.status },
    req,
  });

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
      platformCommissionAmount: pay ? decimalToNumber(pay.platformCommissionAmount) : null,
      ownerNetPayoutAmount: pay ? decimalToNumber(pay.ownerNetPayoutAmount) : null,
      payoutStatus: pay?.payoutStatus ?? null,
      payoutAvailableAt: pay?.payoutAvailableAt?.toISOString() ?? null,
      refundStatus: pay?.refundStatus ?? null,
      cancellationRefundAmount:
        pay?.cancellationRefundAmount != null
          ? decimalToNumber(pay.cancellationRefundAmount)
          : null,
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

  return slots.map((s) => ({
    id: s.id,
    propertyId: s.propertyId,
    date: formatDateOnly(s.date),
    period: s.period,
    price: decimalToNumber(s.price),
    currency: 'JOD',
    status: s.status,
    hasActiveBooking: s.bookings.length > 0 || s.status === AvailabilitySlotStatus.booked,
  }));
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

  const data: { status?: AvailabilitySlotStatus; price?: number } = {};
  if (input.status !== undefined) {
    data.status =
      input.status === 'blocked'
        ? AvailabilitySlotStatus.blocked
        : AvailabilitySlotStatus.available;
  }
  if (input.price !== undefined) {
    data.price = input.price;
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

  return {
    id: updated.id,
    propertyId: updated.propertyId,
    date: formatDateOnly(updated.date),
    period: updated.period,
    price: decimalToNumber(updated.price),
    currency: 'JOD',
    status: updated.status,
    hasActiveBooking: false,
  };
}

export async function listAdminAuditLogs(limit = 100): Promise<AdminAuditLogRow[]> {
  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { actor: { select: { email: true, name: true } } },
  });
  return logs.map(mapAuditLog);
}
