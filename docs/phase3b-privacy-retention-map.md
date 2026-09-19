# Phase 3B — Privacy Retention Map

**RETENTION PERIOD REQUIRES LEGAL REVIEW** — durations below are operational placeholders, not legal advice.

| Data category | Storage | Suggested retention (PLACEHOLDER) | Deletion / export notes |
|---------------|---------|-----------------------------------|-------------------------|
| Account profile (email, name, locale) | `User` | Account life + **RETENTION PERIOD REQUIRES LEGAL REVIEW** after deletion request | Honor DSR erasure where lawfully required; financial records may need longer hold |
| Auth identities | `AuthIdentity` | Same as account | Cascade with user where allowed |
| Password hashes | `User.passwordHash` | Until password change / account erasure | Never export plaintext |
| Sessions / JWT | Cookie | Short-lived | Essential |
| Legal acceptances | `LegalAcceptance` | **Indefinite proof of contract** (immutable) — **RETENTION PERIOD REQUIRES LEGAL REVIEW** for post-termination archive | Do not fabricate; do not silent-delete without legal basis |
| Privacy consents | `PrivacyConsent` | Grant history retained after withdraw | Withdraw sets `withdrawnAt`; new grant = new row |
| Booking legal snapshots | `BookingLegalSnapshot` | Booking + financial retention window | Links to SSOT hash + legal version IDs |
| Bookings / payments | Booking, Payment | Financial/tax retention — **RETENTION PERIOD REQUIRES LEGAL REVIEW** | Prefer anonymize over hard-delete when legal hold applies |
| KYC / partner documents | Private storage + `OwnerDocument` | Verification purpose + **RETENTION PERIOD REQUIRES LEGAL REVIEW** | Restricted access; see KYC notice audit |
| Audit logs | `AuditLog` | Security/ops — **RETENTION PERIOD REQUIRES LEGAL REVIEW** | Prefer hashed IP only when documented |
| Data subject requests | `DataSubjectRequest` | Request lifecycle + audit archive | Admin notes may contain personal data |
| Marketing consent | `PrivacyConsent` (`marketing_*`) | Until withdrawn + proof retention | Separate from Terms |
| Optional cookies / analytics | Client + optional consent | Until withdrawn | Do not load marketing pixels without consent |
| Support tickets / disputes | Support / Dispute tables | Case resolution + **RETENTION PERIOD REQUIRES LEGAL REVIEW** | |

## Principles

1. Contract evidence (`LegalAcceptance`) is kept to prove what was accepted — distinct from marketing consent.
2. Privacy acknowledgement ≠ processing consent for optional purposes.
3. Erasure requests are handled via `DataSubjectRequest` workflow; status may be `rejected_with_reason` when legal retention applies.
4. No IP stored by default on `LegalAcceptance.metadata`; if added, store `ipHash` only with documented basis.

See also: [phase3b-legal-consent-architecture.md](./phase3b-legal-consent-architecture.md).
