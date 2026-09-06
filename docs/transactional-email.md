# Transactional email (AUTH-3)

Mazare3 sends **password-reset** email through a single production-capable provider.

## Selected provider

**Resend** (`EMAIL_PROVIDER=resend`)

Why: cleanest existing adapter, smallest live implementation, API-key-only secrets, verified sender/domain model.

SMTP and SendGrid adapters remain **stubs** (env validation only — no live send).

## Required environment (production)

| Variable | Required | Notes |
|---|---|---|
| `EMAIL_PROVIDER` | yes | Must be `resend` for live recovery email |
| `RESEND_API_KEY` | yes | Server-only. Never `NEXT_PUBLIC_*` |
| `EMAIL_FROM` | yes | Must be a **provider-verified** sender |
| `EMAIL_FROM_NAME` | optional | Display name, e.g. `Mazare3 Jordan` |
| `EMAIL_TIMEOUT_MS` | optional | Default `10000` |
| `FRONTEND_URL` or `NEXT_PUBLIC_APP_URL` | yes | Trusted public origin for reset links |

Never commit real API keys. Placeholders only live in `.env.example`.

## Sender / domain verification

Resend (and any ESP) will reject unverified `EMAIL_FROM` addresses/domains.

Until the sender/domain is verified in the Resend dashboard (and DNS where required), production delivery will fail operationally. That is reported as **PROVIDER_CONFIGURATION_REQUIRED** — the application code can still be ready.

Do not invent or hardcode a Mazare3 sender address in source.

## Local / test behavior

- Default: `EMAIL_PROVIDER=none` — no network send; password recovery can still use gated `devResetLink` when QA flags are on.
- Deterministic E2E: `EMAIL_PROVIDER=memory` (non-production only) captures messages in-process.
  - `GET /api/v1/internal/email-outbox` (requires `ENABLE_INTERNAL_QA_ROUTES=true`)
  - `POST /api/v1/internal/email-outbox/clear`
- Optional manual smoke: set Resend credentials + a human-supplied `EMAIL_TEST_RECIPIENT`. The app never auto-mails that variable.

## Production behavior

- `EMAIL_PROVIDER=resend` with missing `RESEND_API_KEY` / `EMAIL_FROM` → **startup fails** on `APP_ENV=production`.
- `EMAIL_PROVIDER=smtp` or `sendgrid` on production → **startup fails** (not live-capable yet).
- `EMAIL_PROVIDER=memory` on production → **startup fails**.
- `EMAIL_PROVIDER=none` on production → starts with an explicit warning that password-recovery email is unavailable.

## Safe single test send

1. Configure Resend + verified `EMAIL_FROM` in local `.env` (not Git).
2. Confirm a designated test inbox you control.
3. Call Forgot Password for that account only (or create a throwaway local user).
4. Confirm the email arrives; do not paste tokens into tickets/chat.

## Delivery failure policy

1. Create hashed reset token.
2. Attempt provider send.
3. If provider **accepts** → token stays active until use / expiry / newer request.
4. If provider **skips** (`none` / incomplete config) → token stays (local gated link may apply).
5. If provider **rejects / network fails** → token is consumed; public Forgot response stays generic.

## Secrets

- All provider credentials are **API/server-only**.
- Web/browser never calls Resend/SMTP/SendGrid.
- Logs may include provider name, opaque provider message id, and masked recipient — never API keys, Authorization headers, reset tokens, or reset URLs.
