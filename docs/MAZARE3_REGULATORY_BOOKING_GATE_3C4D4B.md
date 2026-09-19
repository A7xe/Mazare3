# Mazare3 — Regulatory Publication + NEW Paid Booking Gate (3C.4D.4B)

**Status:** Implemented (local/dev).  
**Production:** not enabled / not deployed.  
**Locked legal docs:** unchanged.

---

## Central evaluator

`evaluatePropertyBookability(propertyId, purpose)` in  
`apps/api/src/services/property-bookability.service.ts`

Purposes:

| Purpose | Requires published | Authority approved | Regulatory READY |
|---------|--------------------|--------------------|------------------|
| `publish` | No (FSM caller) | Yes | Yes |
| `new_booking` | Yes | Yes | Yes |
| `owner_accept` | Yes | Yes | Yes |
| `first_payment` | Yes | Yes | Yes |
| `public_display` | Yes | Yes | Yes |

**Never required:** `platform_verified`, payout profile, DRAFT Owner Agreement activation.

Helpers:

- `assertPropertyEligibleForPublish` → `PROPERTY_NOT_PUBLISHABLE` (+ internal blockers)
- `assertPropertyEligibleForNewPaidBooking` → `PROPERTY_NOT_BOOKABLE` (Customer-safe EN message)

Sync helper `isPropertyCurrentlyBookable` remains **published + owner.approved only** for legacy callers; NEW Booking paths use the async evaluator.

---

## Publication gate

`patchAdminPropertyStatus` → when target is `published` (not reason-refresh):

1. Existing media / listing completeness / availability generation  
2. **NEW:** `assertPropertyEligibleForPublish`

Frontend-only publish is impossible (admin API only).

---

## New Booking creation gate

`resolveBookingPricing` (quote + `createBooking`) calls  
`assertPropertyEligibleForNewPaidBooking(..., 'new_booking')`.

Customer error: generic unavailable (no licence / KYC / document details).

---

## Owner approval recheck

`acceptOwnerBooking` re-evaluates with purpose `owner_accept` before transitioning to `pending_payment`.

No charge, no Owner penalty if compliance changed during the pending window.

---

## First-payment / checkout recheck

`createPaymentIntent`:

- **deposit** / **full** → `assertPropertyEligibleForNewPaidBooking(..., 'first_payment')` before creating a **new** Payment row  
- **balance** → gate **skipped** (existing confirmed deposit Booking)  
- **reschedule_difference** → gate skipped (confirmed Booking)  
- **Reuse** of an already-active Payment / idempotent key → **allowed** even if Property later non-ready  

---

## Existing confirmed Booking treatment

- No auto-cancel  
- No auto-refund  
- No Owner Financial Adjustment / penalty from this gate  

Admin surface when Property non-ready and future confirmed Bookings exist:

`REGULATORY_REVIEW_AFFECTS_EXISTING_BOOKINGS`  
(via `getPropertyBookabilityAdminPackage` / regulatory admin package)

---

## Balance-payment exception

Confirmed Booking with deposit paid and remaining due may pay **balance** without re-passing Property regulatory READY.

Other Booking-level blocks (cancelled, expired, operations) still apply.

---

## Expiry behavior

Readiness evaluation reconciles expiry on read (3C.4D.4A).  
Bookability calls readiness at gate time → expired evidence blocks NEW Bookings immediately without waiting for cron.

---

## Reassessment behavior

`reassessmentRequired` on any requirement → bookability blocker `regulatory_reassessment_required`  
(and readiness ≠ `ready`).

---

## Authority integration

Authority must be `approved`.  
`not_submitted` / `under_review` / `action_required` / `rejected` / `reassessment_required` block publish and NEW Booking.

Authority remains a separate layer from regulatory readiness.

---

## Existing published Property behavior

- **No** mass-unpublish  
- Persisted `PropertyStatus` unchanged by this phase when readiness drops  
- NEW Bookings blocked  
- Republish blocked until READY + authority approved  
- Owner/Admin see action-required blockers  

---

## Public vs Owner vs Admin visibility

| Audience | Sees |
|----------|------|
| Customer | `canBook` / `bookingDisabled` + generic EN/AR unavailable copy |
| Owner | Internal blocker codes (authority/regulatory categories) — not admin legal notes |
| Admin | Full blockers, layers, affected future confirmed Bookings |

Public mappers do **not** expose regulatory evidence, KYC, or document numbers.

---

## PSP session / reconciliation edge case

1. Property READY → Payment session created  
2. Regulatory becomes blocked  
3. Customer returns / provider captures  

**Behavior:** existing active Payment may be **reused**; webhook / reconciliation still applies captured funds.  
Do **not** invent automatic refunds. Route anomalies to existing admin/reconciliation handling.

---

## Preflight

```bash
pnpm preflight:regulatory-gate
```

See `docs/MAZARE3_REGULATORY_GATE_PREFLIGHT_3C4D4B.md`.

---

## Production rollout notes

1. Run preflight on target DB (read-only)  
2. Review published-but-not-READY counts and future confirmed Bookings on non-ready Properties  
3. Do **not** mass-unpublish  
4. Enable gate only after operational readiness (this phase is local/dev)  
5. Keep commission / cancellation / refund economics unchanged  

---

## Suggested next phase

**3C.4D.5 / 3C.4D.6** — Property listing snapshot for Bookings; optional search visibility policy for published-but-not-bookable; granular regulatory RBAC; counsel policy for existing Bookings under later compliance failure.
