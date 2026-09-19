# Phase 3B — Legal & Consent Architecture

**Status:** Architecture core (schema + services + APIs). Placeholder legal content pending Phase 3C rewrite.  
**Safety:** Local/additive only. Never fabricate historical acceptances.

## Separation of concerns

| Concern | Mechanism | Notes |
|---------|-----------|-------|
| Contract acceptance | `LegalAcceptance` with Terms / cancellation / booking_terms / owner_agreement | Explicit checkbox per document; immutable evidence |
| Privacy acknowledgement | Separate `LegalAcceptance` with context `privacy_consent` | Acknowledgement of notice — **not** blanket processing consent |
| Purpose-specific consent | `PrivacyConsent` rows (`marketing_email`, `marketing_sms`, `personalized_analytics`, `optional_cookies`) | Optional only; withdraw keeps history |
| Marketing | `PrivacyConsent` only | Never bundled with Terms+Privacy signup checkbox |

**Never** ship a single checkbox that covers Terms + Privacy + Marketing.

## Core models

- **LegalRelease** — bilingual logical release (`documentType` + `version`). Flags: `requiresReacceptance`, `materialChange`.
- **LegalDocumentVersion** — per-language publication (`ar`/`en`) with `contentHash` (SHA-256 of UTF-8 trimmed content). Linked via `releaseId`. Unique `(releaseId, language)`.
- **LegalAcceptance** — immutable evidence. Core fields never updated after create. `evidenceSource`: `user_explicit_acceptance` (default) or `system_import_admin_exception` (never forge via generic UI).
- **BookingLegalSnapshot** — at booking create: financial SSOT hash + legal version IDs + cancellation rules JSON from `marketplace-financial-policy`.
- **PrivacyConsent** — grant/withdraw; re-grant creates a **new** row.
- **CommercialTermsAcceptance** — owner ack of commercial terms; no auto-backfill.
- **DataSubjectRequest** — access/correction/erasure/objection/portability/privacy_inquiry.

Acceptance status is **computed** from `LegalAcceptance` (no `UserLegalState` backfill).

## Publishing rules

1. Only `draft` (or `scheduled`) releases can be published.
2. On publish: prior `active` → `superseded`; new → `active`.
3. Content of `active`/`superseded` cannot be edited (update allowed on `draft` only).
4. Service enforces: never two overlapping `ACTIVE` versions for same `documentType` + `language`.
5. Every publish writes `AuditLog` (`legal.release.published`).

## Financial SSOT link

`packages/shared/src/legal-policy.ts` → `buildFinancialPolicySnapshot()` imports numbers from `marketplace-financial-policy.ts`.  
`BookingLegalSnapshot.financialPolicyKey` = `phase1-ssot-v1`; `financialPolicyHash` = SHA-256 of canonical SSOT JSON.

## Key APIs

### Public
- `GET /legal/documents/:type?lang=ar|en`
- `GET /legal/documents/:type/versions/:versionId` (active public; superseded requires auth)

### Authenticated (`/me`)
- `POST /me/legal/accept`
- `GET /me/legal/status`
- `POST /me/privacy-consents` / `POST /me/privacy-consents/:purpose/withdraw` / `GET /me/privacy-consents`
- `POST /me/data-subject-requests` / `GET /me/data-subject-requests`
- `POST /me/bookings/:id/legal-ack`

### Signup
- Requires `acceptedTermsVersionId` + `acknowledgedPrivacyVersionId` (separate).
- `marketingConsent` optional and separate.

### Booking create
- Optional `acceptedDocumentVersionIds`; then `createSnapshotForBooking` + acceptance records.

### Admin (`/admin/legal`)
- Draft CRUD, publish, schedule, stats, inspect acceptance by id, DSR status updates, bootstrap placeholders.
- **Never** expose UI to forge `user_explicit_acceptance`.

### Owner
- Soft gate on listing create when `owner_agreement` `requiresReacceptance`.
- Partner agreement accept also records `LegalAcceptance` when an active `owner_agreement` legal version exists (bridge; does not fabricate historical rows).

## Bootstrap

`POST /admin/legal/bootstrap-placeholders` creates ACTIVE placeholder releases for terms / privacy / cancellation / booking_terms / owner_agreement.  
Changelog: `Phase 3B architecture bootstrap — placeholder pending Phase 3C final legal rewrite`.  
Content banner: `REQUIRES JORDANIAN LEGAL REVIEW`.  
**Does not** create user acceptances.

## Related docs

- [phase3b-privacy-retention-map.md](./phase3b-privacy-retention-map.md)
- [phase3b-cookie-tracker-audit.md](./phase3b-cookie-tracker-audit.md)
- [phase3b-kyc-privacy-notice-audit.md](./phase3b-kyc-privacy-notice-audit.md)
- [phase2-privacy-data-flow-inventory.md](./phase2-privacy-data-flow-inventory.md)
