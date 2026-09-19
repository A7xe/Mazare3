# Phase 3C.1 — Legal Identity Inputs

**Status:** Internal drafting inventory (not legal advice).  
**Product names (confirmed):** Mazare3 Jordan / مزارع الأردن  
**Rule:** Do not invent company registration numbers, addresses, tax numbers, DPO names, or regulator approvals. Missing fields use explicit `[[PLACEHOLDER]]` tokens in launch-candidate legal drafts and are listed under **FOUNDER INPUT REQUIRED**.

Related: [phase3c1-jordan-pdpl-compliance-gap.md](./phase3c1-jordan-pdpl-compliance-gap.md), [phase3c1-third-party-processor-inventory.md](./phase3c1-third-party-processor-inventory.md), [phase3c1-launch-transition-plan.md](./phase3c1-launch-transition-plan.md).

---

## CONFIRMED

| Item | Value / evidence |
|------|------------------|
| Product name (EN) | **Mazare3 Jordan** (`apps/web/src/lib/legal/site-identity.ts` — `productNameEn`) |
| Product name (AR) | **مزارع الأردن** (`productNameAr`) |
| Package / repo product label | `mazare3-jordan` (`package.json`) |
| Policy page date stamp (non-statutory) | `LEGAL_PAGES_UPDATED_ON = '2026-08-19'` in `site-identity.ts` — documented as **not** a statutory filing date |
| Identity loader | Public legal/contact UI reads `NEXT_PUBLIC_*` identity env vars via `site-identity.ts` / `contact-identity.tsx` |
| Product ≠ legal entity | Code comment / design: product names are **not** a registered legal entity |

---

## MISSING

All of the following are **unset** in local `.env` (and empty/commented in `.env.example`). No alternate `COMPANY_*` / `LEGAL_*` / `SUPPORT_*` / `DPO_*` server-side identity vars were found beyond the `NEXT_PUBLIC_*` set.

| Field | Env var / hook | Status |
|-------|----------------|--------|
| Legal entity name | `NEXT_PUBLIC_LEGAL_ENTITY_NAME` | **MISSING** |
| Commercial registration / CR number | `NEXT_PUBLIC_REGISTRATION_NUMBER` | **MISSING** |
| Tax number | `NEXT_PUBLIC_TAX_NUMBER` | **MISSING** |
| Registered address | `NEXT_PUBLIC_REGISTERED_ADDRESS` | **MISSING** |
| Support / legal contact email | `NEXT_PUBLIC_SUPPORT_EMAIL` | **MISSING** |
| Privacy contact email | `NEXT_PUBLIC_PRIVACY_EMAIL` | **MISSING** |
| Support phone | `NEXT_PUBLIC_SUPPORT_PHONE` | **MISSING** |
| Data Protection Officer (DPO) | No env var; no content reference | **MISSING** — no DPO named or appointed in repo |

Contact UI intentionally omits rows when values are empty (`identityUnpublished` / deferred contact copy). Privacy draft copy notes when no public privacy mailbox is published.

---

## CONFLICTING

| Topic | Notes |
|-------|-------|
| Brand vs legal entity | UI and docs use **Mazare3 / Mazare3 Jordan / مزارع الأردن** as the product brand. No registered company name is published. **Do not assume** the brand string is the contracting legal entity. |
| Static legal pages vs DB releases | Static pages under `apps/web/src/content/legal/` are substantive product drafts without a “placeholder” banner. Phase 3B DB bootstrap releases (`1.0.0-placeholder`, ACTIVE locally) are explicit placeholders pending Phase 3C. Both exist; only launch-candidate DB releases + lawyer review should govern Production acceptance. |
| Marketplace payment role vs MoR | Product copy describes marketplace + payment collection path. **Merchant of record** for PayTabs is **UNKNOWN** — see FOUNDER INPUT / legal review. Not described as escrow. |
| Hosting narrative vs env | Staging docs mention Vercel + Railway/Render; hosting is **not confirmed** from env. Do not hard-code a host as the controller’s processing location. |

No conflicting *filled* legal-entity values were found (all identity fields are empty).

---

## FOUNDER INPUT REQUIRED

Supply before Production legal activation. Until then, launch-candidate texts must keep explicit placeholders (do not guess):

| Placeholder token | Meaning |
|-------------------|---------|
| `[[LEGAL_ENTITY_NAME]]` | Registered contracting entity (Arabic + English legal names if different) |
| `[[COMMERCIAL_REGISTRATION_NUMBER]]` | Jordan CR / registration number |
| `[[TAX_NUMBER]]` | Tax / VAT identifier if applicable |
| `[[REGISTERED_ADDRESS]]` | Registered office address |
| `[[LEGAL_CONTACT_EMAIL]]` / support mailbox | Maps to `NEXT_PUBLIC_SUPPORT_EMAIL` (or confirmed equivalent) |
| `[[PRIVACY_CONTACT_EMAIL]]` | Maps to `NEXT_PUBLIC_PRIVACY_EMAIL` |
| `[[SUPPORT_PHONE]]` | Maps to `NEXT_PUBLIC_SUPPORT_PHONE` (if to be published) |
| `[[DPO_OR_PRIVACY_CONTACT]]` | Named DPO **or** confirmed privacy contact role under Jordan PDPL — **REQUIRES JORDANIAN LEGAL REVIEW** whether a DPO is mandatory |
| `[[PAYMENT_PROVIDER_LEGAL_NAME]]` | PayTabs contracting entity + Mazare3’s role (MoR / payment facilitator / other) — **REQUIRES PSP / JORDANIAN LEGAL REVIEW** |

### Also required from founder / counsel (non-env)

1. Confirm Jordanian legal entity form and governing documents.  
2. Confirm PayTabs merchant agreement role (MoR unknown; **not escrow** unless independently proven).  
3. Confirm public support/privacy channels and SLA for DSR / complaints.  
4. Confirm whether a DPO must be appointed and registered under Personal Data Protection Law No. 24 of 2023 and 2025 instruments.  
5. Fill all seven `NEXT_PUBLIC_*` identity env vars (or document intentional non-publication with counsel sign-off).

---

## Drafting rule for Phase 3C.1

- **CONFIRMED** product names may appear as brand identifiers.  
- **MISSING** legal identity must appear as `[[…]]` placeholders in launch-candidate documents.  
- Never publish invented CR, tax, address, phone, email, or DPO details.  
- Production must **not** activate releases that still contain unresolved identity placeholders (see [phase3c1-launch-transition-plan.md](./phase3c1-launch-transition-plan.md)).
