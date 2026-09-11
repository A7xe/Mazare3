# Payment provider decision — Mazare3 Jordan (Phase 6D)

This document records the **technical decision** for moving from the internal **test** provider to **live** CliQ and/or card payments. It does **not** implement live integration.

Related: [payment-policy.md](./payment-policy.md), [refunds-disputes-payouts.md](./refunds-disputes-payouts.md), [staging-payment-checklist.md](./staging-payment-checklist.md), [payments-provider-readiness.md](./payments-provider-readiness.md).

---

## 0. Final provider policy (Phase 6D update)

| Topic | Decision |
|-------|----------|
| **Stripe** | **Not used** in this project — no Stripe SDK, env vars, or documentation path. Do not add Stripe as a card option. |
| **Card payments** | Via generic **`card_gateway`** adapter only (`PAYMENT_PROVIDER=card_gateway`). |
| **`CARD_GATEWAY_PROVIDER`** | Stays a **generic label** (env string) until a Jordan PSP is chosen and contracted. Examples under evaluation: **HyperPay**, **MEPS**, **Tap** — selection depends on **merchant account approval** and **sandbox credentials** availability. |
| **CliQ** | Remains a **separate** provider (`PAYMENT_PROVIDER=cliq`), independent of card gateway. |
| **Live integration** | **None yet** — placeholders and config only; no real HTTP to banks/PSPs. |

When a PSP is selected, set `CARD_GATEWAY_PROVIDER` to that vendor’s identifier (e.g. `hyperpay`, `meps`, `tap`) and implement provider-specific logic inside `card-gateway-payment-provider.ts` without renaming the platform abstraction.

---

## 1. Current payment state (as of Phase 6C.1)

| Area | Status |
|------|--------|
| Policy | Deposit + balance model; **18%** standard / **15%** platform-verified commission on booking total |
| Active provider | `PAYMENT_PROVIDER=test` — simulate success/failure in dev/QA/E2E only |
| CliQ / card adapters | **Placeholders** — `createIntent` throws `PROVIDER_NOT_CONFIGURED` |
| Webhooks | `test` ack only; `cliq` / `card_gateway` return **501** |
| Booking confirmation | `finalizePaymentSuccess` after simulate or (future) webhook |
| Refunds | Internal `RefundRequest` workflow — **no provider refund API** |
| Owner payout | Manual admin mark-paid — **no bank payout API** |
| Card storage | **None** — no PAN, CVV, or token storage in Mazare3 DB |

**Production guard (Phase 6D):** API **refuses to start** if `NODE_ENV=production` with `PAYMENT_PROVIDER=cliq|card_gateway` without full credentials, or with `PAYMENT_PROVIDER=test`.

---

## 2. What is missing before live payments

1. **Provider `createIntent`** — redirect URL, QR payload, or hosted session ID from bank/PSP.
2. **Webhook handlers** — verify HMAC signature, map provider event → `Payment` + `Booking` state (idempotent).
3. **Return / callback URLs** — customer browser return after CliQ app or 3-D Secure (status display only; **trust webhook** for confirmation).
4. **Staging credentials** — sandbox merchant, API keys, webhook secrets (see staging checklist).
5. **Operational runbook** — duplicate webhooks, late webhooks, redirect-without-webhook.
6. **Refund API** (later phase) — execute refund against provider when admin marks `RefundRequest` processed.
7. **Payout API** (later phase) — optional; may remain manual bank transfer with reference only.

---

## 3. Provider comparison

### 3.1 CliQ (Jordan instant payments)

| Pros | Cons |
|------|------|
| Very common in Jordan for P2P and merchant QR | Bank-specific onboarding; API docs vary by acquirer |
| Lower card-PCI surface if customer pays in banking app | Less familiar for international tourists paying by card |
| Good fit for mobile-first, local customers | Refund/chargeback flows must be confirmed per bank contract |

**Best for:** domestic customers, QR at checkout, lower PCI scope.

### 3.2 Card gateway (Visa/Mastercard via Jordan PSP — not Stripe)

Card checkout uses the **`card_gateway`** abstraction. The concrete PSP is chosen later from Jordan-suitable acquirers, for example:

| Candidate | Notes |
|-----------|--------|
| **HyperPay** | Common in MENA; hosted checkout; confirm sandbox + merchant onboarding |
| **MEPS** | Local Jordan network / acquirer path; contract and API pack from bank |
| **Tap** | Regional PSP; evaluate JOD settlement and Jordan merchant support |

**Stripe is out of scope** for Mazare3 — do not plan migrations, webhooks, or env keys for Stripe.

