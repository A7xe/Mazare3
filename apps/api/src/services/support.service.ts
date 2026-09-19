import { randomBytes } from 'crypto';
import {
  prisma,
  SupportTicketCategory,
  SupportTicketSource,
  SupportTicketStatus,
} from '@mazare3/db';
import type {
  AdminSupportTicketListQuery,
  AdminSupportTicketRow,
  CreateBookingSupportTicketInput,
  CreateGeneralSupportTicketInput,
  PatchAdminSupportTicketInput,
  SupportTicketSummary,
} from '@mazare3/shared';
import { OPEN_SUPPORT_TICKET_STATUSES } from '@mazare3/shared';
import { AppError } from '../lib/errors.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { createAuditLog } from './audit.service.js';
import { assertPriorConsentActive } from './legal/data-processing-consent.service.js';
import {
  notifySupportResponsePosted,
  notifySupportStatusChanged,
  notifySupportTicketCreated,
} from './notification.service.js';

const DUPLICATE_WINDOW_MS = 10 * 60 * 1000;

function generateSupportCode(): string {
  return `SP-${randomBytes(4).toString('hex').toUpperCase()}`;
}

async function uniqueSupportCode(): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const publicCode = generateSupportCode();
    const existing = await prisma.supportTicket.findUnique({
      where: { publicCode },
      select: { id: true },
    });
    if (!existing) return publicCode;
  }
  throw new AppError(500, 'INTERNAL_ERROR', 'Could not allocate a support reference');
}

type TicketRow = {
  id: string;
  publicCode: string;
  source: SupportTicketSource;
  status: SupportTicketStatus;
  category: SupportTicketCategory;
  subject: string;
  message: string;
  userId: string | null;
  guestName: string | null;
  guestEmail: string | null;
  bookingId: string | null;
  adminResponse: string | null;
  adminRespondedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  user?: { name: string | null; email: string | null } | null;
  booking?: {
    publicCode: string;
    status: string;
    paymentState: string;
  } | null;
};

function toCustomerSummary(row: TicketRow): SupportTicketSummary {
  return {
    id: row.id,
    publicCode: row.publicCode,
    source: row.source,
    status: row.status,
    category: row.category,
    subject: row.subject,
    message: row.message,
    bookingId: row.bookingId,
    bookingPublicCode: row.booking?.publicCode ?? null,
    adminResponse: row.adminResponse,
    adminRespondedAt: row.adminRespondedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toAdminRow(row: TicketRow): AdminSupportTicketRow {
  return {
    ...toCustomerSummary(row),
    userId: row.userId,
    customerName: row.user?.name ?? null,
    customerEmail: row.user?.email ?? null,
    guestName: row.guestName,
    guestEmail: row.guestEmail,
    bookingStatus: (row.booking?.status as AdminSupportTicketRow['bookingStatus']) ?? null,
    bookingPaymentState:
      (row.booking?.paymentState as AdminSupportTicketRow['bookingPaymentState']) ?? null,
  };
}

const customerInclude = {
  booking: { select: { publicCode: true, status: true, paymentState: true } },
} as const;

const adminInclude = {
  user: { select: { name: true, email: true } },
  booking: { select: { publicCode: true, status: true, paymentState: true } },
} as const;

export async function createBookingSupportTicket(
  userId: string,
  bookingId: string,
  input: CreateBookingSupportTicketInput,
  req?: AuthenticatedRequest,
): Promise<SupportTicketSummary> {
  // Marketplace support (not DSR / privacy complaint) — purpose-specific Prior Consent.
  await assertPriorConsentActive(userId, 'support_and_dispute_processing');

  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, userId },
    select: { id: true, publicCode: true, status: true, paymentState: true },
  });
  if (!booking) {
    throw new AppError(404, 'NOT_FOUND', 'Booking not found');
  }

  const existingOpen = await prisma.supportTicket.findFirst({
    where: {
      bookingId: booking.id,
      userId,
      status: { in: [...OPEN_SUPPORT_TICKET_STATUSES] },
    },
    orderBy: { createdAt: 'desc' },
  });
  if (existingOpen) {
    throw new AppError(
      409,
      'SUPPORT_TICKET_OPEN',
      'An open support request already exists for this booking',
    );
  }

  const row = await prisma.supportTicket.create({
    data: {
      publicCode: await uniqueSupportCode(),
      source: SupportTicketSource.booking,
      status: SupportTicketStatus.open,
      category: input.category,
      subject: input.subject.trim(),
      message: input.message.trim(),
      userId,
      bookingId: booking.id,
    },
    include: customerInclude,
  });

  await createAuditLog({
    actorUserId: userId,
    action: 'support.ticket_created',
    entityType: 'support_ticket',
    entityId: row.id,
    metadata: {
      source: 'booking',
      bookingId: booking.id,
      publicCode: row.publicCode,
      bookingPublicCode: booking.publicCode,
      category: input.category,
    },
    req,
  });

  void notifySupportTicketCreated({
    ticketId: row.id,
    publicCode: row.publicCode,
    source: 'booking',
    bookingPublicCode: booking.publicCode,
  }).catch((err) => console.error('[notifications] support.ticket_created', err));

  return toCustomerSummary(row);
}

