# Mazare3 Owner Agreement — Phase 3C.4C.3 Diff (1.1.0 → 1.1.1)

**From:** 1.1.0-advisor-revised  
**To:** 1.1.1-advisor-final

## Structural

| Change | Detail |
|--------|--------|
| Added sections | 2. Definitions; 3. Related documents and precedence; 4. Eligibility and authority to list; 5. Onboarding and identity verification; 6. Platform verification (“Verified by Mazare3”); 7. Listing obligations; 8. Availability; 9. Listing media and content licence; 10. Location and access information; 11. Booking requests and Owner approval; 12. Customer payment model; 13. Commission and commercial terms; 14. Discounts and promotions; 15. Customer cancellation and Owner earnings; 16. Owner-caused cancellation; 17. Customer no-show; 18. Owner no-show and access denied; 19. Check-in evidence; 20. Rescheduling; 21. Force Majeure; 22. No double recovery; 23. Settlements and Owner payouts; 24. Financial adjustments; 25. Protection of due payouts; 26. Taxes, licences, and permits; 27. Property damage and insurance; 28. Reviews and reliability; 29. Customer Personal Data, confidentiality, and account security; 30. Suspension, exit, and termination; 31. Liability and indemnity; 32. Acceptance, commercial terms evidence, and updates; 33. Governing law, disputes, notices, and contact |
| Removed sections | 2. Eligibility and authority to list; 3. Onboarding and identity verification; 4. Platform verification (“Verified by Mazare3”); 5. Listing obligations; 6. Availability; 7. Listing media and content licence; 8. Location and access information; 9. Booking requests and Owner approval; 10. Customer payment model; 11. Commission and commercial terms; 12. Discounts and promotions; 13. Customer cancellation and Owner earnings; 14. Owner-caused cancellation; 15. Customer no-show; 16. Owner no-show and access denied; 17. Check-in evidence; 18. Rescheduling; 19. Force Majeure; 20. No double recovery; 21. Settlements and Owner payouts; 22. Financial adjustments; 23. Protection of due payouts; 24. Taxes, licences, and permits; 25. Property damage and insurance; 26. Reviews and reliability; 27. Customer Personal Data, confidentiality, and account security; 28. Suspension, exit, and termination; 29. Liability and indemnity; 30. Acceptance, commercial terms evidence, and updates; 31. Governing law, disputes, notices, and contact |
| Definitions | Added Commercial Booking Value / Captured Amount / Commission Snapshot / etc. |
| Precedence | Added related-documents hierarchy |
| Public cleanup | Removed DRAFT-for-counsel intro, HTML counsel comments, "counsel later", "current system/workflow" financial language |
| Commission basis | Clarified 18%/15% of Commercial Booking Value |
| Payment fees | Stated no separate PSP fee deduction from Owner Earnings; no open-ended fee right |
| Adjustments | Closed open-ended "other expressly documented" penalties; transparency + support review |
| Verification | Reason category + support review |
| Suspension | Cure principle for remediable breach |
| Exit | Removed unsupported Booking "transfer" |
| Media licence | Narrow service-provider processing on Mazare3's behalf |
| Privacy role | Explicit non-classification as processor/controller |
| Settlement | Material adverse cycle change notice/reacceptance; `[[OWNER_SETTLEMENT_CYCLE]]` kept |
| Arabic | Fixed acceptance-evidence wording; قيمة الحجز التجارية; مراجعة المحتوى; الانضمام |

## Product companion (same phase)

- Owner read-only `GET /owner/financial-adjustments` + payouts UI section
- Activation readiness blockers extended (fee treatment, liability, indemnity, data role, tax)

## Unchanged intentionally

- Locked Terms / Cancellation / Booking / Privacy corpora
- Financial SSOT rates and penalty math
- Soft reacceptance architecture (listings soft-gate; payouts accessible)
