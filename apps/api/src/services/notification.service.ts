import { prisma, UserRole, UserStatus } from '@mazare3/db';
import type { NotificationItem, NotificationListResult } from '@mazare3/shared';
import { notificationActionHref } from '@mazare3/shared';
import { AppError } from '../lib/errors.js';
import { createEmailDeliveryLogForNotification } from './email/notification-email-delivery.service.js';

export type CreateNotificationInput = {
  userId?: string | null;
  roleTarget?: UserRole | null;
  type: string;
  title: string;
  message: string;
  entityType?: string | null;
  entityId?: string | null;
  /** Skip insert when same user+type+entityId already exists */
  dedupe?: boolean;
};

function mapRow(
  row: {
    id: string;
    userId: string | null;
    roleTarget: UserRole | null;
    type: string;
    title: string;
    message: string;
    entityType: string | null;
    entityId: string | null;
    isRead: boolean;
    readAt: Date | null;
    createdAt: Date;
  },
  role?: UserRole | string | null,
): NotificationItem {
  const viewerRole = role ?? row.roleTarget;
  return {
    id: row.id,
    userId: row.userId,
    roleTarget: row.roleTarget,
    type: row.type,
    title: row.title,
    message: row.message,
    entityType: row.entityType,
    entityId: row.entityId,
    isRead: row.isRead,
    readAt: row.readAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    href: notificationActionHref({
      type: row.type,
      entityType: row.entityType,
      entityId: row.entityId,
      role: viewerRole ?? 'customer',
    }),
  };
}

export async function createNotification(
  input: CreateNotificationInput,
): Promise<NotificationItem | null> {
  if (!input.userId && !input.roleTarget) {
    return null;
  }

  if (input.dedupe !== false && input.entityId && input.userId) {
    const existing = await prisma.notification.findFirst({
      where: {
        userId: input.userId,
        type: input.type,
        entityId: input.entityId,
      },
      orderBy: { createdAt: 'desc' },
    });
    if (existing) return mapRow(existing);
  }

  const row = await prisma.notification.create({
    data: {
      userId: input.userId ?? null,
      roleTarget: input.roleTarget ?? null,
      type: input.type,
      title: input.title,
      message: input.message,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
    },
  });

  return mapRow(row);
}

export async function createForUser(
  userId: string,
  input: Omit<CreateNotificationInput, 'userId' | 'roleTarget'>,
): Promise<NotificationItem | null> {
  return createNotification({
    ...input,
    userId,
    roleTarget: null,
    dedupe: input.dedupe ?? true,
  });
}

export async function createForAdmins(
  input: Omit<CreateNotificationInput, 'userId' | 'roleTarget'>,
): Promise<NotificationItem[]> {
  const admins = await prisma.user.findMany({
    where: { role: UserRole.admin, status: UserStatus.active },
    select: { id: true },
  });

  const rows = await Promise.all(
    admins.map((admin) =>
      createForUser(admin.id, {
        ...input,
      }),
    ),
  );

  return rows.filter((n): n is NotificationItem => Boolean(n));
}

function notificationVisibilityFilter(userId: string, role: UserRole) {
  return {
    OR: [
      { userId },
      ...(role === UserRole.admin
        ? [{ roleTarget: UserRole.admin, userId: null }]
        : []),
      ...(role === UserRole.owner
        ? [{ roleTarget: UserRole.owner, userId: null }]
        : []),
    ],
  };
}

export async function listMyNotifications(
  userId: string,
  role: UserRole,
  limit = 30,
): Promise<NotificationListResult> {
  const where = notificationVisibilityFilter(userId, role);

  const [rows, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    }),
    prisma.notification.count({
      where: { ...where, isRead: false },
    }),
  ]);

  return {
    items: rows.map((row) => mapRow(row, role)),
    unreadCount,
  };
}

async function assertCanAccessNotification(
  notificationId: string,
  userId: string,
  role: UserRole,
) {
  const row = await prisma.notification.findUnique({ where: { id: notificationId } });
  if (!row) {
    throw new AppError(404, 'NOT_FOUND', 'Notification not found');
  }

  const isOwner = row.userId === userId;
  const isRoleBroadcast =
    row.userId == null &&
    row.roleTarget != null &&
    row.roleTarget === role;

  if (!isOwner && !isRoleBroadcast) {
    throw new AppError(403, 'FORBIDDEN', 'You cannot access this notification');
  }

  return row;
}