| Pros | Cons |
|------|------|
| Familiar for card holders | PCI-DSS scope if card data touches our stack (avoid — use **hosted checkout** only) |
| Jordan PSPs provide sandbox test cards | Higher fees; 3-D Secure / redirect complexity |
| Refund APIs (per PSP docs) | Chargebacks; provider lock-in until adapter is swappable |

**Best for:** tourists, corporate cards, users without CliQ.

**Selection criteria:** approved **merchant account**, **sandbox** access, **hosted payment page** docs, **webhook** + **refund** API clarity, JOD settlement, support SLA.

### 3.3 Both CliQ and card (recommended long-term)

| Approach | Description |
|----------|-------------|
| **Single `PAYMENT_PROVIDER` env** | Today: one active provider per deployment (`test` \| `cliq` \| `card_gateway`). |
| **Method at checkout** | Customer chooses **CliQ** or **Card** when both enabled (requires product + config extension in live phase). |
| **Phased rollout** | **Phase 1:** CliQ **or** card in staging/production. **Phase 2:** add second method without changing booking/refund/payout foundations. |

**Recommendation for Jordan marketplace:** plan for **both**, but **go live with CliQ first** if the bank contract is ready sooner; add card when PSP onboarding completes. Rationale: local payment culture, faster path for many farm/chalet customers, then card for coverage.

---

## 4. What we need from bank / PSP

### CliQ (from acquirer / bank)

- Sandbox and production **API base URLs**
- **Merchant alias** / merchant ID
- **API key** or OAuth client credentials
- **Webhook signing secret** and event catalog (success, failure, expired, refund if any)
- **Settlement currency** (JOD) and fee schedule
- **Refund** process (API vs manual) and timelines
- **SLA** for webhook delivery and support contacts
- Allowed **webhook URL** format (must be HTTPS public API)

### Card gateway (from chosen Jordan PSP — HyperPay / MEPS / Tap or equivalent)

Obtain **before** staging integration (see [staging-payment-checklist.md](./staging-payment-checklist.md)):

- **Merchant account** approved for marketplace / accommodation MCC
- **Sandbox credentials** (API base URL, merchant ID, API key)
- **Webhook secret** and event catalog
- **Hosted checkout** integration guide (redirect or iframe — no PAN on Mazare3 servers)
- **Success URL** and **failure URL** registration rules (browser return; confirmation still via webhook)
- **Refund API** documentation and settlement timelines
- **Test card numbers** for success / decline / 3DS
- PCI: target **SAQ A** with fully hosted checkout (card data never on our servers)

Set `CARD_GATEWAY_PROVIDER` to the vendor slug once contracted (e.g. `hyperpay`). Until then, leave empty and keep `PAYMENT_PROVIDER=test` for development.

### Legal / product (both)

- Merchant category code suitable for accommodation / venue booking
- Chargeback policy alignment with cancellation tiers
- Who holds customer funds during hold period (platform vs owner) — affects payout timing already modeled (+24h after booking day)

---

## 5. What we must NEVER store

| Never store | Why |
|-------------|-----|
| Full card number (PAN) | PCI |
| CVV / CVC | PCI — never log or persist |
| Magnetic stripe / track data | PCI |
| CliQ customer banking passwords | Not applicable |
| Provider API secrets in git | Use server env / secret manager only |
| Webhook secrets in `NEXT_PUBLIC_*` | Exposed to browser |
| Raw webhook bodies with PII in public logs | Minimize; log event IDs only |

**OK to store:** `providerRef`, payment status, amounts (already on `Payment`), last4 (if PSP returns it), payment method type (`cliq` \| `card`), idempotency keys.

---

## 6. Webhooks (target design)

```
Bank/PSP  --HTTPS POST-->  /api/v1/payments/webhooks/:provider
                              |
                              v
                    verify signature (CLIQ_* / CARD_* secret)
                              |
                              v
                    idempotency (providerRef + event type)
                              |
                              v
                    update Payment + Booking (transaction)
                              |
                              v
                    audit log (no card data in metadata)
```

**Rules:**

- Webhook is **source of truth** for `succeeded` / `failed` / `expired`.
- Browser redirect is **UX only** — show “processing” until webhook processed or poll `GET /payments/:id`.
- Reject replay: store processed event IDs or use provider idempotency key on `PaymentEvent`.
- Unknown signature → **401/403**, no state change.

**Current code:** `apps/api/src/services/payment-webhook.service.ts` — stubs only.

---

## 7. Booking confirmation flow

```
create booking (pending_payment)
    -> createPaymentIntent (provider adapter)
    -> customer pays at bank/PSP
    -> webhook OR (dev only) simulate-success
    -> finalizePaymentSuccess:
         Payment.status = succeeded
         Booking.status = confirmed
         slot = booked
         payoutAvailableAt computed
```

