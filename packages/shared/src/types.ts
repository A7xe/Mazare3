import type {
  Locale,
  AvailabilityPeriod,
  BookingStatus,
  PropertyType,
  PayoutStatus,
  RefundStatus,
  RefundRequestStatus,
  DisputeType,
  DisputeStatus,
  OwnerPayoutRecordStatus,
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
  capacity: number;
  rating: number;
  reviewCount: number;
  basePrice: number;
  currency: string;
  verificationStatus: VerificationStatus;
  hasPlatformDeal: boolean;
  allowsFamilies: boolean;
  allowsYouth: boolean;
  hasPool: boolean;
  hasIndoorPool: boolean;
  hasHeatedPool: boolean;
  hasFootballField: boolean;
  allowsOvernight: boolean;
  imageUrl?: string;
  amenityKeys: string[];
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
}

export interface PublicAvailabilitySlot {
  date: string;
  period: AvailabilityPeriod;
  price: number;
  currency: string;
  status: 'available' | 'blocked' | 'booked';
}

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
  area: string;
  city: string;
  basePrice: number;
  currency: string;
  bookingsCount: number;
  imageUrl?: string;
}

export interface OwnerPropertyDetail extends OwnerPropertyCard {
  capacity: number;
  allowsOvernight: boolean;
  upcomingBookingsCount: number;
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
  guestsCount: number;
  totalAmount: number;
  currency: string;
  createdAt: string;
  paymentStatus: PaymentDisplayStatus;
  customerPayableAmount?: number | null;
  ownerNetPayoutAmount?: number | null;
  payoutStatus?: PayoutStatus | null;
  payoutAvailableAt?: string | null;
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
  email: string;
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
  city: string;
  area: string;
  approximateAddress: string;
  exactAddress: string | null;
  basePrice: number;
  currency: string;
  capacity: number;
  status: string;
  allowsOvernight: boolean;
  allowsFamilies: boolean;
  allowsYouth: boolean;
  poolsCount: number;
  amenityKeys: string[];
  imageUrls: string[];
  rules: { titleAr: string; titleEn: string | null }[];
}

export interface AdminOwnerRow {
  id: string;
  userId: string;
  displayName: string;
  businessName: string | null;
  email: string;
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
  ownerEmail: string;
  area: string;
  city: string;
  status: string;
  verificationStatus: string;
  basePrice: number;
  currency: string;
  bookingsCount: number;
  imageUrl?: string;
}

export interface AdminPropertyDetail extends AdminPropertyRow {
  capacity: number;
  allowsOvernight: boolean;
  descriptionAr: string;
  descriptionEn: string;
  approximateAddress: string;
  exactAddress: string | null;
  type: string;
  amenityKeys: string[];
}

export interface AdminBookingRow {
  id: string;
  publicCode: string;
  status: BookingStatus;
  customerName: string | null;
  customerEmail: string;
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
  reason?: string;
}

export interface PaymentSummary {
  id: string;
  bookingId: string;
  amount: number;
  currency: string;
  method: string;
  provider: string;
  status: string;
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
  cancellationPolicy?: CancellationPolicyView | null;
  refundRequest?: RefundRequestSummary | null;
  canRequestRefund?: boolean;
  canOpenDispute?: boolean;
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
  customerEmail: string;
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
  customerEmail: string;
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

export interface AdminPayoutRow {
  paymentId: string;
  bookingId: string;
  publicCode: string;
  ownerId: string;
  ownerDisplayName: string;
  ownerEmail: string;
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

export interface CheckoutBookingView extends PublicBookingSummary {
  payment: PaymentSummary | null;
  pricing: PaymentFinancialBreakdown;
}

export interface PaymentPolicyPublicSummary {
  mode: string;
  currency: string;
  platformCommissionPercent: number;
  customerServiceFeePercent: number;
  cancellationFreeUntilHours: number;
  cancellationPartialUntilHours: number;
  cancellationPartialRefundPercent: number;
  lateCancellationRefundPercent: number;
}

export interface PaymentPublicConfig {
  provider: string;
  currency: string;
  simulateEnabled: boolean;
  livePaymentsEnabled: boolean;
  policy?: PaymentPolicyPublicSummary;
}

export interface AdminPaymentRow {
  id: string;
  bookingId: string;
  publicCode: string;
  customerName: string | null;
  customerEmail: string;
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