export async function markRead(
  userId: string,
  role: UserRole,
  notificationId: string,
): Promise<NotificationItem> {
  await assertCanAccessNotification(notificationId, userId, role);

  const updated = await prisma.notification.update({
    where: { id: notificationId },
    data: { isRead: true, readAt: new Date() },
  });

  return mapRow(updated, role);
}

export async function markAllRead(userId: string, role: UserRole): Promise<{ updated: number }> {
  const where = notificationVisibilityFilter(userId, role);
  const result = await prisma.notification.updateMany({
    where: { ...where, isRead: false },
    data: { isRead: true, readAt: new Date() },
  });
  return { updated: result.count };
}

// ── Event helpers (DB only — no email/SMS) ───────────────────────────────────

async function userLocale(userId: string): Promise<'ar' | 'en'> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { locale: true } });
  return u?.locale === 'en' ? 'en' : 'ar';
}

function t(locale: 'ar' | 'en', ar: string, en: string) {
  return locale === 'en' ? en : ar;
}

export async function notifyBookingRequestCreated(params: {
  ownerUserId: string;
  bookingId: string;
  publicCode: string;
  propertyTitleAr: string;
  propertyTitleEn: string;
}) {
  const locale = await userLocale(params.ownerUserId);
  await createForUser(params.ownerUserId, {
    type: 'booking.request_created',
    title: t(locale, 'طلب حجز جديد', 'New booking request'),
    message: t(
      locale,
      `طلب حجز جديد برمز ${params.publicCode} بانتظار موافقتك.`,
      `New booking request ${params.publicCode} is waiting for your approval.`,
    ),
    entityType: 'booking',
    entityId: params.bookingId,
    dedupe: false,
  });
}

export async function notifyBookingAccepted(params: {
  customerUserId: string;
  bookingId: string;
  publicCode: string;
  propertyTitleAr: string;
  propertyTitleEn: string;
}) {
  const locale = await userLocale(params.customerUserId);
  await createForUser(params.customerUserId, {
    type: 'booking.accepted',
    title: t(locale, 'تم قبول الحجز', 'Booking accepted'),
    message: t(
      locale,
      `قبل صاحب المزرعة طلبك ${params.publicCode}. ادفع العربون لتأكيد الحجز.`,
      `The owner accepted request ${params.publicCode}. Pay the deposit to confirm.`,
    ),
    entityType: 'booking',
    entityId: params.bookingId,
    dedupe: false,
  });
}

export async function notifyBookingRejected(params: {
  customerUserId: string;
  bookingId: string;
  publicCode: string;
  propertyTitleAr: string;
  propertyTitleEn: string;
  reason: string | null;
}) {
  const locale = await userLocale(params.customerUserId);
  const reasonBit = params.reason
    ? locale === 'en'
      ? ` Reason: ${params.reason}`
      : ` السبب: ${params.reason}`
    : '';
  await createForUser(params.customerUserId, {
    type: 'booking.rejected',
    title: t(locale, 'تم رفض طلب الحجز', 'Booking request declined'),
    message: t(
      locale,
      `رفض صاحب المزرعة طلبك ${params.publicCode}.${reasonBit}`,
      `The owner declined request ${params.publicCode}.${reasonBit}`,
    ),
    entityType: 'booking',
    entityId: params.bookingId,
    dedupe: false,
  });
}

export async function notifyBookingRequestExpired(params: {
  customerUserId: string;
  ownerUserId: string;
  bookingId: string;
  publicCode: string;
  propertyTitleAr: string;
  propertyTitleEn: string;
}) {
  const [customerLocale, ownerLocale_] = await Promise.all([
    userLocale(params.customerUserId),
    userLocale(params.ownerUserId),
  ]);
  await createForUser(params.customerUserId, {
    type: 'booking.request_expired',
    title: t(customerLocale, 'انتهت مهلة الرد', 'Response time expired'),
    message: t(
      customerLocale,
      `لم يرد صاحب المزرعة على طلبك ${params.publicCode} في الوقت المحدد. لم يُخصم أي مبلغ.`,
      `The owner did not respond to request ${params.publicCode} in time. No payment was taken.`,
    ),
    entityType: 'booking',
    entityId: params.bookingId,
    dedupe: false,
  });
  await createForUser(params.ownerUserId, {
    type: 'booking.request_expired',
    title: t(ownerLocale_, 'انتهت مهلة الرد', 'Response time expired'),
    message: t(
      ownerLocale_,
      `انتهت مهلة الرد على طلب الحجز ${params.publicCode}.`,
      `The response window for booking request ${params.publicCode} has expired.`,
    ),
    entityType: 'booking',
    entityId: params.bookingId,
    dedupe: false,
  });
}

