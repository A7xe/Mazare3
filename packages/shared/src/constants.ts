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
  'pending_owner_approval',
  'pending_payment',
  'confirmed',
  'cancelled',
  'expired',
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const BOOKING_MODES = ['instant', 'owner_approval'] as const;
export type BookingMode = (typeof BOOKING_MODES)[number];

export const OWNER_DECISION_STATES = [
  'not_applicable',
  'pending',
  'accepted',
  'rejected',
  'expired',
] as const;
export type OwnerDecisionState = (typeof OWNER_DECISION_STATES)[number];

/** Booking statuses that hold a slot (not available for others). */
export const SLOT_HOLDING_BOOKING_STATUSES = [
  'pending_payment',
  'pending_owner_approval',
  'pending',
  'confirmed',
] as const;

/** Alias — Phase 3C.4E.3 inventory-holding set (must match DB partial unique WHERE). */
export const BOOKING_INVENTORY_HOLDING_STATUSES = SLOT_HOLDING_BOOKING_STATUSES;

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

export const PAYMENT_PURPOSES = ['full', 'deposit', 'balance', 'reschedule_difference'] as const;
export type PaymentPurpose = (typeof PAYMENT_PURPOSES)[number];

export const PAYMENT_COLLECTION_MODES = ['full', 'deposit_balance'] as const;
export type PaymentCollectionMode = (typeof PAYMENT_COLLECTION_MODES)[number];

export const BOOKING_PAYMENT_STATES = [
  'unpaid',
  'deposit_pending',
  'deposit_paid',
  'balance_pending',
  'fully_paid',
  'balance_overdue',
  'partially_refunded',
  'refunded',
] as const;
export type BookingPaymentState = (typeof BOOKING_PAYMENT_STATES)[number];

/** Test fixture default only — not a commercial deposit rate. */
export const TEST_DEFAULT_DEPOSIT_PERCENT = 30;

export const PAYMENT_PROVIDERS = ['test', 'cliq', 'card_gateway', 'paytabs'] as const;
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
  'customer_no_show',
  'owner_no_show',
  'force_majeure',
] as const;

export const OWNER_CANCELLATION_REASONS = [
  'PROPERTY_UNAVAILABLE',
  'OWNER_EMERGENCY',
  'MAINTENANCE_FAILURE',
  'DOUBLE_BOOKING_OWNER_FAULT',
  'PROPERTY_DAMAGE',
  'ACCESS_PROBLEM',
  'FORCE_MAJEURE',
  'OTHER',
] as const;

export const ARRIVAL_INCIDENT_TYPES = [
  'owner_no_show_report',
  'access_denied_report',
  'property_unavailable_report',
] as const;
export type DisputeType = (typeof DISPUTE_TYPES)[number];

export const DISPUTE_STATUSES = ['open', 'under_review', 'resolved', 'rejected'] as const;
export type DisputeStatus = (typeof DISPUTE_STATUSES)[number];

export const BLOCKING_DISPUTE_STATUSES = ['open', 'under_review'] as const;

export const SUPPORT_TICKET_SOURCES = ['booking', 'general'] as const;
export type SupportTicketSource = (typeof SUPPORT_TICKET_SOURCES)[number];

export const SUPPORT_TICKET_STATUSES = ['open', 'in_progress', 'resolved', 'closed'] as const;
export type SupportTicketStatus = (typeof SUPPORT_TICKET_STATUSES)[number];

export const OPEN_SUPPORT_TICKET_STATUSES = ['open', 'in_progress'] as const;

export const SUPPORT_TICKET_CATEGORIES = [
  'payment',
  'booking_status',
  'property_arrival',
  'cancellation_refund',
  'other',
] as const;
export type SupportTicketCategory = (typeof SUPPORT_TICKET_CATEGORIES)[number];

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
  'capacity_desc',
  'rating_desc',
  'newest',
  'distance_asc',
] as const;
export type PropertySortOption = (typeof PROPERTY_SORT_OPTIONS)[number];

/** Public marketplace sort controls. `rating_desc` remains in the API for compatibility. */
export const PUBLIC_PROPERTY_SORT_OPTIONS = [
  'recommended',
  'price_asc',
  'price_desc',
  'capacity_desc',
  'newest',
] as const;

export const SEARCH_DEFAULT_PAGE_SIZE = 24;
export const SEARCH_MAX_PAGE_SIZE = 48;

/**
 * Truthful “Recently Added / New places” window — `createdAt` only (not `updatedAt`).
 * Shared by Homepage discovery, Explore campaign tiles, and `newlyAdded=true` search.
 */
export const RECENTLY_ADDED_WINDOW_DAYS = 7;

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

export const CATALOG_PACKAGE_STATUSES = ['active', 'inactive'] as const;
export type CatalogPackageStatus = (typeof CATALOG_PACKAGE_STATUSES)[number];

export const SPONSORED_ORDER_STATUSES = [
  'pending_review',
  'approved_pending_payment',
  'paid',
  'active',
  'completed',
  'rejected',
  'cancelled',
] as const;
export type SponsoredOrderStatus = (typeof SPONSORED_ORDER_STATUSES)[number];
