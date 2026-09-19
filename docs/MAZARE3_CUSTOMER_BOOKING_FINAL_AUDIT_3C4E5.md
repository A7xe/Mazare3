# Mazare3 — Customer Booking Final Audit (Phase 3C.4E.5)

**Mode:** AUDIT / PREFLIGHT ONLY — no product features, schema, migrations, financial policy, legal activation, or Production changes.

**Date:** 2026-09-19 (local/dev)

---

## Three mandatory verdicts

| Verdict | Result |
|---------|--------|
| **CUSTOMER_BOOKING_PRODUCT_CODE** | **COMPLETE** |
| **CUSTOMER_BOOKING_PRODUCTION_READY** | **BLOCKED** |
| **CUSTOMER_BOOKING_LEGAL_ACTIVATION_READY** | **BLOCKED** |

Product code for the Customer Booking journey is functionally complete in local/dev. Production launch remains blocked by configuration, migration rollout, scheduler wiring, and counsel-approved legal activation — not by unfinished Customer Booking business logic.

---

## 1. Final Customer journey (code-traced)

```
Property discovery / search
→ Property detail (bookability public reason only)
→ availability date/period (discrete AvailabilitySlot)
→ server quote (resolveBookingPricing)
→ Booking summary + legal ack (ACTIVE corpus IDs)
→ createBooking TX: Property FOR UPDATE + slot CAS + holding + LegalAcceptance + BookingLegalSnapshot + listing snapshot
→ inventory hold (pending_owner_approval | pending_payment)
→ Owner accept (60m, recheck bookability) OR expire/decline → release
→ payment-plan decision (>72h deposit|full; ≤72h full) with payment-time revalidation
→ PayTabs HPP → webhook/reconcile (return URL UX only)
→ confirmed
→ My Bookings (balance CTA when due)
→ balance by immutable balanceDueAt (= start − 48h)
→ exact location/access at eligible stage
→ check-in (verified)
→ complete-verified-visits / projection → visitOutcome completed
```

**Exception paths (implemented):** Customer cancel; BALANCE_NOT_PAID; Owner cancel; Customer no-show (admin finalize); Owner no-show / access denied; Force Majeure; reschedule; dispute; multi-capture refund.

---

## 2. Booking.status × BookingVisitOutcome

### Booking.status
`pending` (legacy) · `pending_owner_approval` · `pending_payment` · `confirmed` · `cancelled` · `expired`

### BookingVisitOutcome (orthogonal)
`pending_visit` (projection) · `checked_in` · `completed` · `customer_no_show` · `owner_no_show` · `access_denied` · `force_majeure` · `disputed` · `resolved_other`

### Valid / invalid notes

| Combination | Validity |
|-------------|----------|
| `confirmed` + `checked_in` / `completed` / `customer_no_show` | Valid (Customer no-show keeps confirmed) |
| `cancelled` + `owner_no_show` / `access_denied` / `force_majeure` | Valid |
| `pending_*` + terminal visit outcome | Invalid / should not persist |
| `confirmed` + no check-in + past end + null outcome | Valid but **reviewable** (not fabricated completed) |
| Successful visit | `Booking.status` stays `confirmed`; `visitOutcome=completed` |

**UX ambiguity residual:** past `confirmed` with no check-in/outcome stays under visit review (4B) — intentional, not fabricated success.

---

## 3–15. Area results (summary)

| Area | Code | Notes |
|------|------|-------|
| Availability / double-booking | COMPLETE | Discrete slot + FOR UPDATE + CAS + partial unique; local preflight **0** active duplicates |
| Regulatory bookability | COMPLETE | Fail-closed NEW Booking; `platform_verified` not required; balance not re-gated |
| Quote / financial SSOT | COMPLETE | Server-authoritative; client amounts non-authoritative |
| Deposit/full 72h | COMPLETE | Inclusive exact 72h = full; payment-time revalidation |
| Owner approval 60m | COMPLETE | Lazy + job expiry; accept rechecks bookability |
| Payment integrity | COMPLETE | Return UX-only; HMAC/amount/currency/purpose; idempotent webhooks |
| Balance / BALANCE_NOT_PAID | COMPLETE | Immutable `balanceDueAt`; retain captured only; slot release |
| Refunds (2A) | COMPLETE | Obligation + allocations; no double refund architecture |
| Customer cancel tiers | COMPLETE | 0/30/50/100; retained=min(captured, charge) |
| Owner cancel / FM | COMPLETE | Full eligible refund paths; FM election for reschedule |
| Legal acceptance 4A/4A.1 | COMPLETE | Atomic TX; ACTIVE-only; no DRAFT fallback |
| Visit / check-in / completion | COMPLETE | Evidence required; completion ≠ payout release |
| Reviews | COMPLETE | Requires positive visit evidence; blocks no-show/FM masquerade |