export async function notifyBookingCreated(params: {
  customerUserId: string;
  bookingId: string;
  publicCode: string;
  propertyTitleAr: string;
  propertyTitleEn: string;
}) {
  const locale = await userLocale(params.customerUserId);
  const title = t(locale, 'تم إنشاء الحجز', 'Booking created');
  const message = t(
    locale,
    `تم إنشاء حجزك ${params.publicCode}. ادفع العربون لتأكيد الحجز.`,
    `Your booking ${params.publicCode} was created. Pay the deposit to confirm.`,
  );
  await createForUser(params.customerUserId, {
    type: 'booking.created',
    title,
    message,
    entityType: 'booking',
    entityId: params.bookingId,
  });
}

export async function notifyBookingConfirmed(params: {
  customerUserId: string;
  ownerUserId: string;
  bookingId: string;
  publicCode: string;
  propertyTitleAr: string;
  propertyTitleEn: string;
}) {
  const [customerLocale, ownerLocale_] = await Promise.all([
    userLocale(params.customerUserId),
    userLocale(params.ownerUserId),
  ]);

  const customerNotif = await createForUser(params.customerUserId, {
    type: 'booking.confirmed',
    title: t(customerLocale, 'تم تأكيد الحجز', 'Booking confirmed'),
    message: t(
      customerLocale,
      `تم تأكيد حجزك ${params.publicCode} بنجاح.`,
      `Your booking ${params.publicCode} is confirmed.`,
    ),
    entityType: 'booking',
    entityId: params.bookingId,
  });
  if (customerNotif) {
    void createEmailDeliveryLogForNotification({
      notification: customerNotif,
      templateId: 'booking_confirmed',
      vars: {
        publicCode: params.publicCode,
        propertyTitleAr: params.propertyTitleAr,
        propertyTitleEn: params.propertyTitleEn,
      },
    }).catch((err) =>
      console.error('[email] booking_confirmed(customer)', err),
    );
  }

  const ownerNotif = await createForUser(params.ownerUserId, {
    type: 'booking.confirmed',
    title: t(ownerLocale_, 'حجز جديد مؤكد', 'New confirmed booking'),
    message: t(
      ownerLocale_,
      `حجز مؤكد جديد برمز ${params.publicCode} على عقارك.`,
      `New confirmed booking ${params.publicCode} on your property.`,
    ),
    entityType: 'booking',
    entityId: params.bookingId,
  });
  if (ownerNotif) {
    void createEmailDeliveryLogForNotification({
      notification: ownerNotif,
      templateId: 'booking_confirmed',
      vars: {
        publicCode: params.publicCode,
        propertyTitleAr: params.propertyTitleAr,
        propertyTitleEn: params.propertyTitleEn,
      },
    }).catch((err) =>
      console.error('[email] booking_confirmed(owner)', err),
    );
  }
}

export async function notifyPaymentSucceeded(params: {
  customerUserId: string;
  paymentId: string;
  bookingId: string;
  publicCode: string;
}) {
  const locale = await userLocale(params.customerUserId);
  const notif = await createForUser(params.customerUserId, {
    type: 'payment.succeeded',
    title: t(locale, 'تم الدفع بنجاح', 'Payment successful'),
    message: t(
      locale,
      `تم استلام دفعتك للحجز ${params.publicCode}.`,
      `We received your payment for booking ${params.publicCode}.`,
    ),
    entityType: 'payment',
    entityId: params.paymentId,
  });
  if (notif) {
    void createEmailDeliveryLogForNotification({
      notification: notif,
      templateId: 'payment_succeeded',
      vars: { publicCode: params.publicCode },
    }).catch((err) =>
      console.error('[email] payment_succeeded', err),
    );
  }
}

