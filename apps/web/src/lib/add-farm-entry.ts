import type { AuthUser } from '@/lib/api-auth';

/** Customer-facing Add Farm → property wizard (approved owners only). */
export const ADD_FARM_WIZARD_HREF = '/owner/properties/new';

/** Customer-facing Add Farm → partner / become-owner entry (everyone else). */
export const ADD_FARM_PARTNER_HREF = '/become-owner';

/** Approved-owner property list (Account discoverability). */
export const OWNER_PROPERTIES_HREF = '/owner/properties';

export type AddFarmHref = typeof ADD_FARM_WIZARD_HREF | typeof ADD_FARM_PARTNER_HREF;

export type AddFarmEntryUser = Pick<AuthUser, 'role' | 'ownerProfileStatus'> | null | undefined;

/**
 * Display-label keys for shared Add Farm / partner CTAs.
 * Destinations stay in `resolveAddFarmHref` — labels must not change auth rules.
 */
export type AddFarmCtaLabelKey =
  | 'addProperty'
  | 'continueApplication'
  | 'trackApplication'
  | 'updateApplication'
  | 'viewApplication';

/**
 * Account-page partnership surface kinds.
 * Derived from the same partner/owner status signals as Add Farm entry — not a second FSM.
 */
export type AccountPartnerSurfaceKind =
  | 'join'
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'changes_requested'
  | 'rejected'
  | 'suspended'
  | 'approved';

/** Client hint only — never invents status; set when `/become-owner` hydrates real DTO. */
export const PARTNER_STATUS_HINT_KEY = 'mazare3.partnerVerificationStatus';

/**
 * Resolves the customer-facing "Add your farm / أضف مزرعتك" destination.
 * Does not invent partner statuses — uses session owner approval only.
 * Partner application resume/status remains on `/become-owner`.
 */
export function isApprovedOwnerForAddFarm(user: AddFarmEntryUser): boolean {
  return user?.role === 'owner' && user.ownerProfileStatus === 'approved';
}

export function resolveAddFarmHref(user: AddFarmEntryUser): AddFarmHref {
  if (isApprovedOwnerForAddFarm(user)) return ADD_FARM_WIZARD_HREF;
  return ADD_FARM_PARTNER_HREF;
}

/**
 * Account partnership card state. Pass authoritative `verificationStatus` when available
 * (from `/owner/onboarding` for users who already have an OwnerProfile).
 * Returns `null` for admin accounts (no applicant surface).
 */
export function resolveAccountPartnerSurface(params: {
  user: AddFarmEntryUser;
  verificationStatus?: string | null;
}): AccountPartnerSurfaceKind | null {
  const { user, verificationStatus } = params;
  if (!user) return 'join';
  if (user.role === 'admin') return null;

  if (isApprovedOwnerForAddFarm(user)) return 'approved';

  const vs = verificationStatus ?? null;
  if (vs === 'approved' || vs === 'legacy_approved') return 'approved';
  if (vs === 'draft') return 'draft';
  if (vs === 'submitted') return 'submitted';
  if (vs === 'under_review') return 'under_review';
  if (vs === 'changes_requested') return 'changes_requested';
  if (vs === 'rejected') return 'rejected';
  if (vs === 'suspended') return 'suspended';

  const ownerStatus = user.ownerProfileStatus ?? null;
  if (!ownerStatus) return 'join';
  if (ownerStatus === 'approved') return 'approved';
  if (ownerStatus === 'rejected') return 'rejected';
  if (ownerStatus === 'suspended') return 'suspended';
  // pending without verificationStatus: caller should fetch onboarding when a profile exists
  return 'draft';
}

/**
 * Shared CTA label resolver. Prefer `verificationStatus` when known (from onboarding DTO
 * or a remembered client hint). Falls back to coarse OwnerStatus from session only —
 * does not call partner APIs (those ensure/create drafts).
 */
export function resolveAddFarmLabelKey(params: {
  user: AddFarmEntryUser;
  verificationStatus?: string | null;
}): AddFarmCtaLabelKey {
  const surface = resolveAccountPartnerSurface(params);
  if (!surface || surface === 'join') return 'addProperty';
  if (surface === 'draft') return 'continueApplication';
  if (surface === 'submitted' || surface === 'under_review') return 'trackApplication';
  if (surface === 'changes_requested') return 'updateApplication';
  if (surface === 'rejected' || surface === 'suspended') return 'viewApplication';
  return 'addProperty';
}

/** True when Account may safely fetch partner onboarding without creating a new draft. */
export function shouldFetchPartnerStatusForAccount(user: AddFarmEntryUser): boolean {
  if (!user || user.role === 'admin') return false;
  if (isApprovedOwnerForAddFarm(user)) return false;
  return Boolean(user.ownerProfileStatus);
}

export function rememberPartnerVerificationStatus(status: string | null | undefined) {
  if (typeof window === 'undefined') return;
  try {
    if (!status) {
      window.sessionStorage.removeItem(PARTNER_STATUS_HINT_KEY);
    } else {
      window.sessionStorage.setItem(PARTNER_STATUS_HINT_KEY, status);
    }
    window.dispatchEvent(new Event('mazare3-partner-status-hint'));
  } catch {
    /* ignore quota / private mode */
  }
}

export function readRememberedPartnerVerificationStatus(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage.getItem(PARTNER_STATUS_HINT_KEY);
  } catch {
    return null;
  }
}
