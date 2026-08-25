import type { BookingStatus } from './constants';
import { DateTime } from 'luxon';
import { DEFAULT_PLATFORM_TIME_ZONE } from './timezone';

export const OWNER_INBOX_GROUPS = [
  'needs_action',
  'waiting_payment',
  'upcoming',
  'past',
  'closed',
] as const;
export type OwnerInboxGroup = (typeof OWNER_INBOX_GROUPS)[number];

export const OWNER_INBOX_TABS = ['action', 'waiting', 'upcoming', 'history'] as const;
export type OwnerInboxTab = (typeof OWNER_INBOX_TABS)[number];

export function classifyOwnerInboxGroup(params: {
  status: BookingStatus | string;
  date: string;
  timeZone?: string;
  now?: Date;
}): OwnerInboxGroup {
  const status = params.status;
  if (status === 'pending_owner_approval') return 'needs_action';
  if (status === 'pending_payment' || status === 'pending') return 'waiting_payment';
  if (status === 'cancelled' || status === 'expired') return 'closed';
  if (status === 'confirmed') {
    const zone = params.timeZone || DEFAULT_PLATFORM_TIME_ZONE;
    const today = DateTime.fromJSDate(params.now ?? new Date(), { zone }).startOf('day');
    const slotDay = DateTime.fromISO(params.date, { zone }).startOf('day');
    if (slotDay.isValid && slotDay >= today) return 'upcoming';
    return 'past';
  }
  return 'closed';
}

export function ownerInboxTabForGroup(group: OwnerInboxGroup): OwnerInboxTab {
  if (group === 'needs_action') return 'action';
  if (group === 'waiting_payment') return 'waiting';
  if (group === 'upcoming') return 'upcoming';
  return 'history';
}

export function ownerInboxTabMatches(tab: OwnerInboxTab, group: OwnerInboxGroup): boolean {
  return ownerInboxTabForGroup(group) === tab;
}

export function notificationActionHref(params: {
  type: string;
  entityType?: string | null;
  entityId?: string | null;
  role: string;
}): string | null {
  const { type, entityId, role } = params;
  if (!entityId) return null;

  if (role === 'owner') {
    if (type === 'booking.request_created') {
      return `/owner/bookings?inbox=action&focus=${encodeURIComponent(entityId)}`;
    }
    if (type === 'booking.request_expired') {
      return `/owner/bookings?inbox=history&focus=${encodeURIComponent(entityId)}`;
    }
    if (type === 'booking.confirmed' || type === 'booking.deposit_paid') {
      return `/owner/bookings?inbox=upcoming&focus=${encodeURIComponent(entityId)}`;
    }
    if (type === 'review.published') {
      return '/owner/reviews';
    }
  }

  if (role === 'customer' && (type.startsWith('booking.') || type === 'review.invite')) {
    return '/account/bookings';
  }

  if (type.startsWith('support.')) {
    if (role === 'admin') return '/admin/support';
    if (role === 'customer') return '/account/support';
  }

  return null;
}
