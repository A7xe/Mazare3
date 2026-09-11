import type {
  Locale,
  AvailabilityPeriod,
  BookingMode,
  BookingStatus,
  OwnerDecisionState,
  PropertyType,
  PayoutStatus,
  RefundStatus,
  RefundRequestStatus,
  DisputeType,
  DisputeStatus,
  SupportTicketSource,
  SupportTicketStatus,
  SupportTicketCategory,
  OwnerPayoutRecordStatus,
  PaymentPurpose,
  PaymentCollectionMode,
  BookingPaymentState,
} from './constants';

export type VerificationStatus =
  | 'unverified'
  | 'owner_uploaded'
  | 'platform_reviewed'
  | 'platform_verified';

export interface PublicPropertySummary {
  id: string;
  slug: string;
  type: PropertyType;
  titleAr: string;
  titleEn: string;
  city: string;
  area: string;
  approximateLocation: string;
  latitudeApprox?: number | null;
  longitudeApprox?: number | null;
  capacity: number;
  rating: number;
  reviewCount: number;
  basePrice: number;
  currency: string;
  verificationStatus: VerificationStatus;
  hasPlatformDeal: boolean;
  /** Live public placement only. Absent/false when none. */
  isSponsored?: boolean;
  isFeatured?: boolean;
  placementType?: 'featured' | 'sponsored' | null;
  allowsFamilies: boolean;
  allowsYouth: boolean;
  hasPool: boolean;
  hasIndoorPool: boolean;
  hasHeatedPool: boolean;
  hasFootballField: boolean;
  allowsOvernight: boolean;
  allowsEvents: boolean;
  instantBookingEnabled?: boolean;
  imageUrl?: string;
  amenityKeys: string[];
  createdAt?: string;
  /** Browse vs exact-date pricing. Absent on older payloads. */
  pricingMode?: 'browse_from' | 'exact_slot';
  searchMatch?: PropertySearchMatch | null;
  /** Present on authenticated favorite payloads; public search does not require it. */
  isFavorited?: boolean;
  /** True when a currently live property promotion exists (browse mode). */
  hasActivePromotion?: boolean;
  /**
   * Best live promotion summary for browse cards (offers rail).
   * Prices are computed from `basePrice` when the discount can be applied safely.
   */
  activePromotionSummary?: {
    discountType?: 'percentage' | 'fixed_amount' | null;
    discountValue?: number | null;
    endsAt?: string | null;
    titleAr?: string | null;
    titleEn?: string | null;
    originalFromPrice?: number | null;
    promotionalFromPrice?: number | null;
    savingsAmount?: number | null;
  } | null;
}

export interface PropertySearchPeriodSummary {
  period: AvailabilityPeriod;
  price: number;
  startAtLocal: string | null;
  endAtLocal: string | null;
  usesLegacyTiming: boolean;
  bookable: boolean;
}

export interface PropertySearchMatch {
  matchedDate: string | null;
  matchedPeriod: AvailabilityPeriod | null;
  matchedSlotId: string | null;
  startAt: string | null;
  endAt: string | null;
  startAtLocal: string | null;
  endAtLocal: string | null;
  usesLegacyTiming: boolean;
  slotPrice: number | null;
  originalSlotPrice?: number | null;
  discountAmount?: number | null;
  promotionTitleAr?: string | null;
  promotionTitleEn?: string | null;
  depositAmount: number | null;
  remainingAmount: number | null;
  matchingPeriodsCount: number;
  matchingPeriods: PropertySearchPeriodSummary[];
  bookable: boolean;
  availabilityReason: string | null;
  timeZone: string;
}

export interface PropertySearchMeta {
  mode: 'browse' | 'availability';
  total: number;
  page: number;
  pageSize: number;
  /** True when another page exists after `page` under the same query. */
  hasMore: boolean;
  timeZone: string;
  suggestions?: {
    otherBookablePeriods: AvailabilityPeriod[];
    tryWithoutDate: boolean;
  };
}

export interface PropertySearchResponse {
  data: PublicPropertySummary[];
  meta: PropertySearchMeta;
}

export interface MarketplaceDiscoverySection {
  id: string;
  propertyIds: string[];
  properties: PublicPropertySummary[];
}

/** Browse-mode campaign tile hints (Phase 2I-A). Absent key = omit that tile. */
export type MarketplaceCampaignTileHint = {
  imageUrl?: string | null;
};

