/**
 * Cookie / tracker classification companion.
 * Authoritative report: docs/phase3b-cookie-tracker-audit.md
 * Re-audit (Phase 3C.2): docs/phase3c2-cookie-tracker-reaudit.md — no gtag/GA/Meta/Hotjar/Mixpanel in apps/web source.
 *
 * Categories: ESSENTIAL | FUNCTIONAL | ANALYTICS | MARKETING | UNKNOWN
 * Only optional_cookies purpose may be gated via PrivacyConsent.
 */

export type CookieTrackerCategory =
  | 'ESSENTIAL'
  | 'FUNCTIONAL'
  | 'ANALYTICS'
  | 'MARKETING'
  | 'UNKNOWN';

export type CookieTrackerEntry = {
  namePattern: string;
  category: CookieTrackerCategory;
  purpose: string;
  notes: string;
};

export const COOKIE_TRACKER_CLASSIFICATION: CookieTrackerEntry[] = [
  {
    namePattern: 'mazare3_session / auth JWT cookie',
    category: 'ESSENTIAL',
    purpose: 'Keep user signed in',
    notes: 'HttpOnly session; not optional',
  },
  {
    namePattern: 'NEXT_LOCALE / locale preference',
    category: 'ESSENTIAL',
    purpose: 'Language routing',
    notes: 'Product UX; not advertising',
  },
  {
    namePattern: 'csrf / security tokens',
    category: 'ESSENTIAL',
    purpose: 'Request integrity',
    notes: 'Security control',
  },
  {
    namePattern: 'PayTabs / payment provider frames',
    category: 'ESSENTIAL',
    purpose: 'Checkout payment',
    notes: 'Third-party during payment only; Mazare3 does not store PAN/CVV',
  },
  {
    namePattern: 'Google Analytics / gtag / GA_*',
    category: 'ANALYTICS',
    purpose: 'Usage analytics',
    notes: 'If introduced — requires optional_cookies or personalized_analytics consent; currently UNKNOWN if not shipped',
  },
  {
    namePattern: 'Meta / TikTok / ad pixels',
    category: 'MARKETING',
    purpose: 'Ads attribution',
    notes: 'Must not load without marketing / optional_cookies consent; verify none in production build',
  },
  {
    namePattern: 'Unclassified third-party scripts',
    category: 'UNKNOWN',
    purpose: 'Needs inventory',
    notes: 'RETENTION / LEGAL REVIEW — keep inventory updated in docs/phase3b-cookie-tracker-audit.md',
  },
];
