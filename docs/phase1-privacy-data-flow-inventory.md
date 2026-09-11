# Phase 1 — Privacy data-flow inventory

Inventory of data categories touched by Phase 1 financial policy flows. **No Privacy Policy rewrite in this phase** — flags mismatches only.

## Categories in scope

| Category | Collected / stored | Used for | Retention notes | Policy mismatch flags |
| --- | --- | --- | --- | --- |
| Booking financial snapshot | `Booking.totalAmount`, `depositAmount`, `platformCommissionPercent`, `merchantBookingValue`, `customerPayableTotal`, `balanceDueAt` | Pricing, payout, cancellation settlement | Life of booking + settlement | Policy may not mention commission snapshot immutability |
| Payment captures | `Payment.amount`, `Payment.status`, provider refs | Deposit/balance/full collection, refunds | Per payment + audit | Provider refs — confirm PSP section covers PayTabs |
| Cancellation metadata | `Booking.cancellationReasonCode`, `Payment.cancellationRefundAmount`, `Payment.cancellationPenaltyAmount` | Customer cancel, balance auto-cancel | Booking lifecycle | **Gap:** auto-cancel `BALANCE_NOT_PAID` may not be described in public cancellation page pre-Phase-1 |
| Refund requests | `RefundRequest.*`, admin notes on PSP failure | Refund handoff after paid cancel | Until processed + audit | **Gap:** automatic system-created refunds may not be disclosed vs manual requests |
| Property verification | `Property.verificationStatus` | 15% commission tier, public badge | Until changed by admin | **Gap:** badge "Verified by Mazare3" is platform verification, not government — ensure marketing/legal do not imply government certification |
| Partner KYC | `PartnerVerificationProfile.verificationStatus` | Partner onboarding only | Partner account | **Correct separation:** KYC does not drive 15% commission (Phase 1 enforced) |
| Commercial terms | `PartnerCommercialTerms` | Commission override | Per terms version | Likely covered under partner agreement |
| Audit logs | `AuditLog` for verification, cancel, refund | Admin accountability | Operational retention | Confirm retention period in policy |
| Customer identity | `User.id`, email via refund/customerId | Refund routing | Account lifetime | Standard account data |

## Flow diagrams (high level)

1. **Booking create** → snapshot commission % + payment plan → stored on `Booking` (no retroactive change on later verification).
2. **Customer cancel (confirmed)** → settlement from merchant value + captured cap → `RefundRequest` if refund > 0 → optional PSP refund.
3. **Balance unpaid at due** → auto-cancel → retain deposit → no refund obligation.
4. **Admin verification** → `Property.verificationStatus` → affects **future** bookings only.

## Recommended follow-up (outside Phase 1)

- Update Privacy Policy / Terms to mention automatic refund obligations and balance auto-cancel.
- Clarify "Verified by Mazare3" vs government licensing in consumer-facing legal copy.