export async function notifyDepositPaid(params: {
  customerUserId: string;
  bookingId: string;
  publicCode: string;
  remainingAmount: number;
  currency: string;
  balanceDueAt: Date | null;
}) {
  const locale = await userLocale(params.customerUserId);
  const due = params.balanceDueAt
    ? params.balanceDueAt.toISOString().slice(0, 10)
    : '';
  await createForUser(params.customerUserId, {
    type: 'booking.deposit_paid',
    title: t(locale, 'تم دفع العربون', 'Deposit paid'),
    message: t(
      locale,
      `تم استلام عربون الحجز ${params.publicCode}. الرصيد المتبقي ${params.remainingAmount} ${params.currency}${due ? ` — يُستحق بحلول ${due}` : ''}.`,
      `Deposit received for booking ${params.publicCode}. Remaining ${params.remainingAmount} ${params.currency}${due ? ` is due by ${due}` : ''}.`,
    ),
    entityType: 'booking',
    entityId: params.bookingId,
  });
}

export async function notifyBalanceOverdue(params: {
  customerUserId: string;
  bookingId: string;
  publicCode: string;
  propertyTitleAr: string;
  propertyTitleEn: string;
}) {
  const locale = await userLocale(params.customerUserId);
  await createForUser(params.customerUserId, {
    type: 'booking.balance_overdue',
    title: t(locale, 'تأخر دفع الرصيد', 'Balance payment overdue'),
    message: t(
      locale,
      `لم يُدفع الرصيد المتبقي للحجز ${params.publicCode} في الموعد. الحجز مؤكد والعربون محفوظ — تواصل مع المنصة.`,
      `The remaining balance for booking ${params.publicCode} is overdue. The booking stays confirmed and the deposit is held — contact the platform.`,
    ),
    entityType: 'booking',
    entityId: params.bookingId,
    dedupe: true,
  });
  await createForAdmins({
    type: 'booking.balance_overdue',
    title: 'رصيد متأخر',
    message: `الحجز ${params.publicCode} تجاوز موعد دفع الرصيد (عقار: ${params.propertyTitleAr}).`,
    entityType: 'booking',
    entityId: params.bookingId,
    dedupe: true,
  });
}

export async function notifyRefundRequested(params: {
  refundRequestId: string;
  publicCode: string;
}) {
  const notifs = await createForAdmins({
    type: 'refund.requested',
    title: 'طلب استرداد جديد',
    message: `طلب استرداد للحجز ${params.publicCode} بانتظار المراجعة.`,
    entityType: 'refund_request',
    entityId: params.refundRequestId,
    dedupe: true,
  });
  await Promise.all(
    notifs.map((n) =>
      createEmailDeliveryLogForNotification({
        notification: n,
        templateId: 'refund_requested',
        vars: { publicCode: params.publicCode },
      }).catch((err) => console.error('[email] refund_requested', err)),
    ),
  );
}

export async function notifyDisputeOpened(params: {
  disputeId: string;
  publicCode: string;
}) {
  const notifs = await createForAdmins({
    type: 'dispute.opened',
    title: 'نزاع جديد',
    message: `تم فتح نزاع للحجز ${params.publicCode}.`,
    entityType: 'dispute',
    entityId: params.disputeId,
    dedupe: true,
  });
  await Promise.all(
    notifs.map((n) =>
      createEmailDeliveryLogForNotification({
        notification: n,
        templateId: 'dispute_opened',
        vars: { publicCode: params.publicCode },
      }).catch((err) => console.error('[email] dispute_opened', err)),
    ),
  );
}

export async function notifyOwnerApplicationSubmitted(params: {
  ownerProfileId: string;
  displayName: string;
}) {
  await createForAdmins({
    type: 'owner.application_submitted',
    title: 'طلب انضمام مالك جديد',
    message: `طلب انضمام من ${params.displayName} بانتظار المراجعة.`,
    entityType: 'owner_profile',
    entityId: params.ownerProfileId,
    dedupe: true,
  });
}

