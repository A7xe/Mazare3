# Staging payment checklist — Mazare3 (Phase 6D)

Use this checklist **before** enabling live or sandbox payment traffic against a real bank/PSP. Default development remains `PAYMENT_PROVIDER=test`.

**Policy:** **Stripe is not used.** Card payments use generic `card_gateway`; set `CARD_GATEWAY_PROVIDER` only after choosing a Jordan PSP (e.g. HyperPay, MEPS, Tap).

See also: [payment-provider-decision.md](./payment-provider-decision.md), [payments-provider-readiness.md](./payments-provider-readiness.md).

---

## 0. Deliverables from bank / PSP (before staging cutover)

Collect written confirmation and credentials for the provider you are integrating. **No live integration in repo until these exist.**

### CliQ (bank / acquirer)

- [ ] **Merchant account** (or CliQ merchant profile) approved for the platform
- [ ] **Sandbox credentials** (API base URL, merchant alias, API key)
- [ ] **Webhook secret** + sample payloads / event types
- [ ] API docs for payment request / QR and status polling (if any)
- [ ] **Success / failure** handling notes (app deep link vs redirect)
- [ ] **Refund** process (API or manual) and timelines

### Card gateway (Jordan PSP — HyperPay / MEPS / Tap or equivalent)

- [ ] **Merchant account** approved (correct MCC, JOD settlement)
- [ ] **Sandbox credentials** (API base URL, merchant ID, API key)
- [ ] **Webhook secret** + signature algorithm and retry policy
- [ ] **Hosted checkout** documentation (redirect URL, session create, 3DS flow)
- [ ] Registered **success URL** and **failure URL** (customer browser return)
- [ ] **Refund API** documentation (partial/full, idempotency)
- [ ] Official **test card** numbers for success / decline / 3DS

**Not required:** Stripe account, Stripe keys, or Stripe webhook endpoints.

---

## 1. Environment variables

Set on the **API server** only (never `NEXT_PUBLIC_*` for secrets).

### Platform (required)

| Variable | Staging example | Notes |
|----------|-----------------|-------|
| `NODE_ENV` | `production` or staging env | Staging often uses `production` on host with sandbox URLs |
| `API_URL` | `https://api-staging.mazare3.example` | Public API base (no `/api/v1` suffix) |
| `FRONTEND_URL` | `https://staging.mazare3.example` | For CORS and return URLs |
| `CORS_ORIGIN` | Same as frontend | |
| `PAYMENT_PROVIDER` | `cliq` or `card_gateway` | **Not** `test` on staging that mimics prod |
| `PAYMENT_MODE` | `full` | Do not change |
| `PAYMENT_CURRENCY` | `JOD` | |
| `PLATFORM_COMMISSION_PERCENT` | `12` | Do not change without product sign-off |

### Must be OFF on staging that mimics production

| Variable | Required value |
|----------|----------------|
| `PAYMENT_SIMULATE_ENABLED` | `false` or unset |
| `DISABLE_AUTH_RATE_LIMIT` | `false` or unset |
| `ENABLE_INTERNAL_QA_ROUTES` | `false` or unset |

### CliQ (when `PAYMENT_PROVIDER=cliq`)

| Variable | Source |
|----------|--------|
| `CLIQ_MERCHANT_ALIAS` | Bank / acquirer |
| `CLIQ_API_BASE_URL` | Sandbox API URL |
| `CLIQ_API_KEY` | Sandbox API key |
| `CLIQ_WEBHOOK_SECRET` | Webhook HMAC secret |

### Card gateway (when `PAYMENT_PROVIDER=card_gateway`)

| Variable | Source |
|----------|--------|
| `CARD_GATEWAY_PROVIDER` | Generic slug once vendor chosen: `hyperpay` \| `meps` \| `tap` (not `stripe`) |
| `CARD_GATEWAY_API_BASE_URL` | Sandbox API URL from PSP |
| `CARD_GATEWAY_MERCHANT_ID` | PSP merchant ID |
| `CARD_GATEWAY_API_KEY` | Sandbox API key |
| `CARD_GATEWAY_WEBHOOK_SECRET` | Webhook signing secret |

### Next.js (public)

| Variable | Example |
|----------|---------|
| `NEXT_PUBLIC_API_URL` | `https://api-staging.mazare3.example/api/v1` |
| `NEXT_PUBLIC_APP_URL` | `https://staging.mazare3.example` |

---

## 2. Sandbox credentials & documentation pack

- [ ] **Merchant account** live with PSP/bank (production) or approved for sandbox-only testing.
- [ ] Obtain **sandbox** keys from bank (CliQ) or Jordan PSP (card) — never commit to git.
- [ ] Store in host secret manager / staging `.env` on server only.
- [ ] Confirm API base URL is **sandbox**, not production.
- [ ] File **hosted checkout** PDF/portal link from PSP (success/failure redirect parameters).
- [ ] File **refund** API section (endpoints, limits, settlement delay).
- [ ] Rotate keys if exposed; document rotation date.

---

## 3. URLs to register with provider

Replace hostnames with your staging domains.

