# Phase 3B — Cookie / Tracker Audit

Classification: **ESSENTIAL** | **FUNCTIONAL** | **ANALYTICS** | **MARKETING** | **UNKNOWN**

Optional purposes gated via `PrivacyConsent` (`optional_cookies`, `personalized_analytics`, `marketing_*`) only — never essential cookies.

| Name / pattern | Category | Purpose | Consent required? | Notes |
|----------------|----------|---------|-------------------|-------|
| Session / auth JWT HttpOnly cookie | ESSENTIAL | Keep user signed in | No | Product auth |
| Locale / `NEXT_LOCALE` | ESSENTIAL | Language routing | No | UX |
| CSRF / security tokens | ESSENTIAL | Request integrity | No | Security |
| PayTabs / payment provider cookies (checkout frame) | ESSENTIAL | Complete payment | No (transactional) | Third-party during checkout; Mazare3 does not store PAN/CVV |
| Preference cookies (non-auth UX) | FUNCTIONAL | Remember UI prefs | Prefer notice; optional if not strictly necessary | Inventory if introduced |
| Google Analytics / gtag / GA_* | ANALYTICS | Usage metrics | Yes (`personalized_analytics` or `optional_cookies`) | Confirm not shipped without consent |
| Meta / TikTok / ad pixels | MARKETING | Ads attribution | Yes (`marketing_*` / `optional_cookies`) | Must not load without consent |
| Unclassified third-party scripts | UNKNOWN | Needs inventory | Treat as opt-in until classified | Keep this doc updated |

## Code companion

`apps/api/src/services/legal/cookie-tracker-audit.ts` mirrors this table for engineers.

## Action items

1. Re-scan production web bundle for third-party scripts before Phase 3C launch.
2. **RETENTION PERIOD REQUIRES LEGAL REVIEW** for analytics identifiers if enabled.
3. Never bundle cookie consent with Terms acceptance.