export async function notifyOwnerApproved(params: {
  ownerUserId: string;
  ownerProfileId: string;
}) {
  const locale = await userLocale(params.ownerUserId);
  const notif = await createForUser(params.ownerUserId, {
    type: 'admin.owner_approved',
    title: t(locale, 'تمت الموافقة على حسابك كمالك', 'Owner account approved'),
    message: t(
      locale,
      'يمكنك الآن إضافة عقاراتك وإدارة الحجوزات من لوحة المالك.',
      'You can now add properties and manage bookings from your owner dashboard.',
    ),
    entityType: 'owner_profile',
    entityId: params.ownerProfileId,
  });
  if (notif) {
    void createEmailDeliveryLogForNotification({
      notification: notif,
      templateId: 'owner_application_approved',
      vars: {},
    }).catch((err) => console.error('[email] owner_application_approved', err));
  }
}

export async function notifyPropertySubmittedForReview(params: {
  propertyId: string;
  titleAr: string;
}) {
  await createForAdmins({
    type: 'owner.property_submitted_for_review',
    title: 'عقار بانتظار المراجعة',
    message: `العقار «${params.titleAr}» أُرسل للمراجعة.`,
    entityType: 'property',
    entityId: params.propertyId,
    dedupe: true,
  });
}

export async function notifyPropertyPublished(params: {
  ownerUserId: string;
  propertyId: string;
  titleAr: string;
  titleEn: string;
}) {
  const locale = await userLocale(params.ownerUserId);
  const notif = await createForUser(params.ownerUserId, {
    type: 'admin.property_published',
    title: t(locale, 'تم نشر عقارك', 'Your property is published'),
    message: t(
      locale,
      `العقار «${params.titleAr}» أصبح متاحًا للحجز على المنصة.`,
      `Your property "${params.titleEn}" is now live for bookings.`,
    ),
    entityType: 'property',
    entityId: params.propertyId,
  });
  if (notif) {
    void createEmailDeliveryLogForNotification({
      notification: notif,
      templateId: 'property_published',
      vars: { propertyTitleAr: params.titleAr, propertyTitleEn: params.titleEn },
    }).catch((err) => console.error('[email] property_published', err));
  }
}

export async function notifyPropertyChangesRequested(params: {
  ownerUserId: string;
  propertyId: string;
  titleAr: string;
}) {
  const locale = await userLocale(params.ownerUserId);
  await createForUser(params.ownerUserId, {
    type: 'admin.property_changes_requested',
    title: t(locale, 'مطلوب تعديلات على العقار', 'Property changes requested'),
    message: t(
      locale,
      `هناك تعديلات مطلوبة على مزرعتك «${params.titleAr}». راجع الملاحظات في صفحة المزرعة.`,
      `Changes are needed on "${params.titleAr}". Review the notes on your property page.`,
    ),
    entityType: 'property',
    entityId: params.propertyId,
  });
}

export async function notifyPropertyRejected(params: {
  ownerUserId: string;
  propertyId: string;
  titleAr: string;
  titleEn: string;
}) {
  const locale = await userLocale(params.ownerUserId);
  await createForUser(params.ownerUserId, {
    type: 'admin.property_rejected',
    title: t(locale, 'لم يتم اعتماد المزرعة', 'Property not approved'),
    message: t(
      locale,
      `لم يتم اعتماد مزرعتك «${params.titleAr}». يمكنك مراجعة سبب الرفض من صفحة المزرعة.`,
      `Your property "${params.titleEn}" was not approved. Review the rejection reason on the property page.`,
    ),
    entityType: 'property',
    entityId: params.propertyId,
  });
}

export async function notifyPayoutMarkedPaid(params: {
  ownerUserId: string;
  paymentId: string;
  amount: number;
  currency: string;
  manualReference: string;
}) {
  const locale = await userLocale(params.ownerUserId);
  const notif = await createForUser(params.ownerUserId, {
    type: 'payout.marked_paid',
    title: t(locale, 'تم تسجيل تحويل مستحقاتك', 'Payout recorded'),
    message: t(
      locale,
      `تم تسجيل تحويل ${params.amount} ${params.currency} (مرجع: ${params.manualReference}).`,
      `A payout of ${params.amount} ${params.currency} was recorded (ref: ${params.manualReference}).`,
    ),
    entityType: 'payment',
    entityId: params.paymentId,
  });
  if (notif) {
    void createEmailDeliveryLogForNotification({
      notification: notif,
      templateId: 'payout_marked_paid',
      vars: {
        amount: params.amount,
        currency: params.currency,
        manualReference: params.manualReference,
      },
    }).catch((err) => console.error('[email] payout_marked_paid', err));
  }
}

