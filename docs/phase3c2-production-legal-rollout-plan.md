# Phase 3C.2 — Production Legal Rollout Plan

**Status:** DOCUMENT ONLY — do **not** execute against Production from this phase.  
**Safety:** LOCAL drafting and readiness only. No Production deploy, migrate, or legal activation.

Related: [phase3c1-launch-transition-plan.md](./phase3c1-launch-transition-plan.md), [phase3c2-existing-user-reacceptance-strategy.md](./phase3c2-existing-user-reacceptance-strategy.md), [phase3c2-payment-provider-legal-role-audit.md](./phase3c2-payment-provider-legal-role-audit.md).

---

## Future safe sequence (do not run now)

| Step | Action | Notes |
|------|--------|-------|
| 1 | Complete founder identity inputs | Fill `NEXT_PUBLIC_*` / `LEGAL_*` identity fields; no invented CR/tax/DPO/PSP names |
| 2 | Confirm PayTabs wording | After PSP contract review; set `LEGAL_PAYMENT_PROVIDER_LEGAL_NAME`; MoR still must not be invented |
| 3 | Jordanian legal counsel review | Review launch-candidate (or successor) corpus AR + EN |
| 4 | Apply counsel edits as **NEW** immutable candidate version if substantive | Never silently mutate ACTIVE/superseded content |
| 5 | Mark founder approval | `founderApprovalStatus = approved` with audited reason |
| 6 | Mark counsel approval | `legalReviewStatus = approved` or `approved_with_changes` with audited reason |
| 7 | Backup / verify Production DB | Operational prerequisite — out of band |
| 8 | Apply additive legal migrations | Only after Production change window is explicitly approved |
| 9 | Seed / import final approved release | New version rows; placeholders must be resolved or activation blocked |
| 10 | Run legal readiness guard | `assertProductionLegalReady()` + admin `/admin/legal/activation-readiness` |
| 11 | Activate final legal releases | Controlled admin publish only after guards pass |
| 12 | Supersede placeholders deliberately | Prior ACTIVE → superseded via publish path; no in-place rewrite |
| 13 | Enable registration clickwrap | Terms accept + Privacy ack separate; marketing optional |
| 14 | Enable booking acceptance | Booking Terms + Cancellation evidence at checkout |
| 15 | Enable owner agreement gate | Soft-gate new listings/contracts; do not lock payouts |
| 16 | Choose existing-user reacceptance rollout | See reacceptance strategy doc — soft gates preferred |
| 17 | Smoke test | Registration, checkout, owner gate, DSR, bilingual links |
| 18 | Audit first acceptance records | Verify hashes, contexts, no fabricated `user_explicit_acceptance` |

---

## Explicit non-goals of this document

- Production deploy  
- Production migrations  
- Production legal activation  
- Fabricating counsel or founder approval  
- Altering historical booking economics via new Terms  

Phase 3C.2 ends when the platform is **technically ready** for a later controlled activation, with founder/counsel gaps clearly exposed — not when Production is live with new legal text.