---

## 16–17. Legal activation (separate from architecture)

**Architecture:** READY for ACTIVE corpus.

**Activation:** **BLOCKED**

- Locked advisor-final bodies `1.1.2-advisor-final` (Terms / Cancellation / Booking Terms / Privacy) remain **DRAFT / inactive**.
- Local ACTIVE corpus is `1.0.0-placeholder` — **not** launch-ready counsel corpus.
- Do not treat placeholder as Production legal activation.

---

## 18–27. Disclosure, location, security, My Bookings

- Pre-payment disclosure: total / due now / deposit-full / balance due / cancel summary / Owner approval / legal links — present in 4A UX + QA.
- Exact location: gated; not on public Property for ineligible Bookings (prior phases).
- My Bookings: visitLifecycle projection distinguishes upcoming / checked-in / completed / terminal faults.
- Security: ownership-scoped Booking/payment/check-in/incident routes (IDOR covered by prior phase QAs).

---

## 28–30. Scheduler inventory

| Job | Classification |
|-----|----------------|
| expire-owner-approval-requests | **LAUNCH_CRITICAL** |
| expire-unpaid-booking-holds | **LAUNCH_CRITICAL** |
| auto-cancel-unpaid-balances | **LAUNCH_CRITICAL** |
| reconcile-pending-payments | **LAUNCH_CRITICAL** |
| reconcile-pending-refunds | REQUIRED_OPERATIONAL |
| expire-reschedule-requests | REQUIRED_OPERATIONAL |
| reconcile-regulatory-document-expiry | REQUIRED_OPERATIONAL |
| mark-visit-review-eligible | OPTIONAL / advisory |
| **complete-verified-visits** | **REQUIRED_OPERATIONAL** (not financial LAUNCH_CRITICAL; UX projection covers delay) |
| generate-due-settlement-cycles | Owner payout (Founder cycle) |
| maintain-availability-horizon | REQUIRED_OPERATIONAL |

**Recommended cadence for complete-verified-visits:** every ~10–15 minutes (after visit end windows).

**Production scheduler status (this env):** CLI + ops HTTP present; `INTERNAL_JOB_SECRET` **MISSING**; live external scheduler **NOT configured** → **PRODUCTION_CONFIGURATION_BLOCKER**.

---

## 31–32. Production migration matrix (do not apply)

Ordered Customer-Booking-hardening migrations still required on Production (inspect local folders; apply only after Production slot preflight = 0 duplicates):

1. `20260917120000_phase3c4d4a_regulatory_foundation` (+ related 4D authority/pool/snapshot/payout as already planned)
2. `20260917210000_phase3c4e2a_multi_capture_refund`
3. `20260917220000_phase3c4e3_booking_slot_integrity` — **require** `preflight:booking-slot-integrity` → 0 active duplicates before unique index
4. `20260919120000_phase3c4e4b_booking_visit_outcome`

Rollout note: take brief Booking write lock / maintenance window for partial unique index if any historical conflict risk; local currently clean.

---

## 33–34. Legacy / historical artifacts

| Item | Classification |
|------|----------------|
| 404 Bookings without legal snapshot | SAFE_LEGACY_LIMITATION / MANUAL_REVIEW_REQUIRED if Production has equivalent history |
| 28 complete snapshots missing acceptance (pre-4A.1 gap) | SAFE_LEGACY_LIMITATION (not backfilled; NEW Bookings atomic) |
| 27 past confirmed no check-in/outcome | SAFE_LEGACY_LIMITATION / LEGACY_DATA_REVIEW |
| 87 untimed holding Bookings | SAFE_LEGACY_LIMITATION |
| Local QA fixture Bookings | NOT_RELEVANT_TO_PRODUCTION |

---

## 35–36. Notifications / receipts

Missing push/email channels: **IMPORTANT_POLISH** if in-app My Bookings + balance CTA remain visible; not classified as PRODUCT_CODE_BLOCKER when in-app truth exists. Payment amounts/states visible on Booking/payment surfaces.

---

## 37–39. Provider / counsel / settlement

- PayTabs env keys present locally (values not printed); Production **live** mode + counsel identity still FOUNDER/COUNSEL.
- Counsel: activate advisor-final corpus; provider/privacy transfers as needed for launch.
- `[[OWNER_SETTLEMENT_CYCLE]]`: **FOUNDER_DECISION** — blocks **B. OWNER PAYOUT / COMMERCIAL LAUNCH**, not Customer Booking product-code completeness.