export async function notifySettlementReady(params: {
  ownerUserId: string;
  settlementId: string;
  ownerNetAmount: number;
  currency: string;
  periodEnd: string;
}) {
  const locale = await userLocale(params.ownerUserId);
  await createForUser(params.ownerUserId, {
    type: 'settlement.ready',
    title: t(locale, 'كشف تسوية جاهز', 'Settlement statement ready'),
    message: t(
      locale,
      `كشف تسوية حتى ${params.periodEnd} جاهز بمبلغ ${params.ownerNetAmount} ${params.currency}.`,
      `A settlement through ${params.periodEnd} is ready for ${params.ownerNetAmount} ${params.currency}.`,
    ),
    entityType: 'owner_settlement',
    entityId: params.settlementId,
  });
}

export async function notifySettlementPaid(params: {
  ownerUserId: string;
  settlementId: string;
  ownerNetAmount: number;
  currency: string;
  paymentReference: string;
}) {
  const locale = await userLocale(params.ownerUserId);
  await createForUser(params.ownerUserId, {
    type: 'settlement.paid',
    title: t(locale, 'تم دفع التسوية', 'Settlement paid'),
    message: t(
      locale,
      `تم تسجيل دفع تسوية ${params.ownerNetAmount} ${params.currency} (مرجع: ${params.paymentReference}).`,
      `A settlement payout of ${params.ownerNetAmount} ${params.currency} was recorded (ref: ${params.paymentReference}).`,
    ),
    entityType: 'owner_settlement',
    entityId: params.settlementId,
  });
}

export async function notifyReviewInvite(params: { userId: string; bookingId: string }) {
  const locale = await userLocale(params.userId);
  await createForUser(params.userId, {
    type: 'review.invite',
    title: t(locale, 'قيّم تجربتك', 'Rate your stay'),
    message: t(
      locale,
      'يمكنك تقييم إقامتك بعد انتهاء الزيارة.',
      'You can rate your stay now that the visit has ended.',
    ),
    entityType: 'booking',
    entityId: params.bookingId,
    dedupe: true,
  });
}

export async function notifyReviewPublished(params: {
  ownerUserId: string;
  propertyTitleAr: string;
  rating: number;
  reviewId: string;
}) {
  const locale = await userLocale(params.ownerUserId);
  await createForUser(params.ownerUserId, {
    type: 'review.published',
    title: t(locale, 'تقييم جديد', 'New review'),
    message: t(
      locale,
      `وصلك تقييم ${params.rating}/5 على ${params.propertyTitleAr}.`,
      `You received a ${params.rating}/5 review on ${params.propertyTitleAr}.`,
    ),
    entityType: 'review',
    entityId: params.reviewId,
    dedupe: true,
  });
}

function partnerT(locale: string, ar: string, en: string) {
  return locale === 'en' ? en : ar;
}

export async function notifyPartnerApplicationSubmitted(params: {
  ownerProfileId: string;
  displayName: string;
}) {
  await createForAdmins({
    type: 'partner.application_submitted',
    title: 'طلب شريك جديد',
    message: `طلب انضمام من ${params.displayName} بانتظار المراجعة.`,
    entityType: 'owner_profile',
    entityId: params.ownerProfileId,
    dedupe: true,
  });
}

export async function notifyPartnerEnteredReview(params: {
  ownerUserId: string;
  ownerProfileId: string;
}) {
  const locale = await userLocale(params.ownerUserId);
  await createForUser(params.ownerUserId, {
    type: 'partner.under_review',
    title: partnerT(locale, 'طلبك قيد المراجعة', 'Your application is under review'),
    message: partnerT(
      locale,
      'بدأ فريق المنصة مراجعة ملف الشريك الخاص بك.',
      'The platform team has started reviewing your partner file.',
    ),
    entityType: 'owner_profile',
    entityId: params.ownerProfileId,
  });
}

