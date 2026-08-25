/**
 * Owner-approval response window. Instant bookings never use this.
 * Single source for OWNER_APPROVAL_RESPONSE_MINUTES.
 */
const DEFAULT_OWNER_APPROVAL_RESPONSE_MINUTES = 60;

export function loadOwnerApprovalResponseMinutes(): number {
  const n = Number(process.env.OWNER_APPROVAL_RESPONSE_MINUTES);
  if (Number.isFinite(n) && n > 0 && n <= 60 * 24 * 14) return Math.floor(n);
  return DEFAULT_OWNER_APPROVAL_RESPONSE_MINUTES;
}

export function computeOwnerApprovalExpiresAt(from = new Date()): Date {
  const expires = new Date(from.getTime());
  expires.setMinutes(expires.getMinutes() + loadOwnerApprovalResponseMinutes());
  return expires;
}