export interface MarketplaceDiscoveryResponse {
  timeZone: string;
  mode: 'browse' | 'availability';
  sections: MarketplaceDiscoverySection[];
  /** Published property counts keyed by Jordan city slug (homepage destinations). */
  cityPropertyCounts?: Record<string, number>;
  /**
   * Truthful campaign availability for Explore Campaign Tiles.
   * Derived from the same discovery inventory (no per-tile requests).
   */
  campaignTiles?: {
    offers?: MarketplaceCampaignTileHint;
    newlyAdded?: MarketplaceCampaignTileHint;
    overnight?: MarketplaceCampaignTileHint;
    featured?: MarketplaceCampaignTileHint;
  };
}

export interface HomeBookAgainItem {
  bookingId: string;
  guestsCount: number;
  preferredPeriod: AvailabilityPeriod;
  property: PublicPropertySummary;
}

export interface HomePersonalizationResponse {
  bookAgain: HomeBookAgainItem[];
  favorites: PublicPropertySummary[];
}

export interface PublicPropertyDetail extends PublicPropertySummary {
  descriptionAr: string;
  descriptionEn: string;
  bedrooms: number;
  bathrooms: number;
  poolsCount: number;
  checkInTime: string;
  checkOutTime: string;
  images: { url: string; altAr: string; altEn: string }[];
  rulesAr: string[];
  rulesEn: string[];
  reviews?: PublicPropertyReview[];
  bookingDisabled?: boolean;
  bookingDisabledReason?: string | null;
  activeOffers?: PublicPropertyOffer[];
}

export interface PublicPropertyOffer {
  id: string;
  titleAr: string;
  titleEn: string;
  discountType: 'percentage' | 'fixed_amount';
  discountValue: number;
  period: AvailabilityPeriod | null;
  startsAt: string;
  endsAt: string;
}

export interface PublicPropertyReview {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  customerDisplayName: string;
}

/** Public homepage testimonials — published reviews on eligible properties only. */
export interface HomePublicTestimonial {
  id: string;
  rating: number;
  comment: string;
  createdAt: string;
  /** First-name only (same rule as property-detail public reviews). */
  customerDisplayName: string;
  propertyTitleAr: string;
  propertyTitleEn: string;
  propertyCity: string;
}

export interface PublicAvailabilitySlot {
  date: string;
  period: AvailabilityPeriod;
  price: number;
  currency: string;
  status: 'available' | 'blocked' | 'booked';
  startAt: string | null;
  endAt: string | null;
  startAtLocal: string | null;
  endAtLocal: string | null;
  timeZone: string;
  source: 'legacy' | 'generated' | 'manual';
  bookable: boolean;
  conflictReason: 'blocked' | 'booked' | 'overlapping_booking' | 'legacy_untimed' | null;
  usesLegacyTiming: boolean;
  depositAmount: number;
  remainingAmount: number;
  originalPrice?: number;
  discountAmount?: number;
  promotionId?: string | null;
  promotionTitleAr?: string | null;
  promotionTitleEn?: string | null;
}

/** CB-2 — customer-safe authoritative quote (read-only). */
export interface BookingQuote {
  propertyId: string;
  propertySlug: string;
  date: string;
  period: AvailabilityPeriod;
  guestsCount: number;
  currency: string;
  /** Pre-discount list amount shown as booking price line. */
  baseAmount: number;
  discountAmount: number;
  /**
   * Pre-fee total that `createBooking.expectedTotalAmount` must match.
   * Does not include customer service fee.
   */
  expectedTotalAmount: number;
  /** Same as expectedTotalAmount (post-discount booking amount before fee). */
  bookingAmount: number;
  customerServiceFeeAmount: number;
  customerPayableTotal: number;
  depositPercent: number;
  depositAmount: number;
  remainingAmount: number;
  /** Deposit + customer service fee (first installment). */
  depositDueAmount: number;
  startAtLocal: string | null;
  endAtLocal: string | null;
  instantBookingEnabled: boolean;
  paymentCollectionMode: 'deposit_balance';
  appliedPromotion: { id: string } | null;
  appliedCoupon: { code: string; fundedBy: 'property' | 'platform' } | null;
}

export type BookingQuoteInput = {
  propertySlug: string;
  date: string;
  period: AvailabilityPeriod;
  guestsCount: number;
  couponCode?: string;
};

export interface OwnerDashboardSummary {
  propertiesCount: number;
  upcomingBookingsCount: number;
  todayBookingsCount: number;
  weekBookingsCount: number;
  estimatedRevenueJod: number;
  occupancyPercent: number;
}

export interface OwnerPropertyCard {
  id: string;
  slug: string;
  titleAr: string;
  titleEn: string;
  status: string;
  /** Null on incomplete drafts (AF-1.1b). */
  area: string | null;
  /** Null on incomplete drafts (AF-1.1b). */
  city: string | null;
  /** Null on incomplete drafts (AF-1.1b). */
  basePrice: number | null;
  currency: string;
  bookingsCount: number;
  imageUrl?: string;
}

