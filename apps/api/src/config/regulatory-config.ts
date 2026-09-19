/**
 * Phase 3C.4D.4A — regulatory expiry warning config (product threshold, not legal validity).
 * REGULATORY_RBAC_HARDENING_PENDING — uses requireAdmin for now.
 */
export const REGULATORY_DOCUMENT_EXPIRY_WARNING_DAYS = (() => {
  const raw = process.env.REGULATORY_DOCUMENT_EXPIRY_WARNING_DAYS;
  const n = raw ? Number(raw) : NaN;
  if (Number.isFinite(n) && n >= 1 && n <= 365) return Math.floor(n);
  return 30;
})();
