# Phase 3B — KYC / Partner Verification Privacy Notice Audit

**REQUIRES JORDANIAN LEGAL REVIEW** — this is an engineering inventory, not a privacy notice.

## What Mazare3 collects (partner KYC)

| Data | Where | Public listing? | Access |
|------|-------|-----------------|--------|
| Identity / business registration files | Private partner document storage + `OwnerDocument` | No | Owner (own), admin reviewers |
| Entity type, business name, phone | `OwnerProfile` / verification profile | No (phone never on public listing) | Owner, admin |
| Payout / IBAN proofs | Encrypted / fingerprint fields + private files | No | Owner, admin ops |
| Partner agreement acceptance | `PartnerAgreementAcceptance` (+ bridged `LegalAcceptance` for `owner_agreement` when published) | No | Owner, admin |
| Commercial terms | `PartnerCommercialTerms` + optional `CommercialTermsAcceptance` | No | Owner, admin |

## Notice gaps (Phase 3B)

1. Static privacy page mentions partner verification documents; dedicated **verification_policy** document type exists in schema but content is Phase 3C.
2. Purpose limitation: KYC files are for verification / compliance / payout readiness — not marketing.
3. Retention: **RETENTION PERIOD REQUIRES LEGAL REVIEW** (see retention map).
4. Cross-border / processor disclosures for private object storage (R2/S3) need legal review.
5. No fabricated historical `LegalAcceptance` for owners who accepted PartnerAgreement before Phase 3B — PartnerAgreementAcceptance remains bridge evidence until material reacceptance.

## Controls already in product

- Private storage providers (not public media CDN).
- Admin-only document streaming endpoints.
- Audit logs on partner review actions.
- Soft gate on new listings when `owner_agreement` requires reacceptance (no blanket account lockout).

## Follow-ups for Phase 3C

- Publish `verification_policy` LegalRelease (AR/EN) with Jordanian counsel.
- Surface purpose + retention language in owner onboarding UI (separate from marketing).
- Document lawful basis language for Jordan (counsel).
