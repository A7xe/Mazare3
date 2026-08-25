# Deployment checklist — Mazare3 Jordan (Phase 7A)

Use this before **staging** or **production** deploy. **No live CliQ / card gateway** is required for a trial staging host — see payment section below.

Related: [staging-deployment-plan.md](./staging-deployment-plan.md), [staging-manual-qa.md](./staging-manual-qa.md), [staging-payment-checklist.md](./staging-payment-checklist.md), [payment-provider-decision.md](./payment-provider-decision.md), [testing-stability.md](./testing-stability.md).

---

## 1. Pre-deploy commands

From repository root (Node 20+, pnpm 9+):

```bash
pnpm install
pnpm env:check                    # key names only — sync .env from .env.example first
pnpm --filter @mazare3/db migrate:deploy   # apply Prisma migrations to Neon
pnpm build                        # builds api + web (+ db generate via postinstall)
```

**Start (after build):**

```bash
# API (default port from API_PORT, usually 4000)
pnpm --filter @mazare3/api start

# Web (default 3000; set PORT on host if needed)
pnpm --filter @mazare3/web start
```

**Windows:** run `pnpm db:generate:safe` if `postinstall` / `db:generate` hits EPERM while dev servers are running ([testing-stability.md](./testing-stability.md)).

**Do not** run `pnpm db:seed` on production unless you intend demo data.

---

## 2. Environment files

| File | Purpose |
|------|---------|
| `.env.example` | Committed template — placeholders only |
| `.env` | Real secrets on each host — **never commit** |

Single root `.env` for API, Prisma, and Next.js (see `apps/api/src/env.ts`, `apps/web/next.config.ts`).

After changing `.env.example`: copy new keys into host `.env`, then `pnpm env:check`.

---

## 3. API environment variables

Set on the **API process** (server / container). Secrets must **not** use `NEXT_PUBLIC_`.

### Required (all environments)

| Variable | Notes |
|----------|--------|
| `APP_ENV` | `local` \| `staging` \| `production` — **security/payment guards** (not the same as `NODE_ENV`) |
| `DATABASE_URL` | Neon PostgreSQL connection string (`?sslmode=require`) |
| `JWT_SECRET` | Min 32 random characters |
| `SESSION_SECRET` | Optional fallback if `JWT_SECRET` unset; still use strong value |
| `JWT_EXPIRES_IN` | e.g. `7d` |
| `API_PORT` | e.g. `4000` |
| `API_URL` | Public API base, e.g. `https://api-staging.example.com` |
| `FRONTEND_URL` | Web origin, e.g. `https://staging.example.com` |
| `CORS_ORIGIN` | Same as frontend (comma-separated; **never** `*`) |
| `COOKIE_SECURE` | `false` (local) / `true` (staging HTTPS, production) — or unset for auto |
| `COOKIE_SAME_SITE` | Default `lax`; use `none` + `COOKIE_SECURE=true` only if web/API on unrelated domains |
| `COOKIE_DOMAIN` | Optional, e.g. `.yourdomain.com` for subdomains |
| `LOG_LEVEL` | e.g. `info` |

### `NODE_ENV` vs `APP_ENV`

| | `NODE_ENV` | `APP_ENV` |
|---|------------|-----------|
| Purpose | Node/Next build & optimization | Deployment target & **security guards** |
| Local dev | `development` | `local` |
| Hosted staging build | `production` | **`staging`** |
| Live production | `production` | **`production`** |

### Payments (staging without live PSP)

| Variable | Trial staging (`APP_ENV=staging`) | Production (`APP_ENV=production`) |
|----------|-----------------------------------|----------------------------------|
| `NODE_ENV` | `production` on host (normal build) | `production` |
| `APP_ENV` | **`staging`** | **`production`** |
| `PAYMENT_PROVIDER` | `test` | `cliq` or `card_gateway` (fully configured) |
| `PAYMENT_MODE` | `full` | `full` |
| `PAYMENT_CURRENCY` | `JOD` | `JOD` |
| `PLATFORM_COMMISSION_PERCENT` | `12` | `12` |
| `PAYMENT_SIMULATE_ENABLED` | `true` only for manual trial checkout on **non-production** API | **`false` or unset** |
| `CLIQ_*` / `CARD_GATEWAY_*` | Leave empty until contracted | All required for chosen provider |

**Stripe is not used.** Card path is generic `card_gateway` (HyperPay / MEPS / Tap later).

### Forbidden when `APP_ENV=production`

| Variable | Must be |
|----------|---------|
| `PAYMENT_PROVIDER=test` | **Not allowed** — API refuses to start |
| `PAYMENT_SIMULATE_ENABLED` | `false` or unset |
| `DISABLE_AUTH_RATE_LIMIT` | unset / `false` |
| `ENABLE_INTERNAL_QA_ROUTES` | unset / `false` |
| `PAYMENT_PROVIDER=cliq\|card_gateway` without full credentials | **Not allowed** — startup error |

**Trial staging without live payments:** `NODE_ENV=production`, **`APP_ENV=staging`**, `PAYMENT_PROVIDER=test`, `PAYMENT_SIMULATE_ENABLED=true`, `COOKIE_SECURE=true`. See [staging-deployment-plan.md](./staging-deployment-plan.md).

