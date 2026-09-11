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