export async function createGeneralSupportTicket(
  input: CreateGeneralSupportTicketInput,
  actor?: { userId: string; name: string | null; email: string | null } | null,
  req?: AuthenticatedRequest,
): Promise<SupportTicketSummary> {
  const subject = input.subject.trim();
  const message = input.message.trim();
  const category = input.category ?? 'other';

  // Authenticated marketplace support requires Prior Consent; guests have no user consent row.
  // DSR / privacy complaints must NOT use this path.
  if (actor?.userId) {
    await assertPriorConsentActive(actor.userId, 'support_and_dispute_processing');
  }

  if (actor?.userId) {
    const recent = await prisma.supportTicket.findFirst({
      where: {
        userId: actor.userId,
        source: SupportTicketSource.general,
        subject,
        createdAt: { gte: new Date(Date.now() - DUPLICATE_WINDOW_MS) },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (recent) {
      throw new AppError(
        409,
        'SUPPORT_TICKET_DUPLICATE',
        'A similar support request was already submitted. Please wait before sending another.',
      );
    }
  } else {
    const name = input.name?.trim();
    const email = input.email?.trim().toLowerCase();
    if (!name || !email) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Name and email are required');
    }
    const recent = await prisma.supportTicket.findFirst({
      where: {
        guestEmail: email,
        source: SupportTicketSource.general,
        subject,
        createdAt: { gte: new Date(Date.now() - DUPLICATE_WINDOW_MS) },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (recent) {
      throw new AppError(
        409,
        'SUPPORT_TICKET_DUPLICATE',
        'A similar support request was already submitted. Please wait before sending another.',
      );
    }
  }

  const guestName = actor?.userId ? null : input.name!.trim();
  const guestEmail = actor?.userId ? null : input.email!.trim().toLowerCase();

  const row = await prisma.supportTicket.create({
    data: {
      publicCode: await uniqueSupportCode(),
      source: SupportTicketSource.general,
      status: SupportTicketStatus.open,
      category,
      subject,
      message,
      userId: actor?.userId ?? null,
      guestName,
      guestEmail,
    },
    include: customerInclude,
  });

  await createAuditLog({
    actorUserId: actor?.userId ?? null,
    action: 'support.ticket_created',
    entityType: 'support_ticket',
    entityId: row.id,
    metadata: {
      source: 'general',
      publicCode: row.publicCode,
      category,
      guestEmail: guestEmail ?? undefined,
    },
    req,
  });

  void notifySupportTicketCreated({
    ticketId: row.id,
    publicCode: row.publicCode,
    source: 'general',
  }).catch((err) => console.error('[notifications] support.ticket_created', err));

  return toCustomerSummary(row);
}

export async function listMySupportTickets(userId: string): Promise<SupportTicketSummary[]> {
  const rows = await prisma.supportTicket.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: customerInclude,
  });
  return rows.map(toCustomerSummary);
}

export async function getMySupportTicket(
  userId: string,
  ticketId: string,
): Promise<SupportTicketSummary> {
  const row = await prisma.supportTicket.findFirst({
    where: { id: ticketId, userId },
    include: customerInclude,
  });
  if (!row) {
    throw new AppError(404, 'NOT_FOUND', 'Support request not found');
  }
  return toCustomerSummary(row);
}

export async function listAdminSupportTickets(
  query: AdminSupportTicketListQuery,
): Promise<AdminSupportTicketRow[]> {
  const rows = await prisma.supportTicket.findMany({
    where: {
      ...(query.status ? { status: query.status } : {}),
      ...(query.source ? { source: query.source } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: adminInclude,
  });
  return rows.map(toAdminRow);
}

export async function getAdminSupportTicket(ticketId: string): Promise<AdminSupportTicketRow> {
  const row = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    include: adminInclude,
  });
  if (!row) {
    throw new AppError(404, 'NOT_FOUND', 'Support request not found');
  }
  return toAdminRow(row);
}

export async function patchAdminSupportTicket(
  adminUserId: string,
  ticketId: string,
  input: PatchAdminSupportTicketInput,
  req?: AuthenticatedRequest,
): Promise<AdminSupportTicketRow> {
  const existing = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    include: adminInclude,
  });
  if (!existing) {
    throw new AppError(404, 'NOT_FOUND', 'Support request not found');
  }

  const nextStatus = input.status;
  const nextResponse = input.adminResponse?.trim();
  const statusChanged = nextStatus !== undefined && nextStatus !== existing.status;
  const responsePosted =
    Boolean(nextResponse) && nextResponse !== (existing.adminResponse ?? '').trim();

  const row = await prisma.supportTicket.update({
    where: { id: ticketId },
    data: {
      ...(nextStatus ? { status: nextStatus } : {}),
      ...(nextResponse
        ? { adminResponse: nextResponse, adminRespondedAt: new Date() }
        : {}),
    },
    include: adminInclude,
  });

  await createAuditLog({
    actorUserId: adminUserId,
    action: 'support.ticket_updated',
    entityType: 'support_ticket',
    entityId: row.id,
    metadata: {
      publicCode: row.publicCode,
      status: row.status,
      responsePosted,
    },
    req,
  });

  if (existing.userId && statusChanged && nextStatus) {
    void notifySupportStatusChanged({
      userId: existing.userId,
      ticketId: row.id,
      publicCode: row.publicCode,
      status: nextStatus,
    }).catch((err) => console.error('[notifications] support.status_changed', err));
  }

  if (existing.userId && responsePosted) {
    void notifySupportResponsePosted({
      userId: existing.userId,
      ticketId: row.id,
      publicCode: row.publicCode,
    }).catch((err) => console.error('[notifications] support.response_posted', err));
  }

  return toAdminRow(row);
}