export interface OwnerPropertyDetail extends OwnerPropertyCard {
  capacity: number;
  allowsOvernight: boolean;
  upcomingBookingsCount: number;
  /** Active owner-safe change-request reason when status is changes_requested. */
  reviewChangeReason?: string | null;
  /** Owner-visible rejection reason when status is rejected. */
  reviewRejectionReason?: string | null;
  reviewRejectedAt?: string | null;
}

export interface PropertyPromotionRow {
  id: string;
  propertyId: string;
  titleAr: string;
  titleEn: string;
  discountType: 'percentage' | 'fixed_amount';
  discountValue: number;
  startsAt: string;
  endsAt: string;
  period: AvailabilityPeriod | null;
  status: 'draft' | 'active' | 'paused' | 'expired';
  createdAt: string;
  updatedAt: string;
}

export interface PropertyCouponRow {
  id: string;
  propertyId: string;
  normalizedCode: string;
  discountType: 'percentage' | 'fixed_amount';
  discountValue: number;
  startsAt: string;
  endsAt: string;
  minBookingAmount: number | null;
  maxUses: number | null;
  maxUsesPerCustomer: number;
  status: 'draft' | 'active' | 'paused' | 'expired';
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface PropertyPlacementRow {
  id: string;
  propertyId: string;
  placementType: 'featured' | 'sponsored';
  startsAt: string;
  endsAt: string;
  status: 'draft' | 'active' | 'paused' | 'expired';
  adminNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SponsoredPlacementPackageRow {
  id: string;
  nameAr: string;
  nameEn: string;
  durationDays: number;
  priceAmount: number;
  currency: string;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

export interface SponsoredPlacementOrderRow {
  id: string;
  ownerId: string;
  propertyId: string;
  propertyTitleAr?: string;
  propertyTitleEn?: string;
  propertySlug?: string;
  ownerDisplayName?: string;
  packageId: string | null;
  packageNameArSnapshot: string;
  packageNameEnSnapshot: string;
  durationDaysSnapshot: number;
  priceAmountSnapshot: number;
  currency: string;
  advertisingRevenueAmount: number | null;
  status:
    | 'pending_review'
    | 'approved_pending_payment'
    | 'paid'
    | 'active'
    | 'completed'
    | 'rejected'
    | 'cancelled';
  requestedAt: string;
  approvedAt: string | null;
  paidAt: string | null;
  activatedAt: string | null;
  cancelledAt: string | null;
  rejectedAt: string | null;
  paymentReference: string | null;
  paymentDate: string | null;
  adminNote: string | null;
  placementId: string | null;
  placementStartsAt: string | null;
  placementEndsAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CouponValidationResult {
  valid: boolean;
  normalizedCode: string;
  originalPrice: number;
  discountAmount: number;
  finalPrice: number;
  depositAmount: number;
  remainingAmount: number;
  couponId: string;
}

export interface PlatformCouponRow {
  id: string;
  normalizedCode: string;
  titleAr: string;
  titleEn: string;
  discountType: 'percentage' | 'fixed_amount';
  discountValue: number;
  startsAt: string;
  endsAt: string;
  minBookingAmount: number | null;
  maxUses: number | null;
  maxUsesPerCustomer: number;
  propertyId: string | null;
  status: 'draft' | 'active' | 'paused' | 'expired';
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformCouponValidationResult extends CouponValidationResult {
  originalBookingValue: number;
  platformDiscount: number;
  customerPayableTotal: number;
  depositDueNow: number;
  remainingCustomerBalance: number;
  commissionBasis: number;
  ownerExpectedNet: number;
  fundedBy: 'platform';
}

export interface OwnerBookingRow {
  id: string;
  publicCode: string;
  status: BookingStatus;
  propertyId: string;
  propertySlug: string;
  propertyTitleAr: string;
  propertyTitleEn: string;
  date: string;
  period: AvailabilityPeriod;
  startAtLocal?: string | null;
  endAtLocal?: string | null;
  timeZone?: string;
  inboxGroup?: import('./owner-inbox').OwnerInboxGroup;
  guestsCount: number;
  totalAmount: number;
  currency: string;
  depositAmount?: number | null;
  customerName?: string | null;
  instantBookingEnabled?: boolean;
  ownerDecisionAt?: string | null;
  ownerDecisionReason?: string | null;
  canAccept?: boolean;
  canReject?: boolean;
  ownerApprovalExpiresAt?: string | null;
  ownerDecisionState?: OwnerDecisionState;
  createdAt: string;
  paymentStatus: PaymentDisplayStatus;
  customerPayableAmount?: number | null;
  ownerNetPayoutAmount?: number | null;
  payoutStatus?: PayoutStatus | null;
  payoutAvailableAt?: string | null;
  paymentState?: BookingPaymentState;
  isFullyPaid?: boolean;
}

export interface OwnerAvailabilitySlotRow {
  id: string;
  propertyId: string;
  date: string;
  period: AvailabilityPeriod;
  price: number;
  currency: string;
  status: 'available' | 'blocked' | 'booked';
  hasActiveBooking: boolean;
  startAt: string | null;
  endAt: string | null;
  startAtLocal: string | null;
  endAtLocal: string | null;
  timeZone: string;
  source: 'legacy' | 'generated' | 'manual';
  priceOverridden: boolean;
  usesLegacyTiming: boolean;
}

export interface PropertyAvailabilityRuleView {
  id: string;
  propertyId: string;
  weekday: number;
  period: AvailabilityPeriod;
  enabled: boolean;
  startTime: string;
  endTime: string;
  price: number;
  createdAt: string;
  updatedAt: string;
}

export interface AvailabilityGenerationResult {
  propertyId: string;
  from: string;
  to: string;
  timeZone: string;
  created: number;
  alreadyExisting: number;
  skippedBooked: number;
  skippedBlocked: number;
  skippedManual: number;
  invalidRules: number;
  failed: number;
}

export interface AdminAvailabilityHealth {
  hasWeeklyRules: boolean;
  enabledRuleCount: number;
  invalidRuleCount: number;
  futureBookableCount: number;
  earliestAvailableDate: string | null;
  latestAvailableDate: string | null;
  usesLegacyFallback: boolean;
  warning: string | null;
}

export interface AdminDashboardSummary {
  usersCount: number;
  customersCount: number;
  ownersCount: number;
  propertiesCount: number;
  publishedPropertiesCount: number;
  bookingsCount: number;
  todayBookingsCount: number;
  weekBookingsCount: number;
  estimatedRevenueJod: number;
  recentAuditLogs: AdminAuditLogRow[];
}

export interface AdminUserRow {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  status: string;
  createdAt: string;
}

export interface AdminUserDetail extends AdminUserRow {
  locale: string;
}

export interface OwnerApplicationView {
  id: string;
  status: string;
  displayName: string;
  businessName: string | null;
  phone: string;
  city: string | null;
  area: string | null;
  bio: string | null;
  approximateFarmCount: number | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OwnerProfileStatus {
  status: string | null;
  rejectionReason?: string | null;
}

export interface OwnerPropertyEdit {
  id: string;
  slug: string;
  type: string;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  /** Null on incomplete drafts (AF-1.1b). */
  city: string | null;
  /** Null on incomplete drafts (AF-1.1b). */
  area: string | null;
  /** Null on incomplete drafts (AF-1.1b). */
  approximateAddress: string | null;
  exactAddress: string | null;
  latitudeApprox: number | null;
  longitudeApprox: number | null;
  latitudeExact: number | null;
  longitudeExact: number | null;
  arrivalInstructionsAr: string | null;
  arrivalInstructionsEn: string | null;
  /** Null on incomplete drafts (AF-1.1b). */
  basePrice: number | null;
  currency: string;
  capacity: number;
  status: string;
  allowsOvernight: boolean;
  allowsFamilies: boolean;
  allowsYouth: boolean;
  instantBookingEnabled: boolean;
  poolsCount: number;
  amenityKeys: string[];
  imageUrls: string[];
  media?: PropertyMediaItem[];
  rules: { titleAr: string; titleEn: string | null }[];
  /** Active owner-safe change-request reason when status is changes_requested. */
  reviewChangeReason?: string | null;
  /** Owner-visible rejection reason when status is rejected. */
  reviewRejectionReason?: string | null;
  reviewRejectedAt?: string | null;
}

export interface PropertyMediaItem {
  id: string;
  propertyId: string;
  url: string;
  storageKey?: string | null;
  type: 'image' | 'video' | 'virtual_tour';
  altAr: string | null;
  altEn: string | null;
  sortOrder: number;
  isCover: boolean;
  createdAt: string;
}

export interface AdminOwnerRow {
  id: string;
  userId: string;
  displayName: string;
  businessName: string | null;
  email: string | null;
  status: string;
  city: string | null;
  area: string | null;
  propertiesCount: number;
  bookingsCount: number;
  createdAt: string;
  rejectionReason?: string | null;
}

export interface AdminPropertyRow {
  id: string;
  slug: string;
  titleAr: string;
  titleEn: string;
  ownerDisplayName: string;
  ownerEmail: string | null;
  /** Null on incomplete drafts (AF-1.1b). */
  area: string | null;
  /** Null on incomplete drafts (AF-1.1b). */
  city: string | null;
  status: string;
  verificationStatus: string;
  /** Null on incomplete drafts (AF-1.1b). */
  basePrice: number | null;
  currency: string;
  bookingsCount: number;
  imageUrl?: string;
}

export interface AdminPropertyDetail extends AdminPropertyRow {
  capacity: number;
  allowsOvernight: boolean;
  descriptionAr: string;
  descriptionEn: string;
  /** Null on incomplete drafts (AF-1.1b). */
  approximateAddress: string | null;
  exactAddress: string | null;
  latitudeApprox?: number | null;
  longitudeApprox?: number | null;
  latitudeExact?: number | null;
  longitudeExact?: number | null;
  arrivalInstructionsAr?: string | null;
  arrivalInstructionsEn?: string | null;
  type: string;
  amenityKeys: string[];
  media?: PropertyMediaItem[];
  availabilityHealth?: AdminAvailabilityHealth;
  promotions?: PropertyPromotionRow[];
  coupons?: PropertyCouponRow[];
  placements?: PropertyPlacementRow[];
  /** Active owner-safe change-request reason when status is changes_requested. */
  reviewChangeReason?: string | null;
  reviewChangeRequestedAt?: string | null;
  /** Owner-visible rejection reason when status is rejected. */
  reviewRejectionReason?: string | null;
  reviewRejectedAt?: string | null;
}

export interface AdminBookingRow {
  id: string;
  publicCode: string;
  status: BookingStatus;
  customerName: string | null;
  customerEmail: string | null;
  propertySlug: string;
  propertyTitleAr: string;
  propertyTitleEn: string;
  ownerDisplayName: string;
  date: string;
  period: AvailabilityPeriod;
  guestsCount: number;
  totalAmount: number;
  currency: string;
  createdAt: string;
  paymentStatus?: PaymentDisplayStatus | null;
  customerPayableAmount?: number | null;
  platformCommissionAmount?: number | null;
  ownerNetPayoutAmount?: number | null;
  payoutStatus?: PayoutStatus | null;
  payoutAvailableAt?: string | null;
  refundStatus?: RefundStatus | null;
  cancellationRefundAmount?: number | null;
  paymentState?: BookingPaymentState;
  paymentCollectionMode?: PaymentCollectionMode;
  isFullyPaid?: boolean;
}

export interface OwnerBookingPaymentInfo {
  paymentStatus: PaymentDisplayStatus;
  paid: boolean;
}

export interface AdminAuditLogRow {
  id: string;
  action: string;
  actorEmail: string | null;
  actorName: string | null;
  entityType: string | null;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export type PaymentDisplayStatus = 'unpaid' | 'pending' | 'paid' | 'failed' | 'refunded';

export interface PaymentFinancialBreakdown {
  bookingTotalAmount: number;
  customerPayableAmount: number;
  platformCommissionAmount: number;
  customerServiceFeeAmount: number;
  ownerGrossAmount: number;
  ownerNetPayoutAmount: number;
  currency: string;
}

export interface CancellationPolicyView {
  canCancel: boolean;
  tier?: 'free' | 'partial' | 'late' | 'past';
  refundPercent?: number;
  refundableAmount?: number;
  cancellationPenaltyAmount?: number;
  hoursUntilBookingStart?: number;
  chargePercent?: number;
  retainedAmount?: number;
  reason?: string;
}

export interface PaymentSummary {
  id: string;
  bookingId: string;
  amount: number;
  currency: string;
  method: string;
  purpose?: PaymentPurpose;
  provider: string;
  status: string;
  /** Hosted PSP checkout URL (e.g. PayTabs). Never includes secrets. */
  redirectUrl?: string | null;
  /**
   * CB-4 Managed Form normalized outcome for the latest attempt.
   * Frontend must not invent success from provider JSON.
   */
  managedFormOutcome?: 'redirect_3ds' | 'authorised' | 'declined' | 'pending' | null;
  /**
   * CB-5B saved-card charge outcome.
   * ecom_redirect → customer completes CVV/3DS on provider page.
   */
  savedCardOutcome?:
    | 'ecom_redirect'
    | 'authorised'
    | 'declined'
    | 'pending'
    | 'invalid_token'
    | null;
  financial?: PaymentFinancialBreakdown;
  payoutStatus?: PayoutStatus;
  payoutAvailableAt?: string | null;
  refundStatus?: RefundStatus;
  cancellationRefundAmount?: number | null;
  cancellationPenaltyAmount?: number | null;
  expiresAt: string | null;
  succeededAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PublicBookingSummary {
  id: string;
  publicCode: string;
  status: BookingStatus;
  propertySlug: string;
  propertyTitleAr: string;
  propertyTitleEn: string;
  approximateLocation: string;
  arrival?: BookingArrivalInfo | null;
  date: string;
  period: AvailabilityPeriod;
  guestsCount: number;
  totalAmount: number;
  currency: string;
  createdAt: string;
  cancelledAt?: string | null;
  paymentStatus?: PaymentDisplayStatus | null;
  paymentId?: string | null;
  customerPayableAmount?: number | null;
  paidInFull?: boolean;
  isFullyPaid?: boolean;
  paymentCollectionMode?: PaymentCollectionMode;
  paymentState?: BookingPaymentState;
  depositPercent?: number | null;
  depositAmount?: number | null;
  depositPaidAmount?: number | null;
  remainingAmount?: number | null;
  balanceDueAt?: string | null;
  holdExpiresAt?: string | null;
  ownerApprovalExpiresAt?: string | null;
  bookingMode?: BookingMode;
  ownerApprovalRequired?: boolean;
  ownerDecisionState?: OwnerDecisionState;
  ownerDecisionAt?: string | null;
  ownerRejectionReason?: string | null;
  canPayDeposit?: boolean;
  canPayBalance?: boolean;
  canCancel?: boolean;
  cancellationPolicy?: CancellationPolicyView | null;
  refundRequest?: RefundRequestSummary | null;
  canRequestRefund?: boolean;
  canOpenDispute?: boolean;
  bookingStartAt?: string | null;
  bookingEndAt?: string | null;
  startAtLocal?: string | null;
  endAtLocal?: string | null;
  timeZone?: string;
  usesLegacyTiming?: boolean;
  originalSlotPrice?: number | null;
  promotionDiscountAmount?: number | null;
  promotionId?: string | null;
  couponId?: string | null;
  couponCodeSnapshot?: string | null;
  couponDiscountAmount?: number | null;
  priceBeforeCoupon?: number | null;
  platformCouponId?: string | null;
  platformCouponCodeSnapshot?: string | null;
  platformDiscountAmount?: number | null;
  canReview?: boolean;
  myReview?: {
    id: string;
    rating: number;
    comment: string | null;
    status: 'published' | 'hidden';
    createdAt: string;
  } | null;
  /** Past booking may start a new booking on the same bookable property. */
  canRebook?: boolean;
}

export interface BookingArrivalInfo {
  exactAddress: string | null;
  arrivalInstructionsAr: string | null;
  arrivalInstructionsEn: string | null;
  latitudeExact: number | null;
  longitudeExact: number | null;
  googleMapsDirectionsUrl: string | null;
}

export interface RebookIntent {
  bookable: boolean;
  propertySlug: string;
  propertyCapacity: number;
  guestsCount: number;
  guestsToApply: number;
  guestsCapped: boolean;
  preferredPeriod: AvailabilityPeriod;
}

export interface RefundRequestSummary {
  id: string;
  bookingId: string;
  status: RefundRequestStatus;
  policyRefundAmount: number;
  requestedAmount: number;
  approvedAmount: number | null;
  reason: string;
  adminNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DisputeSummary {
  id: string;
  bookingId: string;
  type: DisputeType;
  status: DisputeStatus;
  description: string;
  adminNote: string | null;
  createdAt: string;
  updatedAt: string;
  bookingPublicCode?: string;
  propertySlug?: string;
  propertyTitleAr?: string;
  propertyTitleEn?: string;
}

export interface AdminRefundRequestRow {
  id: string;
  bookingId: string;
  publicCode: string;
  customerName: string | null;
  customerEmail: string | null;
  propertySlug: string;
  propertyTitleAr: string;
  propertyTitleEn: string;
  amountPaid: number;
  policyRefundAmount: number;
  requestedAmount: number;
  approvedAmount: number | null;
  status: RefundRequestStatus;
  reason: string;
  adminNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminDisputeRow {
  id: string;
  bookingId: string;
  publicCode: string;
  customerName: string | null;
  customerEmail: string | null;
  ownerDisplayName: string;
  propertySlug: string;
  propertyTitleAr: string;
  propertyTitleEn: string;
  type: DisputeType;
  status: DisputeStatus;
  description: string;
  adminNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SupportTicketSummary {
  id: string;
  publicCode: string;
  source: SupportTicketSource;
  status: SupportTicketStatus;
  category: SupportTicketCategory;
  subject: string;
  message: string;
  bookingId: string | null;
  bookingPublicCode: string | null;
  adminResponse: string | null;
  adminRespondedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminSupportTicketRow {
  id: string;
  publicCode: string;
  source: SupportTicketSource;
  status: SupportTicketStatus;
  category: SupportTicketCategory;
  subject: string;
  message: string;
  userId: string | null;
  customerName: string | null;
  customerEmail: string | null;
  guestName: string | null;
  guestEmail: string | null;
  bookingId: string | null;
  bookingPublicCode: string | null;
  bookingStatus: BookingStatus | null;
  bookingPaymentState: BookingPaymentState | null;
  adminResponse: string | null;
  adminRespondedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminPayoutRow {
  paymentId: string;
  bookingId: string;
  publicCode: string;
  ownerId: string;
  ownerDisplayName: string;
  ownerEmail: string | null;
  propertySlug: string;
  propertyTitleAr: string;
  propertyTitleEn: string;
  bookingDate: string;
  amount: number;
  currency: string;
  payoutStatus: PayoutStatus;
  payoutAvailableAt: string | null;
  blocked: boolean;
  blockedReason: string | null;
  payoutRecordId: string | null;
  payoutRecordStatus: OwnerPayoutRecordStatus | null;
  paidAt: string | null;
  manualReference: string | null;
}

export interface OwnerPayoutSummaryRow {
  paymentId: string;
  bookingId: string;
  publicCode: string;
  propertySlug: string;
  propertyTitleAr: string;
  propertyTitleEn: string;
  date: string;
  ownerNetPayoutAmount: number;
  currency: string;
  payoutStatus: PayoutStatus;
  payoutAvailableAt: string | null;
  blocked: boolean;
  blockedReason: string | null;
  paidAt: string | null;
}

export const OWNER_SETTLEMENT_STATUSES = ['draft', 'ready', 'paid', 'cancelled'] as const;
export type OwnerSettlementStatus = (typeof OWNER_SETTLEMENT_STATUSES)[number];

export interface OwnerSettlementItemView {
  id: string;
  payoutId: string;
  paymentId: string;
  bookingId: string;
  publicCode: string;
  bookingDate: string;
  bookingTotalAmount: number;
  platformCommissionAmount: number;
  ownerNetPayoutAmount: number;
  payoutAmount: number;
  refundAdjustmentAmount: number;
}

export interface OwnerSettlementSummary {
  id: string;
  ownerId: string;
  periodStart: string;
  periodEnd: string;
  status: OwnerSettlementStatus;
  itemCount: number;
  grossBookingAmount: number;
  platformCommissionTotal: number;
  refundAdjustmentTotal: number;
  ownerNetAmount: number;
  currency: string;
  createdAt: string;
  finalizedAt: string | null;
  paidAt: string | null;
  paymentReference: string | null;
  adminNote?: string | null;
  items?: OwnerSettlementItemView[];
}

export interface SettlementPreviewExcludedItem {
  paymentId: string;
  bookingId: string;
  publicCode: string;
  reason: string;
}

export interface OwnerSettlementCycleInfo {
  cycleDays: number;
  duePeriodStart: string | null;
  duePeriodEnd: string | null;
  nextExpectedPeriodEnd: string | null;
  lastGeneratedPeriodStart: string | null;
  lastGeneratedPeriodEnd: string | null;
  draftExistsForCurrentCycle: boolean;
}

export interface OwnerSettlementGenerateResult {
  cycleDays: number;
  asOf: string;
  periodStart: string | null;
  periodEnd: string | null;
  ownersChecked: number;
  settlementsCreated: number;
  itemsAttached: number;
  skippedOwners: number;
  failures: number;
}

export interface OwnerSettlementPreview {
  ownerId: string;
  through: string;
  periodStart: string | null;
  periodEnd: string;
  eligibleCount: number;
  excludedCount: number;
  grossBookingAmount: number;
  platformCommissionTotal: number;
  refundAdjustmentTotal: number;
  ownerNetAmount: number;
  currency: string;
  items: Array<{
    paymentId: string;
    bookingId: string;
    publicCode: string;
    bookingDate: string;
    bookingTotalAmount: number;
    platformCommissionAmount: number;
    ownerNetPayoutAmount: number;
  }>;
  excluded: SettlementPreviewExcludedItem[];
}

export interface CheckoutBookingView extends PublicBookingSummary {
  payment: PaymentSummary | null;
  pricing: PaymentFinancialBreakdown;
  dueNowAmount: number;
  duePurpose: PaymentPurpose | null;
  /** Public cover/thumbnail for checkout destination summary (optional). */
  propertyCoverUrl?: string | null;
  /**
   * CB-6 — Deposit vs Full options for the FIRST payment only.
   * Null/absent when choice is unavailable (balance due, approval, expiry, 100% deposit, etc.).
   */
  initialPaymentOptions?: InitialPaymentOption[] | null;
  /** Server default when options exist: always deposit when available. */
  defaultInitialPaymentChoice?: InitialPaymentChoice | null;
  /** True when an in-flight provider attempt locks Deposit↔Full switching. */
  initialPaymentChoiceLocked?: boolean;
  lockedInitialPaymentChoice?: InitialPaymentChoice | null;
}

/** CB-6 — customer-facing initial payment amount choice (not PaymentPurpose). */
export type InitialPaymentChoice = 'deposit' | 'full';

export type InitialPaymentOption = {
  choice: InitialPaymentChoice;
  dueNowAmount: number;
  remainingAfterPayment: number;
};

export interface PaymentPolicyPublicSummary {
  mode: string;
  currency: string;
  platformCommissionPercent: number;
  platformVerifiedCommissionPercent: number;
  customerServiceFeePercent: number;
  defaultDepositPercent: number;
  fullPaymentWithinHours: number;
  balanceDueHoursBeforeStart: number;
  cancellationFreeUntilHours: number;
  cancellationCharge30UntilHours: number;
  cancellationCharge50UntilHours: number;
  cancellationChargePercents: {
    free: number;
    tier30: number;
    tier50: number;
    tier100: number;
  };
}

export type SavedPaymentMethodPublic = {
  id: string;
  provider: string;
  brand: string | null;
  maskedDisplay: string | null;
  last4: string | null;
  expiryMonth: number | null;
  expiryYear: number | null;
  isDefault: boolean;
  createdAt: string;
  /** Account UI hint when expiry metadata conclusively shows expired. */
  expired?: boolean;
};

/** CB-4 checkout UI mode — server-authoritative. */
export type PaymentUiMode = 'hosted_redirect' | 'managed_form';

/** CB-5B — how Checkout charges vaulted cards (server-authoritative). */
export type SavedCardChargeMode = 'ecom_cvv_redirect' | 'recurring_direct';

export interface PaymentPublicConfig {
  provider: string;
  currency: string;
  simulateEnabled: boolean;
  livePaymentsEnabled: boolean;
  policy?: PaymentPolicyPublicSummary;
  /**
   * CB-4: how Checkout renders card payment.
   * Default hosted_redirect (HPP). managed_form only when explicitly configured.
   */
  paymentUiMode?: PaymentUiMode;
  /**
   * PayTabs Client Key — intentionally browser-side for Managed Form only.
   * Never confuse with Server Key. Omitted when mode is hosted_redirect.
   */
  paytabsClientKey?: string | null;
  /** Region-derived paylib.js URL (e.g. Jordan secure endpoint). */
  paylibScriptUrl?: string | null;
  /** When true, Checkout uses the deterministic Managed Form mock seam (no real PayTabs). */
  managedFormMock?: boolean;
  /**
   * CB-5A — when true, Checkout may show save-card opt-in.
   * Requires PAYTABS_TOKENIZATION_ENABLED (+ vault encryption for non-mock).
   * Does NOT enable charging saved cards (CB-5B).
   */
  savedCardsEnabled?: boolean;
  /**
   * CB-5B — when true, Checkout may select an existing vaulted card to pay.
   * Independent of PAYTABS_TOKENIZATION_ENABLED (saving new cards).
   */
  savedCardChargeEnabled?: boolean;
  /** CB-5B — active charge mode when savedCardChargeEnabled. */
  savedCardChargeMode?: SavedCardChargeMode | null;
}

export interface AdminPaymentRow {
  id: string;
  bookingId: string;
  publicCode: string;
  customerName: string | null;
  customerEmail: string | null;
  method: string;
  provider: string;
  amount: number;
  currency: string;
  status: string;
  bookingTotalAmount: number;
  customerPayableAmount: number;
  platformCommissionAmount: number;
  ownerNetPayoutAmount: number;
  payoutStatus: PayoutStatus;
  payoutAvailableAt: string | null;
  refundStatus: RefundStatus;
  cancellationRefundAmount: number | null;
  createdAt: string;
  updatedAt: string;
}

export const REVIEW_STATUSES = ['published', 'hidden'] as const;
export type ReviewModerationStatus = (typeof REVIEW_STATUSES)[number];

export interface PropertyReviewAdminRow {
  id: string;
  bookingId: string;
  publicCode: string;
  propertyId: string;
  propertySlug: string;
  propertyTitleAr: string;
  propertyTitleEn: string;
  customerId: string;
  customerDisplayName: string;
  rating: number;
  comment: string | null;
  status: ReviewModerationStatus;
  hiddenReason: string | null;
  createdAt: string;
  updatedAt: string;
}

