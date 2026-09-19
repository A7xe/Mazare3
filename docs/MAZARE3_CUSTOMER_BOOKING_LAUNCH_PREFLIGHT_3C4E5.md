# Mazare3 — Customer Booking Launch Preflight (Phase 3C.4E.5)

**Command:** `pnpm preflight:customer-booking-launch`

**Mode:** READ ONLY. Composes existing preflights. No mutations. No secrets. No Customer PII.

## What it covers

| Check | Source |
|-------|--------|
| Booking slot conflicts / partial unique index | `preflight:booking-slot-integrity` |
| Regulatory bookability gate presence | `preflight:regulatory-gate` (summary) |
| Customer legal corpus + historical evidence | `preflight:customer-legal-acceptance` |
| First-payment / webhook integrity signals | `preflight:first-payment-integrity` |
| Multi-capture refund anomalies | `preflight:multi-capture-refunds` |
| Job backlog + config presence | `preflight:booking-payment-jobs` + `…-config` |
| Visit lifecycle / completion anomalies | `preflight:booking-visit-lifecycle` + `…successful-visit-completion` |
| Settlement cycle | Explicit `NOT_APPLICABLE` / Founder decision |

## Status meanings

| Status | Meaning |
|--------|---------|
| PASS | Safe for this area in the inspected environment |
| BLOCKED | Must resolve before Production launch |
| WARNING | Review / monitor; not necessarily code-incomplete |
| NOT_APPLICABLE | Out of Customer Booking product-code scope |

## Latest local/dev snapshot (2026-09-19)

| Area | Status | Blocker type |
|------|--------|--------------|
| booking_slot_integrity | PASS | — (0 active duplicates; index present) |
| regulatory_bookability_gate | PASS | — |
| customer_legal_corpus_architecture | PASS | — (placeholder ACTIVE locally) |
| customer_legal_activation_advisor_final | **BLOCKED** | LEGAL_ACTIVATION_BLOCKER |
| first_payment_integrity | PASS | — |
| multi_capture_refunds | PASS | — |
| booking_payment_jobs_backlog | PASS | — |
| production_scheduler_configuration | **BLOCKED** | PRODUCTION_CONFIGURATION_BLOCKER (`INTERNAL_JOB_SECRET` missing) |
| payment_provider_configuration | PASS* | *local keys present; Production live still Founder/Counsel |
| visit_lifecycle_and_completion | WARNING | LEGACY_DATA_REVIEW (27 past no-check-in) |
| owner_settlement_cycle | NOT_APPLICABLE | FOUNDER_DECISION |

**Overall:** BLOCKED  
**Product code verdict embedded:** COMPLETE  
**Production ready:** BLOCKED  
**Legal activation ready:** BLOCKED

## How to interpret

- **BLOCKED overall** with **COMPLETE product code** is expected until Production config + legal activation.
- Do not treat local `1.0.0-placeholder` ACTIVE documents as counsel-activated launch corpus.
- Re-run this preflight on Production **read-replicas / staging mirrors** before go-live (still mutation:false).
