# Phase 3C.2 — Payment Provider / PayTabs Legal Role Audit

**Status:** Technical audit only (not legal advice).  
**Rule:** Do not invent Merchant of Record, escrow, or PSP contracting entity names.  
**Related:** `docs/payment-provider-decision.md`, `apps/api/src/config/paytabs-config.ts`.

---

## Summary

| Topic | Finding |
|-------|---------|
| Configured brand / integration | **PayTabs** (Jordan regional base `secure-jordan.paytabs.com` when configured) |
| Contracting legal name in env | **MISSING** unless `LEGAL_PAYMENT_PROVIDER_LEGAL_NAME` is set — do **not** invent “PayTabs Inc” from the brand |
| Mazare3 stores full PAN / CVV | **No** — code and schema forbid PAN/CVV; vault stores provider **token** ciphertext + masked display / last4 only |
| Mazare3 stores payment metadata | **Yes** — amounts, currency, status, `providerRef`, purpose, financial splits, `PaymentEvent` rows |
| Checkout mode | **Hosted HPP** by default (`PAYTABS_CHECKOUT_MODE=hpp`); optional **managed_form** when explicitly configured with client key |
| Merchant of Record (MoR) | **UNKNOWN** — **REQUIRES PSP CONTRACT REVIEW** |
| Escrow / bank / payment institution claims | **Not supported** by code evidence — do not use these labels in legal copy |

---

## What the codebase proves

### Configuration

- PayTabs profile id, server key, return/callback URLs, regional base URL, test/live profile mode.
- Checkout mode: `hpp` (hosted payment page / redirect) default; `managed_form` optional.
- Saved-card charge modes are gated (`off` / `ecom_cvv_redirect` / `recurring_direct`) and do not establish MoR.

### Data Mazare3 stores

From `Payment` / `PaymentEvent` / `SavedPaymentMethod`:

- Amounts, currency, method, purpose, provider enum, status lifecycle  
- `providerRef` (PSP transaction reference)  
- Booking financial splits (commission, owner net, etc.)  
- Event log (`PaymentEvent.action`, status, metadata JSON)  
- Refund request amounts/status linked to payments  
- Saved methods: **encrypted provider token**, fingerprint, brand, masked display, last4, expiry — **never PAN/CVV** (schema comment: “token only; never PAN/CVV”)

### What Mazare3 does **not** store

- Full card Primary Account Number (PAN)  
- CVV / CVC  
- Raw cardholder authentication secrets beyond what the provider returns as token/metadata

### Checkout / refunds / webhooks (technical)

- Customer card entry is intended on PayTabs-hosted or managed surfaces as configured — not a Mazare3-owned card form that retains PAN.
- Refunds are initiated through the payment provider integration and tracked as `RefundRequest` + payment status — not as an internal escrow ledger.
- Callbacks / IPN verify provider signatures and update payment state using `providerRef`.

---

## What the codebase does **not** prove

| Claim | Status |
|-------|--------|
| Mazare3 is Merchant of Record | **UNKNOWN** — API behaviour alone cannot prove MoR |
| PayTabs is MoR | **UNKNOWN** — **REQUIRES PSP CONTRACT REVIEW** |
| Exact PayTabs Jordan contracting legal entity name | **MISSING** until contract / `LEGAL_PAYMENT_PROVIDER_LEGAL_NAME` |
| Mazare3 is escrow, bank, or licensed payment institution | **Not established** — avoid these terms |

---

## Neutral legal wording recommendation

Prefer factual, non-contractual role language until counsel + PSP contract confirm otherwise:

> Payments are processed through third-party payment service providers. Mazare3 records transaction information necessary to operate bookings, refunds, and settlements.

Avoid until verified:

- “Merchant of Record”  
- “escrow”  
- “bank” / “payment institution”  
- Invented PSP legal names (e.g. “PayTabs Inc”)

---

## Founder / counsel actions

1. Obtain PayTabs Jordan merchant agreement and confirm contracting party legal name → set `LEGAL_PAYMENT_PROVIDER_LEGAL_NAME`.  
2. Confirm MoR / payment facilitator / other role in writing with Jordanian counsel.  
3. Align Terms / Booking Terms / Privacy PSP wording with the confirmed role only.  
4. Keep activation readiness PSP status **FLAGGED** until (1)–(2) are done.

**REQUIRES PSP CONTRACT REVIEW** · **REQUIRES JORDANIAN LEGAL REVIEW**
