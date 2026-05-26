export const LOCALES = ['ar', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'ar';

export const USER_ROLES = ['customer', 'owner', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const API_VERSION = 'v1';

export const AVAILABILITY_PERIODS = ['morning', 'evening', 'full_day', 'overnight'] as const;
export type AvailabilityPeriod = (typeof AVAILABILITY_PERIODS)[number];

export const BOOKING_STATUSES = [
  'pending',
  'pending_payment',
  'confirmed',
  'cancelled',
  'expired',
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

/** Booking statuses that hold a slot (not available for others). */
export const SLOT_HOLDING_BOOKING_STATUSES = [
  'pending_payment',
  'pending',
  'confirmed',
] as const;

export const PAYMENT_STATUSES = [
  'initiated',
  'pending',
  'succeeded',
  'failed',
  'cancelled',
  'expired',
  'refunded',
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_METHODS = ['card', 'cliq', 'manual_test'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_PROVIDERS = ['test', 'cliq', 'card_gateway'] as const;
export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number];

export const ACTIVE_PAYMENT_STATUSES = ['initiated', 'pending'] as const;

export const PAYOUT_STATUSES = ['not_ready', 'pending', 'eligible', 'paid', 'blocked'] as const;
export type PayoutStatus = (typeof PAYOUT_STATUSES)[number];

export const REFUND_STATUSES = ['none', 'pending', 'approved', 'rejected', 'processed'] as const;
export type RefundStatus = (typeof REFUND_STATUSES)[number];

export const REFUND_REQUEST_STATUSES = [
  'pending',
  'approved',
  'rejected',
  'processed',
  'cancelled',
] as const;
export type RefundRequestStatus = (typeof REFUND_REQUEST_STATUSES)[number];

/** Refund requests that block owner payout until resolved. */
export const BLOCKING_REFUND_REQUEST_STATUSES = ['pending', 'approved'] as const;

export const DISPUTE_TYPES = [
  'property_mismatch',
  'owner_cancelled',
  'access_problem',
  'cleanliness_issue',
  'other',
] as const;
export type DisputeType = (typeof DISPUTE_TYPES)[number];

export const DISPUTE_STATUSES = ['open', 'under_review', 'resolved', 'rejected'] as const;
export type DisputeStatus = (typeof DISPUTE_STATUSES)[number];

export const BLOCKING_DISPUTE_STATUSES = ['open', 'under_review'] as const;

export const OWNER_PAYOUT_RECORD_STATUSES = [
  'pending',
  'eligible',
  'paid',
  'blocked',
  'cancelled',
] as const;
export type OwnerPayoutRecordStatus = (typeof OWNER_PAYOUT_RECORD_STATUSES)[number];

export const PROPERTY_SORT_OPTIONS = [
  'recommended',
  'price_asc',
  'price_desc',
  'rating_desc',
  'newest',
] as const;
export type PropertySortOption = (typeof PROPERTY_SORT_OPTIONS)[number];

export const PROPERTY_TYPES = [
  'farm',
  'chalet',
  'villa',
  'istiraha',
  'private_resort',
  'pool_house',
] as const;
export type PropertyType = (typeof PROPERTY_TYPES)[number];

export const AMENITY_KEYS = [
  'pool',
  'heated_pool',
  'indoor_pool',
  'bbq',
  'football',
  'wifi',
  'parking',
  'ac',
  'garden',
  'events',
  'kids_pool',
] as const;

export const JORDAN_CITIES = [
  { key: 'amman', labelAr: 'عمان', labelEn: 'Amman' },
  { key: 'salt', labelAr: 'السلط', labelEn: 'Salt' },
  { key: 'jerash', labelAr: 'جرش', labelEn: 'Jerash' },
  { key: 'madaba', labelAr: 'مادبا', labelEn: 'Madaba' },
  { key: 'ajloun', labelAr: 'عجلون', labelEn: 'Ajloun' },
  { key: 'dead_sea', labelAr: 'البحر الميت', labelEn: 'Dead Sea' },
  { key: 'irbid', labelAr: 'إربد', labelEn: 'Irbid' },
  { key: 'zarqa', labelAr: 'الزرقاء', labelEn: 'Zarqa' },
] as const;

/** Default payment hold window (minutes) for pending_payment bookings. */
export const PAYMENT_HOLD_MINUTES = 30;