| Purpose | URL pattern |
|---------|-------------|
| **Webhook** | `{API_URL}/api/v1/payments/webhooks/cliq` or `.../card_gateway` |
| **Public API** | `{API_URL}/api/v1` |
| **Success URL** (card hosted checkout) | Register with PSP — e.g. `{FRONTEND_URL}/{locale}/checkout/{bookingId}?payment=success` |
| **Failure URL** (card hosted checkout) | Register with PSP — e.g. `{FRONTEND_URL}/{locale}/checkout/{bookingId}?payment=failure` |
| **Return / callback** (CliQ or generic) | `{FRONTEND_URL}/{locale}/checkout/{bookingId}?payment=return` (exact path TBD in live phase) |
| **Health** | `{API_URL}/health` (for ops monitoring) |

**Requirements:**

- HTTPS with valid TLS certificate.
- Webhook endpoint reachable from bank/PSP IP ranges (no localhost).
- Firewall allows POST from provider.

---

## 4. Test instruments

### Card gateway (if applicable)

Obtain from PSP documentation. Typical patterns (examples only — use PSP’s official list):

| Scenario | Typical test PAN pattern |
|----------|---------------------------|
| Success | PSP-provided success card |
| Decline | PSP decline card |
| 3-D Secure | PSP 3DS challenge card |

**Do not** enter real customer cards in sandbox.

### CliQ (if applicable)

| Item | Notes |
|------|-------|
| Test merchant alias | From bank |
| Test QR / payment request | Sandbox app or test alias |
| Test failure | Bank docs for invalid/expired request |

---

## 5. Test scenarios

| Scenario | How to test | Expected |
|----------|-------------|----------|
| **Success** | Complete sandbox payment | `Payment.succeeded`, `Booking.confirmed`, slot booked |
| **Failure** | Decline / cancel at bank | `Payment.failed`, booking stays `pending_payment` or expires |
| **Expired** | Wait past hold or provider expiry | `Payment.expired`, slot available |
| **Duplicate webhook** | Replay same payload twice | Second delivery ignored; no double confirm |
| **Late webhook** | Pay, close browser, wait | Webhook still confirms; booking confirmed |
| **Redirect only** | Return URL hit without webhook yet | UI shows processing; poll payment until webhook |

---

## 6. Rollback to test provider

If staging integration fails or must be disabled:

1. Set `PAYMENT_PROVIDER=test` on API (and restart).
2. Set `PAYMENT_SIMULATE_ENABLED=true` **only** if `NODE_ENV` is not `production` (simulate is blocked in production).
3. Redeploy web with matching `NEXT_PUBLIC_API_URL`.
4. Verify `GET /api/v1/payments/config` shows `provider: test`.
5. Run `pnpm qa:api` locally against `:4012` (always uses test provider).

**Never** run `PAYMENT_PROVIDER=test` on a production host that accepts real customers — startup guard blocks this in `NODE_ENV=production`.

---

## 7. Incident playbooks

### Webhook arrived twice

1. Rely on **idempotent** handler: same `providerRef` + event type → no duplicate `finalizePaymentSuccess`.
2. Log second delivery as `webhook.duplicate_ignored` on `PaymentEvent`.
3. If booking already `confirmed`, return **200 OK** to provider (stop retries).

### Payment succeeded but redirect failed

1. Customer may see error page — **booking can still confirm via webhook**.
2. Show “Payment processing” on checkout; poll `GET /payments/:id` or booking status.
3. Support: look up payment by `providerRef` in admin payments.

### Redirect succeeded but webhook delayed

1. Do **not** confirm booking on redirect alone.
2. UI: processing state + poll every 2–5s (cap ~2 min), then “We’ll email you when confirmed”.
3. Ops: check provider dashboard; manually reconcile if webhook never arrives (provider support ticket).

### Webhook signature invalid

1. Return **401/403**; do not update DB.
2. Check `CLIQ_WEBHOOK_SECRET` / `CARD_GATEWAY_WEBHOOK_SECRET` matches provider dashboard.
3. Check raw body is used for HMAC (no JSON re-serialization).

### API won’t start in production

Startup validates provider config. Fix env per error message, or temporarily use non-production `NODE_ENV` only on a **private** staging host (not public prod).

---

## 8. Pre-go-live sign-off

- [ ] All items in sections 1–5 complete for chosen provider.
- [ ] Webhook signature verification implemented (live phase).
- [ ] No secrets in repository or client bundle.
- [ ] `pnpm qa:api` and `pnpm test:e2e` pass on `test` provider in CI.
- [ ] Staging sandbox E2E script (to be added in live phase) passes once.
- [ ] [payment-provider-decision.md](./payment-provider-decision.md) reviewed by product/ops.
- [ ] Rollback procedure tested (section 6).

---

## 9. Verification commands (test provider — CI/local)

```bash
pnpm typecheck
pnpm --filter @mazare3/api build
pnpm --filter @mazare3/web build
pnpm qa:api
pnpm test:e2e
```

Staging with live sandbox provider: run the same after pointing env to sandbox credentials (separate host recommended).