---

## 4. Web environment variables

Set for **Next.js build and runtime**. Only **public** URLs belong in `NEXT_PUBLIC_*`.

| Variable | Example |
|----------|---------|
| `NEXT_PUBLIC_APP_URL` | `https://staging.example.com` |
| `NEXT_PUBLIC_API_URL` | `https://api-staging.example.com/api/v1` |

**Never:** `NEXT_PUBLIC_DATABASE_URL`, `NEXT_PUBLIC_JWT_SECRET`, `NEXT_PUBLIC_CLIQ_API_KEY`, `NEXT_PUBLIC_CARD_GATEWAY_API_KEY`, or any payment secret.

---

## 5. Production guards (code — Phase 7B.1)

| Guard | Implementation |
|-------|----------------|
| Payment simulate disabled | `isDevPaymentSimulateAllowed()` → false when `APP_ENV=production` |
| Internal QA routes off | `isInternalQaRoutesEnabled()` → false when `APP_ENV=production` |
| Auth rate limit always on | `isAuthRateLimitDisabled()` → false when `APP_ENV=production` |
| `PAYMENT_PROVIDER=test` | Allowed only for `APP_ENV=local` and `APP_ENV=staging` |
| Provider misconfig fails startup | `validatePaymentProviderAtStartup()` when `APP_ENV=production` |
| CORS `*` blocked | Startup error if `CORS_ORIGIN` includes `*` (`app.ts`) |
| Unconfigured live provider | `createIntent` → `PROVIDER_NOT_CONFIGURED`; no silent fallback to test |

---

## 6. Security checklist

| Control | Status / notes |
|---------|----------------|
| **Helmet** | Enabled on API (`app.ts`) |
| **CORS** | `credentials: true`; explicit origins only — **no** `*` |
| **HttpOnly cookies** | JWT session cookie `httpOnly: true` |
| **Secure cookies** | `COOKIE_SECURE` or auto `true` for `APP_ENV=staging` / `production` |
| **SameSite** | `COOKIE_SAME_SITE` (default `lax`); `none` requires `COOKIE_SECURE=true` |
| **Rate limiting** | Auth routes: 30 req / 15 min per IP (`rate-limit.ts`) |
| **Stack traces** | 500 responses return generic message; no stack in JSON (`error-handler.ts`) |
| **Secrets in logs** | Do not log `DATABASE_URL`, JWT, or provider keys; audit metadata sanitized in admin flows |
| **Public PII** | Public property API omits `phone`, `whatsapp`, `exactAddress` (`public-property.mapper.ts`) |
| **RBAC** | Roles: `customer`, `owner`, `admin` only |
| **Trust proxy** | `app.set('trust proxy', 1)` for correct IP behind reverse proxy |

---

## 7. Staging deploy checklist

- [ ] Neon database created; `DATABASE_URL` in host secrets
- [ ] `pnpm env:check` passes on deploy machine / CI
- [ ] `migrate:deploy` run against staging DB
- [ ] `pnpm build` succeeds
- [ ] API health: `GET {API_URL}/api/v1/health`
- [ ] Web loads `/ar` and `/en`
- [ ] `CORS_ORIGIN` matches real frontend URL (HTTPS)
- [ ] Cookies work cross-origin (same-site or correct domain setup)
- [ ] Payment policy documented for ops (test vs live)
- [ ] Run [staging-manual-qa.md](./staging-manual-qa.md)
- [ ] No `ENABLE_INTERNAL_QA_ROUTES` or `DISABLE_AUTH_RATE_LIMIT` on staging if API uses `NODE_ENV=production`

---

## 8. Production deploy checklist (when live PSP exists)

- [ ] All staging items above
- [ ] `NODE_ENV=production` on API
- [ ] `PAYMENT_PROVIDER` = `cliq` or `card_gateway` with **all** provider env vars
- [ ] `PAYMENT_SIMULATE_ENABLED=false`
- [ ] Webhook URLs registered ([staging-payment-checklist.md](./staging-payment-checklist.md))
- [ ] TLS on API and web
- [ ] Demo seed **not** run on production DB (or remove demo passwords)
- [ ] Monitoring / `SENTRY_DSN` if used (optional, not in `.env.example`)

---

## 9. Rollback

1. Redeploy previous container/image or git tag.
2. If migration failed: restore Neon branch / backup before re-running `migrate:deploy`.
3. For payment issues: set host to maintenance; do not expose partial live checkout without webhooks.

---

## 10. QA levels (when to run what)

| Level | When | Commands |
|-------|------|----------|
| **1** | Docs, README, `.env.example`, copy-only UI | `pnpm env:check`, `typecheck`, builds |
| **2** | Single API area change | Level 1 + targeted `node scripts/qa-*-api.mjs` |
| **3** | Booking, payment, auth/RBAC, Prisma | `db:generate:safe`, `typecheck`, builds, `pnpm qa:api`, `pnpm test:e2e` |

Phase 7A documentation-only changes use **level 1**.
