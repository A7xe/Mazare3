# Phase 3C.2 — Existing User Reacceptance Strategy

**Status:** Recommendation only — **do not activate** Production reacceptance from this phase.  
**Principles:** Preserve historical booking legal/financial snapshots; never change past booking economics through new Terms; never lock owner payouts solely for pending reacceptance.

Related: [phase3c2-production-legal-rollout-plan.md](./phase3c2-production-legal-rollout-plan.md), Phase 3B reacceptance architecture.

---

## User classes

| Class | Who | Recommended approach |
|-------|-----|----------------------|
| **A** | Not logged in | No account action. Public legal pages show current corpus. Contractual gates apply at registration / checkout when they create an account or book. |
| **B** | Existing customer | **Soft gate** at checkout / book (and other new contractual customer actions). Allow browse, account, historical bookings, support. Record immutable acceptance when they explicitly accept. |
| **C** | Existing owner | **Soft gate** for **new listings** / new contractual marketplace activity (and material Owner Agreement updates). Allow login, historical bookings, payouts, settlement history, support. |
| **D** | Users with active future bookings | Soft gate for **new** bookings only. Existing future bookings remain governed by the **booking legal + financial snapshots** captured at booking time. Do not rewrite economics. |
| **E** | Owners with active future bookings | Soft gate for **new** listings / new availability commitments as counsel directs. Do **not** lock payouts, settlement views, or ability to fulfil existing bookings / support obligations. |

---

## Recommended non-destructive rollout

1. Publish counsel-approved ACTIVE corpus (new version; supersede prior).  
2. Set `requiresReacceptance` / `materialChange` per counsel for customer Terms/Privacy and Owner Agreement as applicable.  
3. Customers (B/D): soft gate at **checkout / book** — explicit acceptance of current required versions before new payment/booking contracts.  
4. Owners (C/E): soft gate on **new listings** (and analogous new contractual actions) until Owner Agreement (+ commercial terms if required) accepted.  
5. Preserve PartnerAgreementAcceptance bridge evidence where Phase 3B already defined it — do not fabricate `LegalAcceptance`.  
6. Optional informational banner on account home — not a hard lockout.  
7. Never auto-accept; never invent historical acceptances.

---

## Hard constraints

| Constraint | Rationale |
|------------|-----------|
| Never change historical booking economics via new Terms | Snapshots govern deposit/cancellation/commission rights for that booking |
| Never lock payouts for pending reacceptance | Owners must access earned money and settlement history |
| Soft gate customers at checkout/book | Blocks new contracts without trapping account access |
| Soft gate owners for new listings | Blocks new supply contracts without trapping operations on existing inventory obligations |
| Admin may not forge `user_explicit_acceptance` | Evidence integrity |

---

## What not to do in Phase 3C.2

- Force Production reacceptance now  
- Hard-lock accounts or payouts  
- Mutate past booking snapshots  
- Fabricate acceptance rows for “grandfathering”

**REQUIRES JORDANIAN LEGAL REVIEW** for final material-change / reacceptance flags on the Production corpus.