export async function notifyPartnerChangesRequested(params: {
  ownerUserId: string;
  ownerProfileId: string;
  reason: string;
}) {
  const locale = await userLocale(params.ownerUserId);
  await createForUser(params.ownerUserId, {
    type: 'partner.changes_requested',
    title: partnerT(locale, 'مطلوب تعديل على طلبك', 'Changes requested on your application'),
    message: params.reason,
    entityType: 'owner_profile',
    entityId: params.ownerProfileId,
    dedupe: false,
  });
}

export async function notifyPartnerDocumentRejected(params: {
  ownerUserId: string;
  ownerProfileId: string;
  reason: string;
}) {
  const locale = await userLocale(params.ownerUserId);
  await createForUser(params.ownerUserId, {
    type: 'partner.document_rejected',
    title: partnerT(locale, 'تم رفض مستند', 'A document was rejected'),
    message: params.reason,
    entityType: 'owner_profile',
    entityId: params.ownerProfileId,
    dedupe: false,
  });
}

export async function notifyPartnerRejected(params: {
  ownerUserId: string;
  ownerProfileId: string;
  reason: string;
}) {
  const locale = await userLocale(params.ownerUserId);
  await createForUser(params.ownerUserId, {
    type: 'partner.application_rejected',
    title: partnerT(locale, 'لم تتم الموافقة على طلب الشريك', 'Partner application was not approved'),
    message: params.reason,
    entityType: 'owner_profile',
    entityId: params.ownerProfileId,
    dedupe: false,
  });
}

export async function notifyPartnerSuspended(params: {
  ownerUserId: string;
  ownerProfileId: string;
  reason: string;
}) {
  const locale = await userLocale(params.ownerUserId);
  await createForUser(params.ownerUserId, {
    type: 'partner.suspended',
    title: partnerT(locale, 'تم إيقاف حساب الشريك', 'Partner account suspended'),
    message: params.reason,
    entityType: 'owner_profile',
    entityId: params.ownerProfileId,
    dedupe: false,
  });
}

export async function notifyPartnerRestored(params: {
  ownerUserId: string;
  ownerProfileId: string;
}) {
  const locale = await userLocale(params.ownerUserId);
  await createForUser(params.ownerUserId, {
    type: 'partner.restored',
    title: partnerT(locale, 'تمت استعادة حساب الشريك', 'Partner account restored'),
    message: partnerT(
      locale,
      'يمكنك استكمال الحجوزات الجديدة إذا كانت العقارات متاحة.',
      'New bookings can resume where properties are otherwise eligible.',
    ),
    entityType: 'owner_profile',
    entityId: params.ownerProfileId,
  });
}

export async function notifySupportTicketCreated(params: {
  ticketId: string;
  publicCode: string;
  source: 'booking' | 'general';
  bookingPublicCode?: string;
}) {
  const detail =
    params.source === 'booking' && params.bookingPublicCode
      ? `booking ${params.bookingPublicCode}`
      : 'general contact';
  await createForAdmins({
    type: 'support.ticket_created',
    title: 'طلب دعم جديد',
    message: `طلب دعم ${params.publicCode} (${detail}).`,
    entityType: 'support_ticket',
    entityId: params.ticketId,
    dedupe: true,
  });
}

export async function notifySupportStatusChanged(params: {
  userId: string;
  ticketId: string;
  publicCode: string;
  status: string;
}) {
  const locale = await userLocale(params.userId);
  await createForUser(params.userId, {
    type: 'support.status_changed',
    title: t(locale, 'تحديث على طلب الدعم', 'Support request updated'),
    message: t(
      locale,
      `تم تحديث حالة طلب الدعم ${params.publicCode}.`,
      `Support request ${params.publicCode} status was updated.`,
    ),
    entityType: 'support_ticket',
    entityId: params.ticketId,
    dedupe: false,
  });
}

export async function notifySupportResponsePosted(params: {
  userId: string;
  ticketId: string;
  publicCode: string;
}) {
  const locale = await userLocale(params.userId);
  await createForUser(params.userId, {
    type: 'support.response_posted',
    title: t(locale, 'رد من دعم مزارع', 'Mazare3 support replied'),
    message: t(
      locale,
      `يوجد رد على طلب الدعم ${params.publicCode}.`,
      `There is a reply on support request ${params.publicCode}.`,
    ),
    entityType: 'support_ticket',
    entityId: params.ticketId,
    dedupe: false,
  });
}