---

## 40. Launch preflight

`pnpm preflight:customer-booking-launch` → overall **BLOCKED** (legal activation + scheduler secret), product verdict COMPLETE.

---

## 41–42. Race / financial regressions

- 10-way same-slot: **1 success / 9 conflicts** (unique index enforced).
- Financial SSOT examples 200 JOD @ 18%/15%: Phase 1 QA **31/31**.
- Fairness / cancel / no-show / FM markers: Phase 2 QA **35/35**.

---

## Findings (no fixes in this phase)

### CRITICAL
None in Customer Booking **product code**.

### HIGH (launch blockers — non-code)
1. **LEGAL_ACTIVATION_BLOCKER** — advisor-final not ACTIVE; placeholder ACTIVE locally.
2. **PRODUCTION_CONFIGURATION_BLOCKER** — `INTERNAL_JOB_SECRET` missing; external scheduler not live.
3. **PRODUCTION_CONFIGURATION_BLOCKER** — Production migration rollout not performed (slot unique + visit + refunds + regulatory).

### MEDIUM
1. Regulatory gate QA **AA** failed: expects comment string `Existing PSP session: do not re-block`; code has reuse path with different comment — **QA marker drift**, not absence of reuse (`reusePaymentId` present). Classify OPTIONAL_POLISH for QA string.
2. Settlement mark-paid local fixture `PAYOUT_DESTINATION_REQUIRED` — Owner payout readiness, not Customer Booking flow.
3. **Marketplace `createDispute`** does not set `visitOutcome=disputed`, and public projection may omit open-dispute flag → Customer UX can still look “upcoming / in progress” while a dispute exists ([Audit booking journey code](3e0bcc5a-2471-4f69-9bb3-8f14fa703ced)).
4. **Owner cancel classified as Force Majeure** can set `FORCE_MAJEURE` reason **without** `visitOutcome=force_majeure` (admin FM refund path does set outcome) — label/outcome asymmetry ([Audit booking journey code](3e0bcc5a-2471-4f69-9bb3-8f14fa703ced)).
5. PayTabs **browser return-form HMAC helper** exists but has **no callers**; IPN HMAC remains authoritative ([Audit payments legal jobs](4de2100f-0016-4a2e-908a-761af7b0dc02)).
6. Reconciliation path may omit cart **purpose** args to shared capture validator (amount/currency/ref still validated) ([Audit payments legal jobs](4de2100f-0016-4a2e-908a-761af7b0dc02)).

### LOW
- Past no-check-in rows need operational review process.
- Notification channel completeness polish.
- `resolved_other` visit outcome is enum-only (no writer found) — dead UX branch.
- Dual legal surfaces (create-time corpus + optional checkout re-ack) — clarify product copy, not a security hole.
- Mapper `canCancel` vs confirmed-policy cancelability messaging inconsistency.
- Exact location may reveal from `deposit_paid` (not only `fully_paid`) — confirm product intent.
- `balanceDueAt` is immutable after first capture for the original plan, but **reschedule recomputes** from the new start (expected; document as current-slot truth).

---

## Subagent evidence (3C.4E.5)

Supporting deep traces (read-only):

- [Audit booking journey code](3e0bcc5a-2471-4f69-9bb3-8f14fa703ced) — happy/exception path map + status×outcome matrix + UX ambiguities  
- [Audit payments legal jobs](4de2100f-0016-4a2e-908a-761af7b0dc02) — payment/HMAC/jobs/legal activation  
- [Audit migrations and slots](0eb5c930-d2cd-4e07-aab8-14627651780a) — migration order + double-booking layers + `[[OWNER_SETTLEMENT_CYCLE]]` placeholder  

---

## Minimum steps before Production

1. Counsel-approve and **activate** advisor-final legal corpus (not placeholder).
2. Apply ordered migrations after Production `preflight:booking-slot-integrity` = 0 duplicates.
3. Configure `INTERNAL_JOB_SECRET` + external scheduler for LAUNCH_CRITICAL (+ operational) jobs including `complete-verified-visits`.
4. Confirm PayTabs **live** credentials, callback URLs, webhook secret (counsel/Founder).
5. Founder decide `[[OWNER_SETTLEMENT_CYCLE]]` before Owner payout commercial launch (parallel track).

---

## Confirmations

- No product/schema/policy fixed in this audit phase (preflight composer + docs + package script only).
- Locked advisor-final legal docs unchanged / inactive.
- No legal activation performed.
- Production untouched.
