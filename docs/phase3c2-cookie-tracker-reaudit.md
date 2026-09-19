# Phase 3C.2 — Cookie / Tracker Re-audit

**Scope:** `apps/web` source (LOCAL). No Production deploy.
**Date:** 2026-09-11
**Prior inventory:** [phase3b-cookie-tracker-audit.md](./phase3b-cookie-tracker-audit.md)

## Method

Ripgrep over `apps/web` (excluding `node_modules` / `.next`) for:

`gtag`, `googleanalytics`, `google-analytics`, `googletagmanager`, `GTM-`, `facebook`, `fbq(`, `pixel`, `hotjar`, `mixpanel`, `segment.com`, `clarity.ms`, `fullstory`, `amplitude`

## Findings

| Pattern | Hits in apps/web | Classification | Action |
|---------|------------------|----------------|--------|
| gtag / Google Analytics / GTM | **None** | ANALYTICS (not shipped) | No banner; do not add |
| Meta / Facebook pixel (`fbq`) | **None** | MARKETING (not shipped) | No banner; do not add |
| Hotjar | **None** | ANALYTICS (not shipped) | — |
| Mixpanel / Segment / Clarity / FullStory / Amplitude | **None** | ANALYTICS (not shipped) | — |
| `pixel` string | 1 false positive: `use-circular-carousel.ts` comment about **viewport pixels** | N/A | Ignore |

## Essentials still in use (unchanged from 3B)

| Name / pattern | Category | Consent? |
|----------------|----------|----------|
| Session / auth JWT HttpOnly cookie | ESSENTIAL | No |
| Locale / `NEXT_LOCALE` | ESSENTIAL | No |
| CSRF / security tokens | ESSENTIAL | No |
| PayTabs / payment provider cookies (checkout frame) | ESSENTIAL | No (transactional) |

## Decision

**Do NOT add a cookie consent banner** while only essentials (plus transactional payment frames) are present.

If analytics or marketing scripts are introduced later:

1. Update this doc + `apps/api/src/services/legal/cookie-tracker-audit.ts`
2. Gate load behind `PrivacyConsent` (`optional_cookies` / `personalized_analytics` / `marketing_*`)
3. **RETENTION PERIOD REQUIRES LEGAL REVIEW**

## Gaps / follow-ups

- Re-scan **production bundle** (compiled `.next` / CDN) before Production activation — source scan does not catch injected third-party tags from hosting.
- Keep essentials-only stance until counsel/product explicitly enable optional trackers.
