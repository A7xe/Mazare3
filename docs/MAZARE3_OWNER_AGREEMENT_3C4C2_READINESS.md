# Mazare3 Owner Agreement — Phase 3C.4C.2 Readiness

**Corpus:** owner_agreement @ 1.1.0-advisor-revised (DRAFT)  
**Preserved:** 1.0.1-launch-candidate

## Publication blockers (must remain BLOCKED until resolved)

| Blocker | Reason |
|---------|--------|
| OWNER_AGREEMENT_NOT_FINALISED | DRAFT not counsel-activated |
| [[OWNER_SETTLEMENT_CYCLE]] | Contractual settlement cadence requires founder decision (code default must not silently become a false legal promise) |
| Tax / licence wording | COUNSEL_REVIEW_REQUIRED |
| Liability cap / formula | COUNSEL_REVIEW_REQUIRED |
| Indemnity enforceability | COUNSEL_REVIEW_REQUIRED |
| PSP payout rails | Counsel / PSP review markers remain |
| Production activation | Must not run with unresolved placeholders or without counsel + founder approvals |

## Technical wiring checklist

- [x] Active corpus version 1.1.0-advisor-revised
- [x] Historical 1.0.1-launch-candidate frozen
- [x] Soft reacceptance architecture unchanged (listings soft-gated; payouts accessible)
- [x] Custom commercial terms acceptance remains separate
- [x] No public Owner Agreement slug (in-app only)
- [x] Seed DRAFT-only script (no acceptances, production abort)
- [ ] Counsel approval
- [ ] Founder settlement-cycle decision filled into `[[OWNER_SETTLEMENT_CYCLE]]`
- [ ] Production activation (explicit later phase)

## Explicit non-actions completed this phase

- Locked Terms / Cancellation / Booking / Privacy not modified
- Financial SSOT / commission logic not modified
- Production not activated / not deployed
- No fabricated Owner acceptances