**Idempotency:** `finalizePaymentSuccess` must be safe if called twice (webhook retry).

**Current code:** `apps/api/src/services/payment.service.ts` — `finalizePaymentSuccess`, `createPaymentIntent`.

---

## 8. Refunds (later live phase)

Today: [refunds-disputes-payouts.md](./refunds-disputes-payouts.md) — admin approves `RefundRequest`; `refundStatus` on `Payment` is internal.

**Live phase:**

1. Admin sets `RefundRequest` → `approved` → `processed`.
2. Call provider **refund API** (amount ≤ `approvedAmount`, currency JOD).
3. Store `providerRefundRef`; set `Payment.refundStatus = processed`.
4. Optionally cancel booking / release slot per policy (already partially modeled).

**No automatic refund** without admin action (keeps control, matches marketplace ops).

---

## 9. Owner payout (later)

Today: admin **manual** `mark-paid` with `manualReference` — no bank API.

**Live phase options:**

- **A (recommended initially):** Keep manual bank transfer; platform uses provider settlement reports to reconcile.
- **B:** Payout API via PSP (rare for marketplaces in Jordan) — only if contract exists.

Payout blocking (refund/dispute open) **stays** — see `getBookingOperationsBlock` in API.

---

## 10. Codebase readiness assessment

### Ready today

| Layer | Files | Notes |
|-------|-------|-------|
| Provider interface | `payment-provider.interface.ts` | `createIntent` contract defined |
| Registry | `payment-provider.registry.ts` | Switches test / cliq / card |
| Config | `payment-config.ts` | Credentials detection, `livePaymentsEnabled` |
| Startup guard | `validate-payment-provider.ts` | Production misconfig fails fast |
| Payment service | `payment.service.ts` | Intent, finalize, expiry, simulate (dev) |
| Webhook route | `payment-webhooks.ts`, `payment-webhook.service.ts` | Route exists; handlers TODO |
| Policy / amounts | `payment-policy.service.ts` | Unchanged for live |
| Checkout UI | `checkout-view.tsx` | Uses config + simulate when allowed |
| Operations | refunds/disputes/payouts | Independent of provider choice |

### Files to change in live integration phase (not 6D)

| File | Change |
|------|--------|
| `cliq-payment-provider.ts` | Implement `createIntent`, optional `refund` |
| `card-gateway-payment-provider.ts` | Implement `createIntent`, optional `refund` |
| `payment-webhook.service.ts` | Signature verify + `handlePaymentWebhook` |
| `payment.service.ts` | Map provider redirect metadata; webhook-driven finalize |
| `payment-config.ts` | Maybe multi-provider flags (`CLIQ_ENABLED`, `CARD_ENABLED`) |
| `checkout-view.tsx` | Real redirect / QR display; hide simulate in prod |
| `packages/shared` | Types for checkout redirect payload if needed |
| `.env.example` | Staging/production examples |
| QA scripts | New live sandbox tests (no real prod charges) |

### Refactor needed before live?

| Item | Priority | Notes |
|------|----------|-------|
| Webhook idempotency table / dedup | **High** | Use `PaymentEvent` or new `WebhookDelivery` |
| Poll payment status endpoint | **Medium** | For redirect-without-webhook UX |
| Split `PAYMENT_PROVIDER` vs per-method | **Medium** | If offering CliQ + card simultaneously |
| `listAdminPayouts` N+1 queries | **Low** | Performance only |
| Prisma schema | **Low** | `providerRef` exists; optional `providerEventId` |

**Verdict:** Architecture is **ready for staged live integration** without large refactors. Main work is **adapter + webhook implementation** and **staging validation**.

---

## 11. Decision summary (for stakeholders)

| Question | Recommendation |
|----------|----------------|
| Stripe? | **No** — not adopted |
| Card PSP? | **Generic `card_gateway`**; vendor TBD (**HyperPay / MEPS / Tap**) after merchant + sandbox |
| Go live with what first? | **CliQ first** if bank ready; **card** as phase 2 |
| Long-term | **Both** methods at checkout (CliQ + card_gateway) |
| Test provider in production? | **Forbidden** (startup guard) |
| Confirm booking via | **Webhook** (redirect is cosmetic) |
| Refunds | **Admin-triggered** provider refund after internal approval |
| Payouts | **Manual** until treasury process defined |

---

## 12. Next phase (after 6D approval)

**Phase 6E (proposed) — Live integration (staging only):**

1. Implement CliQ sandbox `createIntent` + webhook.
2. Complete [staging-payment-checklist.md](./staging-payment-checklist.md).
3. QA against sandbox (no production keys in repo).
4. Card gateway sandbox in parallel or follow-on.
5. Production cutover only after checklist sign-off.

**No production live traffic until explicit sign-off.**
