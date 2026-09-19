# Phase 3C.1 — Third-Party Processor Inventory

**Status:** Engineering inventory from repository / config evidence — **not legal advice**.  
**Rule:** Do not guess hosting countries. If location is not determinable from repo/config: **UNKNOWN — LEGAL REVIEW REQUIRED**.

Controller for marketplace personal data is expected to be the Mazare3 **legal entity** once identified (`[[LEGAL_ENTITY_NAME]]` — currently **MISSING**). Vendor classifications below are **flags for counsel**, not final determinations.

Related: [phase3c1-legal-identity-inputs.md](./phase3c1-legal-identity-inputs.md), [phase3c1-jordan-pdpl-compliance-gap.md](./phase3c1-jordan-pdpl-compliance-gap.md), [phase3b-cookie-tracker-audit.md](./phase3b-cookie-tracker-audit.md).

---

## Inventory table

| Vendor | Purpose | Data categories (from repo) | Location | Evidence | Controller / processor flag | Cross-border | Notes |
|--------|---------|-----------------------------|----------|----------|------------------------------|--------------|-------|
| **Neon PostgreSQL** | Primary application database | Accounts, auth identities, bookings, payment metadata, KYC refs, legal acceptances, consents, DSR, audit logs | **UNKNOWN — LEGAL REVIEW REQUIRED** | `DATABASE_URL` / `.env.example` neon.tech pattern; staging docs | Likely **processor** of Mazare3 controller data | Assume possible until region confirmed | Local `.env` has DB configured (presence only) |
| **Cloudflare R2 (public)** | Property / listing media | Public images | **UNKNOWN — LEGAL REVIEW REQUIRED** | `property-media-storage.config.ts`; `PROPERTY_MEDIA_STORAGE_PROVIDER=cloudflare_r2_public` | Likely **processor** | Assume possible until region confirmed | Public CDN-style access |
| **Cloudflare R2 (private)** | Partner KYC / verification documents | Identity / business files, payout proofs (private) | **UNKNOWN — LEGAL REVIEW REQUIRED** | `partner-document-storage.config.ts`; `PARTNER_DOCUMENT_STORAGE_PROVIDER=cloudflare_r2_private` | Likely **processor** | Assume possible until region confirmed | Sensitive; admin-gated streaming |
| **PayTabs** | Card checkout, IPN/callbacks, refunds path | Payment amounts, status, provider refs; **no PAN/CVV in Mazare3 DB** | Jordan API endpoint default `https://secure-jordan.paytabs.com`; full processing geography still **UNKNOWN — LEGAL REVIEW REQUIRED** | `PAYMENT_GATEWAY_PROVIDER=paytabs`; `paytabs-config.ts`; `paytabs-payment-gateway.ts` | **REQUIRES PSP / JORDANIAN LEGAL REVIEW** — may be independent controller and/or processor depending on MoR | Endpoint Jordan-labelled; MoR **UNKNOWN** | **Not escrow**. Do not claim MoR without contract review |
| **Google OAuth** | Social login | Google profile / email (as provided by Google) | **UNKNOWN — LEGAL REVIEW REQUIRED** | `GOOGLE_AUTH_ENABLED`; client id/secret/redirect env | Google typically **independent controller** for its account; Mazare3 **controller** of account link data — **LEGAL REVIEW REQUIRED** | Likely | Login only |
| **Resend** | Transactional email (when enabled) | Email addresses, notification content | **UNKNOWN — LEGAL REVIEW REQUIRED** | `email-config.ts`; docs/`transactional-email.md` | Likely **processor** when active | Assume possible when enabled | **Configured in stack but currently inactive:** `EMAIL_PROVIDER=none`; Resend API key / `EMAIL_FROM` empty |
| **Hosting (web/API)** | Application hosting | Request/session traffic, logs as configured by host | **UNKNOWN — LEGAL REVIEW REQUIRED** | Docs mention **Vercel (web) + Railway/Render (API)** — **not confirmed in env** | Likely **processor(s)** if used | Assume possible | Do not assert a specific host until Production env is known |

---

## Explicitly out of active inventory (or not evidenced)

| Vendor / path | Status |
|---------------|--------|
| Stripe | **Not used** (docs / policy) |
| CliQ / `card_gateway` | Code placeholders; not the primary configured gateway |
| SMTP / SendGrid providers | Stub implementations; not configured as active |
| SMS OTP vendor (Twilio/etc.) | `SMS_OTP_PROVIDER` defaults / unset — no production SMS vendor confirmed |
| Sentry / Datadog | Not found as runtime integration in env example |
| Cloudinary | Legacy/alternate path; not the active R2 media path |
| OpenStreetMap tiles | Map tiles; no user PII sent by default (tile requests) |

---

## MoR / escrow

| Question | Finding |
|----------|---------|
| Merchant of record | **UNKNOWN — REQUIRES PSP / JORDANIAN LEGAL REVIEW** |
| Escrow | **Not claimed**; do not describe Mazare3 as escrow unless independently proven |
| Payment role language until review | Marketplace + payment collection workflow; PayTabs primary gateway |

---

## Counsel follow-ups

1. Confirm data-center / region for Neon, both R2 buckets, Google, Resend, and Production hosts.  
2. Execute DPAs (or Jordan-equivalent) and list subprocessors in Privacy Policy.  
3. Resolve PayTabs contractual role (MoR vs facilitator) and update Terms / Booking Terms accordingly.  
4. Re-scan Production bundle for trackers before launch (see Phase 3B cookie audit).
