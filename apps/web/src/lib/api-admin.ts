'use client';

import type {
  AdminAuditLogRow,
  AdminBookingRow,
  AdminDashboardSummary,
  AdminOwnerRow,
  AdminPropertyDetail,
  AdminPropertyRow,
  AdminUserRow,
  AdminRefundRequestRow,
  AdminDisputeRow,
  AdminSupportTicketRow,
  AdminPayoutRow,
  OwnerAvailabilitySlotRow,
  PatchAdminRefundRequestInput,
  PatchAdminDisputeInput,
  PatchAdminSupportTicketInput,
  MarkAdminPayoutPaidInput,
  OwnerSettlementPreview,
  OwnerSettlementSummary,
  OwnerSettlementCycleInfo,
  CreateOwnerSettlementInput,
  MarkOwnerSettlementPaidInput,
  PatchAdminAvailabilityInput,
  PatchAdminOwnerStatusInput,
  PatchAdminPropertyStatusInput,
  PatchAdminUserStatusInput,
  ApprovePartnerInput,
  CreatePartnerCommercialTermsInput,
  PatchPartnerDocumentReviewInput,
  RequestPartnerChangesInput,
  ReviewPartnerPayoutInput,
  OwnerPerformanceMetrics,
  OwnerPerformanceRange,
  PropertyReviewAdminRow,
} from '@mazare3/shared';
import { getApiBaseUrl } from './api';
import type {
  PartnerEntityType,
  PartnerOnboardingView,
  PartnerVerificationStatus,
} from './api-partner';

export class AdminApiError extends Error {
  constructor(
    message: string,
    public code?: string,
    public status?: number,
  ) {
    super(message);
    this.name = 'AdminApiError';
  }
}

async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    credentials: 'include',
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new AdminApiError(
      (body as { error?: string }).error ?? 'Request failed',
      (body as { code?: string }).code,
      res.status,
    );
  }
  return body as T;
}

export async function fetchAdminSummary() {
  return adminFetch<{ data: AdminDashboardSummary }>('/admin/summary');
}

export async function fetchAdminUsers() {
  return adminFetch<{ data: AdminUserRow[] }>('/admin/users');
}

