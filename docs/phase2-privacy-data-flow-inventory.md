# Phase 2 — Privacy Data Flow Inventory (Marketplace Fairness)

Extends [phase1-privacy-data-flow-inventory.md](./phase1-privacy-data-flow-inventory.md).

> **Phase 3B update:** Legal/consent architecture added — see [phase3b-legal-consent-architecture.md](./phase3b-legal-consent-architecture.md), [phase3b-privacy-retention-map.md](./phase3b-privacy-retention-map.md), [phase3b-cookie-tracker-audit.md](./phase3b-cookie-tracker-audit.md), [phase3b-kyc-privacy-notice-audit.md](./phase3b-kyc-privacy-notice-audit.md). New stores: `LegalAcceptance`, `PrivacyConsent`, `BookingLegalSnapshot`, `DataSubjectRequest`, `CommercialTermsAcceptance`. No fabricated historical acceptances.

## New data categories

| Data | Stored | Plaintext exposure | Access |
|------|--------|-------------------|--------|
| Check-in PIN | `Booking.checkInCodeHash` + `checkInCodeSalt` | Returned once to customer when code is first generated; never logged | Customer (own booking), owner verifies via API |
| Check-in status | `Booking.checkInStatus`, `checkInVerifiedAt` | UI status only | Customer, owner, admin |
| Reschedule history | `BookingRescheduleRequest`, `originalBookingStartAt`, `rescheduleCount` | Request metadata in admin/audit | Customer, owner, admin |
| Incidents | `BookingIncident` (reports, evidence) | Evidence text restricted | Reporter, admin; owner notified on customer reports |
| Reliability | `OwnerReliabilityIncident` | Internal only — not public scoring | Admin, settlement ops |
| Penalties | `OwnerFinancialAdjustment` | Shown in owner settlement/admin | Owner (aggregated), admin |
| Goodwill credits | `Mazare3GoodwillCredit` | Admin foundation only in Phase 2 | Admin |

## Principles applied

- **Minimization**: Check-in uses hashed PIN; no GPS tracking.
- **No unnecessary PIN logging**: Audit logs record verification events, not PIN values.
- **Evidence access restricted**: Incident evidence visible to admins and involved parties via authenticated APIs.
- **Retention**: Follows booking/payment record retention; no separate public profile exposure.

## Flows

1. **Check-in**: Server generates PIN → hash stored → plaintext shown once to customer → owner submits PIN → timing-safe compare → status `verified`.
2. **No-show report**: Owner report → open incident → admin decision → financial outcome via existing refund/payout pipelines.
3. **Arrival problem**: Customer report → payout block → admin resolution → refund SSOT if owner fault.
4. **Owner cancel**: Reason code + optional note → refund SSOT + optional penalty adjustment (future settlement deduction).
