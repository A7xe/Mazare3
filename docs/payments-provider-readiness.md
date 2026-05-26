# Payment provider readiness (Phase 6B)

Mazare3 uses a **provider abstraction** so CliQ and card gateways can be wired in Phase 6C without rewriting booking or checkout flows.

## Test provider vs live providers

| Mode | `PAYMENT_PROVIDER` | Behaviour |
|------|-------------------|-----------|
| **Trial / QA / E2E** | `test` | Internal test adapter; optional simulate buttons when `PAYMENT_SIMULATE_ENABLED=true` |
| **CliQ (future)** | `cliq` | Requires all `CLIQ_*` env vars; placeholder throws until Phase 6C |
| **Card gateway (future)** | `card_gateway` | Requires all `CARD_GATEWAY_*` env vars; placeholder throws until Phase 6C |

**No card numbers, CVV, or PAN are stored.** Amounts always come from the server booking/slot.

## Environment variables

See root `.env.example`. Secrets must **never** use `NEXT_PUBLIC_`.

### CliQ (Jordan)

Obtain from your bank / CliQ acquirer:

- `CLIQ_MERCHANT_ALIAS` — merchant / alias identifier
- `CLIQ_API_BASE_URL` — API base URL (sandbox vs production)
- `CLIQ_API_KEY` — API credential
- `CLIQ_WEBHOOK_SECRET` — HMAC secret for webhook verification

### Card gateway

Obtain from PSP (e.g. HyperPay, Stripe, local acquirer):

- `CARD_GATEWAY_PROVIDER` — PSP identifier
- `CARD_GATEWAY_API_BASE_URL`
- `CARD_GATEWAY_MERCHANT_ID`
- `CARD_GATEWAY_API_KEY`
- `CARD_GATEWAY_WEBHOOK_SECRET`

### Platform

- `PAYMENT_PROVIDER` — `test` | `cliq` | `card_gateway`
- `PAYMENT_CURRENCY` — default `JOD`
- `PAYMENT_SIMULATE_ENABLED` — `true` only in dev/QA (never production)

## Webhooks

`POST /api/v1/payments/webhooks/:provider`

- `test` — acknowledges payload (no payment state change)
- `cliq` / `card_gateway` — **501 Not Implemented** in Phase 6B
- Unknown provider — **400**

**TODO Phase 6C:** verify signature (`CLIQ_WEBHOOK_SECRET` / `CARD_GATEWAY_WEBHOOK_SECRET`) before updating `Payment` / `Booking`.

Webhooks are required in production so payments confirmed at the bank update booking status even if the user closes the browser.

## Testing the test provider

```bash
pnpm qa:api   # sets PAYMENT_PROVIDER=test, PAYMENT_SIMULATE_ENABLED=true on :4012
```

Or locally:

1. `PAYMENT_PROVIDER=test`
2. `PAYMENT_SIMULATE_ENABLED=true`
3. Book as customer → checkout → simulate success

## Production checklist (before go-live)

- [ ] `NODE_ENV=production`
- [ ] `PAYMENT_PROVIDER` set to `cliq` or `card_gateway` (not `test`)
- [ ] `PAYMENT_SIMULATE_ENABLED` unset or `false`
- [ ] `DISABLE_AUTH_RATE_LIMIT` unset
- [ ] `ENABLE_INTERNAL_QA_ROUTES` unset
- [ ] All provider credentials set in server env (not in git)
- [ ] Webhook URL registered with bank/PSP → `/api/v1/payments/webhooks/{provider}`
- [ ] Webhook signature verification implemented (Phase 6C)
- [ ] TLS/HTTPS on public API
- [ ] PCI: no card data touches Mazare3 servers (hosted fields / redirect)

## Phase 6C (next)

Implement live `createIntent`, redirect/QR flows, and webhook handlers inside:

- `cliq-payment-provider.ts`
- `card-gateway-payment-provider.ts`