export async function patchAdminUserStatus(userId: string, input: PatchAdminUserStatusInput) {
  return adminFetch<{ data: AdminUserRow }>(`/admin/users/${userId}/status`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function fetchAdminOwners() {
  return adminFetch<{ data: AdminOwnerRow[] }>('/admin/owners');
}

export async function patchAdminOwnerStatus(ownerId: string, input: PatchAdminOwnerStatusInput) {
  return adminFetch<{ data: AdminOwnerRow }>(`/admin/owners/${ownerId}/status`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function fetchAdminProperties() {
  return adminFetch<{ data: AdminPropertyRow[] }>('/admin/properties');
}

export async function fetchAdminProperty(id: string) {
  return adminFetch<{ data: AdminPropertyDetail }>(`/admin/properties/${id}`);
}

export async function disableAdminPromotion(propertyId: string, promoId: string) {
  return adminFetch<{ data: import('@mazare3/shared').PropertyPromotionRow }>(
    `/admin/properties/${propertyId}/promotions/${promoId}/disable`,
    { method: 'POST' },
  );
}

export async function disableAdminCoupon(propertyId: string, couponId: string) {
  return adminFetch<{ data: import('@mazare3/shared').PropertyCouponRow }>(
    `/admin/properties/${propertyId}/coupons/${couponId}/disable`,
    { method: 'POST' },
  );
}

export async function fetchAdminPlatformCoupons() {
  return adminFetch<{ data: import('@mazare3/shared').PlatformCouponRow[] }>('/admin/platform-coupons');
}

export async function createAdminPlatformCoupon(input: {
  code: string;
  titleAr: string;
  titleEn: string;
  discountType: 'percentage' | 'fixed_amount';
  discountValue: number;
  startsAt: string;
  endsAt: string;
  minBookingAmount?: number | null;
  maxUses?: number | null;
  maxUsesPerCustomer?: number;
  propertyId?: string | null;
}) {
  return adminFetch<{ data: import('@mazare3/shared').PlatformCouponRow }>('/admin/platform-coupons', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function activateAdminPlatformCoupon(id: string) {
  return adminFetch<{ data: import('@mazare3/shared').PlatformCouponRow }>(
    `/admin/platform-coupons/${id}/activate`,
    { method: 'POST' },
  );
}

export async function pauseAdminPlatformCoupon(id: string) {
  return adminFetch<{ data: import('@mazare3/shared').PlatformCouponRow }>(
    `/admin/platform-coupons/${id}/pause`,
    { method: 'POST' },
  );
}

export async function fetchAdminPlacements(propertyId: string) {
  return adminFetch<{ data: import('@mazare3/shared').PropertyPlacementRow[] }>(
    `/admin/properties/${propertyId}/placements`,
  );
}

export async function createAdminPlacement(
  propertyId: string,
  input: {
    placementType: 'featured' | 'sponsored';
    startsAt: string;
    endsAt: string;
    adminNote?: string | null;
  },
) {
  return adminFetch<{ data: import('@mazare3/shared').PropertyPlacementRow }>(
    `/admin/properties/${propertyId}/placements`,
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export async function activateAdminPlacement(propertyId: string, placementId: string) {
  return adminFetch<{ data: import('@mazare3/shared').PropertyPlacementRow }>(
    `/admin/properties/${propertyId}/placements/${placementId}/activate`,
    { method: 'POST' },
  );
}

export async function pauseAdminPlacement(propertyId: string, placementId: string) {
  return adminFetch<{ data: import('@mazare3/shared').PropertyPlacementRow }>(
    `/admin/properties/${propertyId}/placements/${placementId}/pause`,
    { method: 'POST' },
  );
}

export async function fetchAdminSponsorshipPackages() {
  return adminFetch<{ data: import('@mazare3/shared').SponsoredPlacementPackageRow[] }>(
    '/admin/sponsorship-packages',
  );
}

export async function createAdminSponsorshipPackage(input: {
  nameAr: string;
  nameEn: string;
  durationDays: number;
  priceAmount: number;
}) {
  return adminFetch<{ data: import('@mazare3/shared').SponsoredPlacementPackageRow }>(
    '/admin/sponsorship-packages',
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export async function patchAdminSponsorshipPackage(
  id: string,
  input: Partial<{ nameAr: string; nameEn: string; durationDays: number; priceAmount: number }>,
) {
  return adminFetch<{ data: import('@mazare3/shared').SponsoredPlacementPackageRow }>(
    `/admin/sponsorship-packages/${id}`,
    { method: 'PATCH', body: JSON.stringify(input) },
  );
}

export async function deactivateAdminSponsorshipPackage(id: string) {
  return adminFetch<{ data: import('@mazare3/shared').SponsoredPlacementPackageRow }>(
    `/admin/sponsorship-packages/${id}/deactivate`,
    { method: 'POST' },
  );
}

export async function fetchAdminSponsorshipOrders(status?: string) {
  const q = status ? `?status=${encodeURIComponent(status)}` : '';
  return adminFetch<{ data: import('@mazare3/shared').SponsoredPlacementOrderRow[] }>(
    `/admin/sponsorship-orders${q}`,
  );
}

export async function approveAdminSponsorshipOrder(id: string) {
  return adminFetch<{ data: import('@mazare3/shared').SponsoredPlacementOrderRow }>(
    `/admin/sponsorship-orders/${id}/approve`,
    { method: 'POST', body: JSON.stringify({}) },
  );
}

export async function rejectAdminSponsorshipOrder(id: string, adminNote?: string) {
  return adminFetch<{ data: import('@mazare3/shared').SponsoredPlacementOrderRow }>(
    `/admin/sponsorship-orders/${id}/reject`,
    { method: 'POST', body: JSON.stringify({ adminNote }) },
  );
}

export async function confirmAdminSponsorshipPayment(
  id: string,
  input: { paymentReference: string; paymentDate: string },
) {
  return adminFetch<{ data: import('@mazare3/shared').SponsoredPlacementOrderRow }>(
    `/admin/sponsorship-orders/${id}/confirm-payment`,
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export async function activateAdminSponsorshipOrder(id: string) {
  return adminFetch<{ data: import('@mazare3/shared').SponsoredPlacementOrderRow }>(
    `/admin/sponsorship-orders/${id}/activate`,
    { method: 'POST' },
  );
}

export async function patchAdminPropertyStatus(propertyId: string, input: PatchAdminPropertyStatusInput) {
  return adminFetch<{ data: AdminPropertyDetail }>(`/admin/properties/${propertyId}/status`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function fetchAdminBookings() {
  return adminFetch<{ data: AdminBookingRow[] }>('/admin/bookings');
}

/** Phase 3C.4D.6 — Admin compare Booking-time snapshot vs current listing. */
export async function fetchAdminBookingListingSnapshot(bookingId: string) {
  return adminFetch<{
    data: {
      bookingId: string;
      atTimeOfBooking: import('@/components/bookings/booking-listing-snapshot-panel').ListingSnapshotApiResult;
      currentListing: {
        label: string;
        property: { titleAr: string; titleEn: string | null };
        capacity: { capacity: number };
        amenities: Array<{ key: string }>;
      };
    };
  }>(`/admin/bookings/${encodeURIComponent(bookingId)}/listing-snapshot`);
}

export async function fetchAdminAvailability(propertyId: string, from: string, to: string) {
  const sp = new URLSearchParams({ propertyId, from, to });
  return adminFetch<{ data: OwnerAvailabilitySlotRow[] }>(`/admin/availability?${sp}`);
}

export async function patchAdminAvailabilitySlot(slotId: string, input: PatchAdminAvailabilityInput) {
  return adminFetch<{ data: OwnerAvailabilitySlotRow }>(`/admin/availability/${slotId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function fetchAdminPayments() {
  return adminFetch<{ data: import('@mazare3/shared').AdminPaymentRow[] }>('/admin/payments');
}

export async function reconcileAdminPayTabsPayment(paymentId: string) {
  return adminFetch<{ data: { paymentId: string; result: string; message: string } }>(
    `/admin/payments/${paymentId}/reconcile`,
    { method: 'POST' },
  );
}

export async function fetchAdminAuditLogs(limit = 100) {
  return adminFetch<{ data: AdminAuditLogRow[] }>(`/admin/audit-logs?limit=${limit}`);
}

export async function fetchAdminRefundRequests() {
  return adminFetch<{ data: AdminRefundRequestRow[] }>('/admin/refund-requests');
}

export async function patchAdminRefundRequest(id: string, input: PatchAdminRefundRequestInput) {
  return adminFetch<{ data: AdminRefundRequestRow }>(`/admin/refund-requests/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function fetchAdminDisputes() {
  return adminFetch<{ data: AdminDisputeRow[] }>('/admin/disputes');
}

export async function patchAdminDispute(id: string, input: PatchAdminDisputeInput) {
  return adminFetch<{ data: AdminDisputeRow }>(`/admin/disputes/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function fetchAdminSupportTickets(query?: { status?: string; source?: string }) {
  const params = new URLSearchParams();
  if (query?.status) params.set('status', query.status);
  if (query?.source) params.set('source', query.source);
  const q = params.toString();
  return adminFetch<{ data: AdminSupportTicketRow[] }>(`/admin/support${q ? `?${q}` : ''}`);
}

export async function fetchAdminSupportTicket(id: string) {
  return adminFetch<{ data: AdminSupportTicketRow }>(`/admin/support/${id}`);
}

export async function patchAdminSupportTicket(id: string, input: PatchAdminSupportTicketInput) {
  return adminFetch<{ data: AdminSupportTicketRow }>(`/admin/support/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function fetchAdminPayouts() {
  return adminFetch<{ data: AdminPayoutRow[] }>('/admin/payouts');
}

export async function markAdminPayoutPaid(paymentId: string, input: MarkAdminPayoutPaidInput) {
  return adminFetch<{ data: AdminPayoutRow }>(`/admin/payouts/${paymentId}/mark-paid`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function fetchAdminSettlementPreview(ownerId: string, through: string) {
  return adminFetch<{ data: OwnerSettlementPreview }>(
    `/admin/partners/${ownerId}/settlement-preview?through=${through}`,
  );
}

export async function fetchAdminPartnerSettlements(ownerId: string) {
  return adminFetch<{ data: OwnerSettlementSummary[]; cycle: OwnerSettlementCycleInfo }>(
    `/admin/partners/${ownerId}/settlements`,
  );
}

export async function createAdminPartnerSettlement(
  ownerId: string,
  input: CreateOwnerSettlementInput,
) {
  return adminFetch<{ data: OwnerSettlementSummary }>(`/admin/partners/${ownerId}/settlements`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function finalizeAdminSettlement(id: string) {
  return adminFetch<{ data: OwnerSettlementSummary }>(`/admin/settlements/${id}/finalize`, {
    method: 'POST',
    body: '{}',
  });
}

export async function markAdminSettlementPaid(id: string, input: MarkOwnerSettlementPaidInput) {
  return adminFetch<{ data: OwnerSettlementSummary }>(`/admin/settlements/${id}/mark-paid`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function cancelAdminSettlement(id: string) {
  return adminFetch<{ data: OwnerSettlementSummary }>(`/admin/settlements/${id}/cancel`, {
    method: 'POST',
    body: '{}',
  });
}

export type AdminPartnerListRow = {
  id: string;
  userId: string;
  displayName: string;
  businessName: string | null;
  email: string | null;
  status: string;
  verificationStatus: PartnerVerificationStatus;
  entityType: PartnerEntityType | null;
  legacyApproved: boolean;
  city: string | null;
  area: string | null;
  propertiesCount: number;
  bookingsCount: number;
  submittedAt: string | null;
  createdAt: string;
  readinessIncomplete: boolean;
  missingRequirementsCount: number;
  rejectionReason: string | null;
};

export type AdminPartnerCommercialTermsRow = {
  id: string;
  ownerProfileId: string;
  propertyId: string | null;
  commissionBps: number;
  commissionPercent: number;
  payoutDelayHours: number | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  status: string;
  version: number;
  internalNote: string | null;
  createdAt: string;
  activatedAt: string | null;
};

export type AdminPartnerDetail = Omit<
  PartnerOnboardingView,
  'started' | 'ownerProfileId' | 'ownerStatus' | 'verificationStatus' | 'createdAt' | 'updatedAt'
> & {
  started: true;
  ownerProfileId: string;
  ownerStatus: string;
  verificationStatus: PartnerVerificationStatus;
  createdAt: string;
  updatedAt: string;
  email: string | null;
  userRole: string;
  userStatus: string;
  payoutReviewStatus: 'pending' | 'reviewed' | 'rejected' | null;
  commercialTermsPreview: {
    source: 'property_terms' | 'owner_terms' | 'platform_default';
    commissionPercent: number;
    commissionBps: number;
    termsId: string | null;
    payoutDelayHours: number;
  };
  publishedPropertiesCount: number;
  confirmedBookingsCount: number;
  suspensionImpact: {
    publishedProperties: number;
    openBookings: number;
  };
  audit: {
    id: string;
    action: string;
    createdAt: string;
    actorUserId: string | null;
    metadata: unknown;
  }[];
  commercialTermsList: AdminPartnerCommercialTermsRow[];
};

export type AdminPartnerListQuery = {
  verificationStatus?: string;
  entityType?: string;
  q?: string;
};

export async function fetchAdminPartners(query: AdminPartnerListQuery = {}) {
  const sp = new URLSearchParams();
  if (query.verificationStatus) sp.set('verificationStatus', query.verificationStatus);
  if (query.entityType) sp.set('entityType', query.entityType);
  if (query.q) sp.set('q', query.q);
  const qs = sp.toString();
  return adminFetch<{ data: AdminPartnerListRow[] }>(`/admin/partners${qs ? `?${qs}` : ''}`);
}

export async function fetchAdminPartner(id: string) {
  return adminFetch<{ data: AdminPartnerDetail }>(`/admin/partners/${id}`);
}

export async function fetchAdminPartnerPerformance(id: string, range: OwnerPerformanceRange = '30d') {
  return adminFetch<{ data: OwnerPerformanceMetrics }>(
    `/admin/partners/${id}/performance?range=${range}`,
  );
}

export async function reviewAdminPartnerDocument(
  ownerId: string,
  documentId: string,
  input: PatchPartnerDocumentReviewInput,
) {
  return adminFetch<{ data: AdminPartnerDetail }>(
    `/admin/partners/${ownerId}/documents/${documentId}`,
    { method: 'PATCH', body: JSON.stringify(input) },
  );
}

export function adminPartnerDocumentFileUrl(ownerId: string, documentId: string) {
  return `${getApiBaseUrl()}/admin/partners/${ownerId}/documents/${documentId}/file`;
}

export async function requestAdminPartnerChanges(ownerId: string, input: RequestPartnerChangesInput) {
  return adminFetch<{ data: AdminPartnerDetail }>(`/admin/partners/${ownerId}/request-changes`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function reviewAdminPartnerPayout(ownerId: string, input: ReviewPartnerPayoutInput) {
  return adminFetch<{ data: AdminPartnerDetail }>(`/admin/partners/${ownerId}/payout-review`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function approveAdminPartner(ownerId: string, input: ApprovePartnerInput = {}) {
  return adminFetch<{ data: AdminPartnerDetail }>(`/admin/partners/${ownerId}/approve`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function rejectAdminPartner(ownerId: string, reason: string) {
  return adminFetch<{ data: AdminPartnerDetail }>(`/admin/partners/${ownerId}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export async function suspendAdminPartner(ownerId: string, reason: string) {
  return adminFetch<{ data: AdminPartnerDetail }>(`/admin/partners/${ownerId}/suspend`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export async function restoreAdminPartner(ownerId: string) {
  return adminFetch<{ data: AdminPartnerDetail }>(`/admin/partners/${ownerId}/restore`, {
    method: 'POST',
  });
}

export async function fetchAdminPartnerCommercialTerms(ownerId: string) {
  return adminFetch<{ data: AdminPartnerCommercialTermsRow[] }>(
    `/admin/partners/${ownerId}/commercial-terms`,
  );
}

export async function previewAdminPartnerCommercialTerms(ownerId: string, propertyId?: string) {
  return adminFetch<{
    data: AdminPartnerDetail['commercialTermsPreview'] & { version?: number | null };
  }>(`/admin/partners/${ownerId}/commercial-terms/preview`, {
    method: 'POST',
    body: JSON.stringify(propertyId ? { propertyId } : {}),
  });
}

export async function createAdminPartnerCommercialTerms(
  ownerId: string,
  input: CreatePartnerCommercialTermsInput,
) {
  return adminFetch<{ data: AdminPartnerCommercialTermsRow }>(
    `/admin/partners/${ownerId}/commercial-terms`,
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export async function activateAdminPartnerCommercialTerms(ownerId: string, termsId: string) {
  return adminFetch<{ data: AdminPartnerCommercialTermsRow }>(
    `/admin/partners/${ownerId}/commercial-terms/${termsId}/activate`,
    { method: 'POST' },
  );
}

export async function fetchAdminReviews() {
  return adminFetch<{ data: PropertyReviewAdminRow[] }>('/admin/reviews');
}

export async function hideAdminReview(id: string, reason: string) {
  return adminFetch<{ data: PropertyReviewAdminRow }>(`/admin/reviews/${id}/hide`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export async function restoreAdminReview(id: string) {
  return adminFetch<{ data: PropertyReviewAdminRow }>(`/admin/reviews/${id}/restore`, {
    method: 'POST',
  });
}

export type AdminBookingIncidentRow = {
  id: string;
  bookingId: string;
  type: string;
  status: string;
  reason: string | null;
  evidenceText: string | null;
  adminNote: string | null;
  createdAt: string;
  customerResolutionChoice?: string | null;
  customerResolutionChosenAt?: string | null;
  customerChosenTargetSlotId?: string | null;
  customerResolutionChosenByUserId?: string | null;
  resolvedAt?: string | null;
  booking: { publicCode: string; status: string };
  openedBy: { id: string; email: string | null; name: string | null };
};

export type AdminOwnerAdjustmentRow = {
  id: string;
  type: string;
  amountJod: number;
  status: string;
  reason: string | null;
  createdAt: string;
  booking: { publicCode: string } | null;
  owner: { displayName: string };
};

export async function fetchAdminMarketplaceIncidents() {
  return adminFetch<{ data: AdminBookingIncidentRow[] }>('/admin/marketplace-fairness/incidents');
}

export async function confirmAdminIncidentNoShow(incidentId: string, adminNote?: string) {
  return adminFetch<{ data: unknown }>(
    `/admin/marketplace-fairness/incidents/${incidentId}/confirm-no-show`,
    { method: 'POST', body: JSON.stringify({ adminNote }) },
  );
}

export async function confirmAdminIncidentOwnerFault(incidentId: string, adminNote?: string) {
  return adminFetch<{ data: unknown }>(
    `/admin/marketplace-fairness/incidents/${incidentId}/confirm-owner-fault`,
    { method: 'POST', body: JSON.stringify({ adminNote }) },
  );
}

export async function rejectAdminIncident(incidentId: string, adminNote: string) {
  return adminFetch<{ data: unknown }>(
    `/admin/marketplace-fairness/incidents/${incidentId}/reject`,
    { method: 'POST', body: JSON.stringify({ adminNote }) },
  );
}

export async function fetchAdminOwnerAdjustments() {
  return adminFetch<{ data: AdminOwnerAdjustmentRow[] }>(
    '/admin/marketplace-fairness/owner-adjustments',
  );
}

export async function waiveAdminOwnerAdjustment(adjustmentId: string, reason: string) {
  return adminFetch<{ data: unknown }>(
    `/admin/marketplace-fairness/owner-adjustments/${adjustmentId}/waive`,
    { method: 'POST', body: JSON.stringify({ reason }) },
  );
}

export type AdminForceMajeureInput = {
  bookingId: string;
  outcome: 'confirm_awaiting_customer' | 'full_refund' | 'approve_reschedule';
  reason: string;
  incidentId?: string;
  evidenceText?: string;
  toSlotId?: string;
  voluntaryUpgrade?: boolean;
};

export async function classifyAdminForceMajeure(input: AdminForceMajeureInput) {
  return adminFetch<{ data: unknown }>('/admin/marketplace-fairness/force-majeure', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function approveAdminExtraReschedule(bookingId: string, reason: string) {
  return adminFetch<{ data: unknown }>(
    `/admin/marketplace-fairness/bookings/${bookingId}/approve-extra-reschedule`,
    { method: 'POST', body: JSON.stringify({ reason }) },
  );
}

export type AdminCommercialTermsAuditRow = {
  id: string;
  ownerProfileId: string;
  propertyId: string | null;
  commissionPercent: number;
  status: string;
  note: string;
  /** Optional fields if a richer audit payload is returned later. */
  source?: string | null;
  expectedStandardPercent?: number | null;
  expectedVerifiedPercent?: number | null;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  customOverride?: boolean | null;
  history?: Array<{ at: string; note: string }> | null;
};

export async function fetchAdminCommercialTermsAudit() {
  return adminFetch<{ data: AdminCommercialTermsAuditRow[] }>(
    '/admin/marketplace-fairness/commercial-terms-audit',
  );
}

/* ─── Admin legal console ─── */

export type AdminLegalVersion = {
  id: string;
  releaseId: string;
  documentType: string;
  version: string;
  language: string;
  title: string;
  content: string;
  contentHash: string;
  status: string;
  publishedAt: string | null;
  effectiveAt: string | null;
  supersededAt: string | null;
  createdAt: string;
  sourceRef: string | null;
};

export type AdminLegalRelease = {
  id: string;
  documentType: string;
  version: string;
  status: string;
  requiresReacceptance: boolean;
  materialChange: boolean;
  changelog: string | null;
  summaryOfChanges: string | null;
  effectiveAt: string | null;
  publishedAt: string | null;
  supersededAt: string | null;
  createdAt: string;
  createdByUserId: string | null;
  legalReviewStatus?: string;
  legalReviewedAt?: string | null;
  legalReviewReference?: string | null;
  legalReviewNote?: string | null;
  founderApprovalStatus?: string;
  founderApprovedAt?: string | null;
  founderApprovalNote?: string | null;
  versions: AdminLegalVersion[];
};

export type AdminLegalActivationReadiness = {
  overall: 'TECHNICALLY_READY' | 'LEGAL_REVIEW_PENDING' | 'FOUNDER_INPUT_MISSING' | 'BLOCKED';
  disclaimer: string;
  identity: {
    productNameEn: string;
    productNameAr: string;
    dpoAppointed: boolean;
    privacyContactLabel: string;
    founderInputRequired: Array<{
      key: string;
      token: string | null;
      envHints: string[];
      status: string;
      note?: string;
    }>;
    fields: Record<string, { status: string; valuePresent: boolean }>;
    resolvedIdentity?: {
      legalEntityNameAr: boolean;
      legalEntityNameEn: boolean;
      legalFormAr: boolean;
      legalFormEn: boolean;
      commercialRegistrationNumber: boolean;
      nationalEstablishmentNumber: boolean;
      registeredAddressAr: boolean;
      registeredAddressEn: boolean;
      legalContactEmail: boolean;
      projectOperationalEmail: boolean;
      partnershipContactPhone: boolean;
    };
  };
  documents: Array<{
    documentType: string;
    activeVersion: string | null;
    draftLaunchCandidate: boolean;
    languages: { ar: boolean; en: boolean };
    status: string | null;
    legalReviewStatus: string | null;
    founderApprovalStatus: string | null;
    unresolvedPlaceholders: string[];
    hashOk: boolean;
    placeholderMarkers: boolean;
    issues: string[];
  }>;
  consistency: {
    unresolvedPlaceholdersInActive: number;
    hashMismatchCount: number;
    placeholderActiveCount: number;
    launchCandidateActiveCount: number;
    ssotNote: string;
  };
  acceptanceFlows: Record<string, string>;
  privacy: Record<string, string | boolean>;
  priorConsent?: {
    privacyPolicyFinalised: false;
    unresolvedDurationBlocksProduction: boolean;
    unresolvedDurationPurposes: string[];
    missingTechnicalGates: string[];
    unresolvedLegalBasisActivities: string[];
    statutoryRightsDoNotRequireConsent: true;
    breachDoesNotRequireConsent: true;
    adminCannotFabricateConsent: true;
    productionBlockers: string[];
  };
  psp: { status: 'FLAGGED' | 'CONFIRMED'; note: string };
  legalReview: {
    anyApproved: boolean;
    anyPending: boolean;
    byDocument: Array<{ documentType: string; version: string; status: string }>;
    note: string;
  };
  founderApproval: {
    anyApproved: boolean;
    anyPending: boolean;
    byDocument: Array<{ documentType: string; version: string; status: string }>;
    note: string;
  };
};

export type AdminLegalStats = {
  releasesByStatus: Array<{ status: string; _count: number }>;
  acceptanceCount: number;
  consentsByStatus: Array<{ status: string; _count: number }>;
  dataSubjectRequestsByStatus: Array<{ status: string; _count: number }>;
  priorConsentReadiness?: {
    corpusVersion: string;
    adminCannotGrantConsent: true;
    purposeDefs: Array<{
      purposeKey: string;
      nameEn: string;
      legalBasisStatus: string;
      durationStatus: string;
      withdrawalEffectStatus: string;
      corpusVersion: string;
      collectionPoints: string[];
    }>;
    countsByPurposeStatus: Array<{ purposeKey: string; status: string; count: number }>;
    validityStatesSupported: string[];
  };
  note: string;
};

export type AdminLegalAcceptanceInspect = {
  id: string;
  userId: string;
  documentVersionId: string;
  releaseId: string;
  documentType: string;
  documentVersion: string;
  documentHash: string;
  language: string;
  acceptedAt: string;
  acceptanceContext: string;
  relatedBookingId: string | null;
  relatedOwnerProfileId: string | null;
  sourceSurface: string | null;
  explicitAction: boolean;
  evidenceSource: string;
  withdrawnAt: string | null;
  user?: { id: string; email: string | null; name: string | null } | null;
  version?: AdminLegalVersion | null;
  release?: AdminLegalRelease | null;
};

export type AdminDataSubjectRequestRow = {
  id: string;
  userId: string | null;
  email: string | null;
  type: string;
  status: string;
  description: string | null;
  adminNote: string | null;
  rejectionReason: string | null;
  receivedAt?: string;
  dueAt?: string | null;
  overdue?: boolean;
  urgency?: 'ok' | 'DUE_SOON' | 'OVERDUE' | 'closed';
  holidayCalendarVerified?: boolean;
  holidayCalendarStatus?: 'HOLIDAY_CALENDAR_CONFIGURED' | 'HOLIDAY_CALENDAR_VERIFICATION_REQUIRED';
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  completedAt?: string | null;
  handledByUserId: string | null;
};

export async function fetchAdminLegalReleases(documentType?: string) {
  const q = documentType ? `?documentType=${encodeURIComponent(documentType)}` : '';
  return adminFetch<{ data: AdminLegalRelease[] }>(`/admin/legal/releases${q}`);
}

export async function fetchAdminLegalRelease(id: string) {
  return adminFetch<{ data: AdminLegalRelease }>(`/admin/legal/releases/${encodeURIComponent(id)}`);
}

export async function fetchAdminLegalVersions(params?: {
  documentType?: string;
  language?: string;
  status?: string;
}) {
  const sp = new URLSearchParams();
  if (params?.documentType) sp.set('documentType', params.documentType);
  if (params?.language) sp.set('language', params.language);
  if (params?.status) sp.set('status', params.status);
  const q = sp.toString() ? `?${sp}` : '';
  return adminFetch<{ data: AdminLegalVersion[] }>(`/admin/legal/versions${q}`);
}

export async function createAdminLegalDraft(input: {
  documentType: string;
  version: string;
  requiresReacceptance?: boolean;
  materialChange?: boolean;
  changelog?: string | null;
  summaryOfChanges?: string | null;
  effectiveAt?: string | null;
  versions: Array<{
    language: 'ar' | 'en';
    title: string;
    content: string;
    sourceRef?: string | null;
  }>;
}) {
  return adminFetch<{ data: AdminLegalRelease }>('/admin/legal/releases', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateAdminLegalDraft(
  releaseId: string,
  input: {
    requiresReacceptance?: boolean;
    materialChange?: boolean;
    changelog?: string | null;
    summaryOfChanges?: string | null;
    effectiveAt?: string | null;
    versions?: Array<{
      language: 'ar' | 'en';
      title: string;
      content: string;
      sourceRef?: string | null;
    }>;
  },
) {
  return adminFetch<{ data: AdminLegalRelease }>(
    `/admin/legal/releases/${encodeURIComponent(releaseId)}`,
    { method: 'PATCH', body: JSON.stringify(input) },
  );
}

export async function publishAdminLegalRelease(input: {
  releaseId: string;
  effectiveAt?: string | null;
}) {
  return adminFetch<{ data: AdminLegalRelease }>('/admin/legal/releases/publish', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function scheduleAdminLegalRelease(input: {
  releaseId: string;
  effectiveAt: string;
}) {
  return adminFetch<{ data: AdminLegalRelease }>('/admin/legal/releases/schedule', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function fetchAdminLegalAcceptance(id: string) {
  return adminFetch<{ data: AdminLegalAcceptanceInspect }>(
    `/admin/legal/acceptances/${encodeURIComponent(id)}`,
  );
}

export async function fetchAdminLegalStats() {
  return adminFetch<{ data: AdminLegalStats }>('/admin/legal/stats');
}

export async function fetchAdminDataSubjectRequests(status?: string, overdueOnly?: boolean) {
  const sp = new URLSearchParams();
  if (status) sp.set('status', status);
  if (overdueOnly) sp.set('overdue', '1');
  const q = sp.toString() ? `?${sp}` : '';
  return adminFetch<{ data: AdminDataSubjectRequestRow[] }>(
    `/admin/legal/data-subject-requests${q}`,
  );
}

export async function patchAdminDataSubjectRequest(
  id: string,
  input: { status: string; adminNote?: string | null; rejectionReason?: string | null },
) {
  return adminFetch<{ data: AdminDataSubjectRequestRow }>(
    `/admin/legal/data-subject-requests/${encodeURIComponent(id)}`,
    { method: 'PATCH', body: JSON.stringify(input) },
  );
}

export type AdminBreachIncidentRow = {
  id: string;
  title: string;
  incidentKind: string;
  workflowStatus: string;
  discoveredAt: string;
  initiallyRecordedDiscoveryAt: string;
  correctedDiscoveryAt?: string | null;
  effectiveDiscoveryAt: string;
  severeHarmAssessment: string;
  involvesFinancialSensitiveData: boolean;
  involvesKycData: boolean;
  dataSubjectNotificationRequired?: boolean;
  customerNotificationRequired: boolean;
  authorityNotificationRequired: boolean;
  dataSubjectNotificationDueAt?: string | null;
  customerNotificationDueAt?: string | null;
  authorityNotificationDueAt?: string | null;
  dataSubjectNotificationStatus?: string;
  customerNotificationStatus: string;
  authorityNotificationStatus: string;
  customerDeadlineUrgency?: string;
  dataSubjectDeadlineUrgency?: string;
  authorityDeadlineUrgency?: string;
  dataSubjectNoticeContentHash?: string | null;
  customerNoticeContentHash?: string | null;
  authorityPackJson?: { statusEn?: string } | null;
  authoritySubmittedAt?: string | null;
  emailProviderBlocker?: string | null;
  accessControlGapNoteEn?: string;
  affectedSubjectRefCount?: number;
  deadlinesChanged?: boolean;
};

export async function fetchAdminBreachIncidents(params?: {
  workflowStatus?: string;
  incidentKind?: string;
}) {
  const sp = new URLSearchParams();
  if (params?.workflowStatus) sp.set('workflowStatus', params.workflowStatus);
  if (params?.incidentKind) sp.set('incidentKind', params.incidentKind);
  const q = sp.toString() ? `?${sp}` : '';
  return adminFetch<{ data: AdminBreachIncidentRow[] }>(`/admin/legal/breach-incidents${q}`);
}

export async function fetchAdminBreachIncident(id: string) {
  return adminFetch<{ data: AdminBreachIncidentRow }>(
    `/admin/legal/breach-incidents/${encodeURIComponent(id)}`,
  );
}

export async function createAdminBreachIncident(input: Record<string, unknown>) {
  return adminFetch<{ data: AdminBreachIncidentRow }>('/admin/legal/breach-incidents', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function patchAdminBreachIncident(id: string, input: Record<string, unknown>) {
  return adminFetch<{ data: AdminBreachIncidentRow }>(
    `/admin/legal/breach-incidents/${encodeURIComponent(id)}`,
    { method: 'PATCH', body: JSON.stringify(input) },
  );
}

export async function prepareAdminBreachAuthorityPack(id: string) {
  return adminFetch<{ data: AdminBreachIncidentRow }>(
    `/admin/legal/breach-incidents/${encodeURIComponent(id)}/authority-pack/prepare`,
    { method: 'POST', body: JSON.stringify({}) },
  );
}

export async function bootstrapAdminLegalPlaceholders() {
  return adminFetch<{ data: AdminLegalRelease[]; note?: string }>(
    '/admin/legal/bootstrap-placeholders',
    { method: 'POST', body: JSON.stringify({}) },
  );
}

export async function fetchAdminLegalActivationReadiness() {
  return adminFetch<{ data: AdminLegalActivationReadiness }>(
    '/admin/legal/activation-readiness',
  );
}

export async function fetchAdminBookingLegalSnapshot(bookingId: string) {
  return adminFetch<{ data: unknown }>(
    `/admin/legal/bookings/${encodeURIComponent(bookingId)}/snapshot`,
  );
}

export async function patchAdminLegalReleaseGovernance(
  releaseId: string,
  input: {
    legalReviewStatus?: string;
    legalReviewReference?: string | null;
    legalReviewNote?: string | null;
    founderApprovalStatus?: string;
    founderApprovalNote?: string | null;
    reason: string;
  },
) {
  return adminFetch<{ data: AdminLegalRelease }>(
    `/admin/legal/releases/${encodeURIComponent(releaseId)}/governance`,
    { method: 'PATCH', body: JSON.stringify(input) },
  );
}

/** Phase 3C.4D.3 — Admin property authority review */
export async function fetchAdminPropertyAuthority(propertyId: string) {
  return adminFetch<{ data: Record<string, unknown> }>(
    `/admin/properties/${propertyId}/authority`,
  );
}

export async function decideAdminPropertyAuthority(
  propertyId: string,
  input: {
    decision: 'approve' | 'request_changes' | 'reject';
    reasonCategory?: string;
    reasonText?: string;
  },
) {
  return adminFetch<{ data: Record<string, unknown> }>(
    `/admin/properties/${propertyId}/authority/decision`,
    { method: 'POST', body: JSON.stringify(input) },
  );
}

/** Phase 3C.4D.4A — Admin regulatory review */
export async function fetchAdminPropertyRegulatory(propertyId: string) {
  return adminFetch<{ data: Record<string, unknown> }>(
    `/admin/properties/${propertyId}/regulatory`,
  );
}

export async function decideAdminRegulatoryRequirement(
  propertyId: string,
  requirementId: string,
  input: Record<string, unknown>,
) {
  return adminFetch<{ data: Record<string, unknown> }>(
    `/admin/properties/${propertyId}/regulatory/requirements/${requirementId}/decision`,
    { method: 'POST', body: JSON.stringify(input) },
  );
}

export async function bootstrapAdminPropertyActivities(propertyId: string) {
  return adminFetch<{ data: Record<string, unknown> }>(
    `/admin/properties/${propertyId}/regulatory/bootstrap-activities`,
    { method: 'POST', body: '{}' },
  );
}

/** Phase 3C.4D.5 — Admin pool safety */
export async function fetchAdminPropertyPoolSafety(propertyId: string) {
  return adminFetch<{ data: Record<string, unknown> }>(
    `/admin/properties/${propertyId}/pool-safety`,
  );
}
