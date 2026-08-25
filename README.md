# Mazare3 Jordan — مزارع الأردن

Premium bilingual marketplace for booking private recreational farms, chalets, and istirahat in Jordan.

> **Note:** "Farm / مزرعة" here means a private recreational property (chalet, villa, istiraha, pool house) — not an agricultural farm.

## Monorepo structure

```txt
apps/
  web/     Next.js App Router (frontend)
  api/     Express.js API (auth, properties)
packages/
  db/      Prisma schema + migrations + seed
  shared/  Types, Zod schemas, constants
```

## Requirements

- Node.js 20+
- pnpm 9+
- Neon PostgreSQL `DATABASE_URL`

## Local development

```bash
pnpm install
cp .env.example .env          # then edit secrets locally — never commit .env
pnpm env:check                # verify keys match template (names only)
pnpm db:generate:safe         # Windows: use if EPERM while dev is running
pnpm db:migrate               # applies migrations to Neon
pnpm db:seed                  # demo properties, slots, users (dev only)

pnpm dev                      # web :3000 + API :4000
```

- Web: http://localhost:3000/ar  
- API: http://localhost:4000/api/v1/health  

See [docs/deployment-checklist.md](docs/deployment-checklist.md) for staging/production.

### Environment (Phase 3B)

Local development uses **one file only**: `.env` at the repository root.

| Variable | Used by | Notes |
|----------|---------|--------|
| `APP_ENV` | API guards | `local` \| `staging` \| `production` — payment/security rules |
| `DATABASE_URL` | API, Prisma | Secret — never `NEXT_PUBLIC_` |
| `JWT_SECRET` | API auth | Min 32 chars |
| `API_PORT`, `CORS_ORIGIN` | API | |
| `DISABLE_AUTH_RATE_LIMIT` | API | **`true` only when `APP_ENV` ≠ production** (QA/E2E) |
| `ENABLE_INTERNAL_QA_ROUTES` | API | **`true` only when `APP_ENV` ≠ production** (`pnpm qa:api`) |
| `COOKIE_SECURE`, `COOKIE_SAME_SITE` | API auth cookie | Staging HTTPS: `COOKIE_SECURE=true` |
| `NEXT_PUBLIC_API_URL` | Next.js client | Public API base URL only |
| `NEXT_PUBLIC_APP_URL` | Next.js client | Public app URL |
| `NEXT_PUBLIC_MAP_TILE_URL` | Next.js client | Leaflet tile URL template (local default: OpenStreetMap) |
| `NEXT_PUBLIC_MAP_TILE_ATTRIBUTION` | Next.js client | Required map attribution HTML/text |
| `NEXT_PUBLIC_MAP_TILE_SUBDOMAINS` | Next.js client | Optional tile subdomains (OSM: `abc`) |

`apps/api/.env` and `apps/web/.env` are **not** required.

- **API / Prisma:** `dotenv-cli` loads `../../.env` in npm scripts; API `env.ts` also reads root `.env` on startup.
- **Web:** `next.config.ts` loads root `.env` with `override: false` so `next build` keeps `NODE_ENV=production` (root `NODE_ENV=development` is for local API/Prisma only).

Do **not** put `DATABASE_URL`, `JWT_SECRET`, or other secrets in `NEXT_PUBLIC_*` variables.

**`.env.example` vs `.env`**

- **`.env.example`** — committed template; safe placeholders only.
- **`.env`** — your real local file at the repo root; **never commit** to Git (see `.gitignore`).
- After any update to `.env.example`, sync missing keys into `.env` and run:

```bash
pnpm env:check
```

The script lists **key names only** (missing / extra / forbidden `NEXT_PUBLIC_*` secrets) — it never prints values.

- Web: http://localhost:3000/ar
- API health: http://localhost:4000/api/v1/health
- Properties: http://localhost:4000/api/v1/properties

### Demo accounts (after seed — dev only)

| Email | Role | Password |
|-------|------|----------|
| admin@mazare3.jo | admin | `Mazare3Demo2026!` |
| owner1@mazare3.jo | owner | `Mazare3Demo2026!` |
| customer@mazare3.jo | customer | `Mazare3Demo2026!` |

Public signup always creates **customer** only. Owner accounts are created via seed or future onboarding review.

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start web + API |
| `pnpm env:check` | Compare `.env` keys to `.env.example` (no values printed) |
| `pnpm typecheck` | TypeScript check |
| `pnpm db:migrate` | Run Prisma migrations (dev) |
| `pnpm --filter @mazare3/db migrate:deploy` | Apply migrations on staging/production |
| `pnpm db:seed` | Seed database |
| `pnpm build` | Build API + web for deploy |
| `pnpm --filter @mazare3/api start` | Run API after build |
| `pnpm --filter @mazare3/web start` | Run Next.js after build |
| `pnpm test:e2e` | Playwright E2E (booking flows; requires seed + dev servers) |
| `pnpm test:e2e:ui` | Playwright UI mode |
| `pnpm db:generate` | Generate Prisma client |
| `node scripts/qa-owner-api.mjs` | Phase 4A owner API QA |
| `node scripts/qa-admin-api.mjs` | Phase 5A admin API QA |
| `node scripts/qa-onboarding-api.mjs` | Phase 5B owner onboarding API QA |
| `node scripts/qa-payment-api.mjs` | Phase 6A payments API QA |
| `pnpm qa:api` | Run **all** API QA scripts on isolated `:4012` (recommended) |

### Prisma `db:generate` on Windows (EPERM)

If `pnpm db:generate` fails with **`EPERM: operation not permitted, rename ... query_engine-windows.dll.node`**, the Prisma query engine file is locked — usually because **`pnpm dev`** (API) or another Node process is still running.

**Recommended (preflight, does not kill processes):**

```bash
pnpm db:generate:check   # report ports / file lock only
pnpm db:generate:safe    # aborts with guidance if dev ports or DLL are locked
```

**Manual fix:**

1. Stop dev servers (`Ctrl+C` in the terminal running `pnpm dev` / Playwright).
2. Close DB Studio or any other tool using the Prisma client.
3. Run `pnpm db:generate` or `pnpm db:generate:safe` again.

This is a **Windows file lock**, not a schema or migration error. CI/Linux typically does not hit this. You can still run `typecheck`, `build`, and E2E while dev is running; only regenerate the client after stopping Node when EPERM appears.

### Phase 6B.2 — Test isolation (QA vs E2E)

| Runner | API port | Typical slot window (days from today) |
|--------|----------|----------------------------------------|
| `pnpm qa:api` | **4012** (isolated) | +1 … +30 |
| `pnpm test:e2e` | **4010** (Playwright) | +3 … +75 (staggered per test) |

- Seed creates availability for **90 days** so E2E can use a high window (+38 … +75) for the conflict test.
- E2E conflict test **cancels** the holding booking via API in `finally` so the slot is released.
- Optional fresh seed before E2E: `pnpm test:e2e:seed` or `E2E_SEED=1 pnpm test:e2e`.
- Playwright uses **1 retry** locally to absorb transient `ERR_NETWORK_IO_SUSPENDED` (browser/IO suspend).

## Staging deployment (Phase 7A)

Trial staging **without** a live payment provider:

1. Deploy API + web with HTTPS URLs in `.env`.
2. API: `NODE_ENV=production`, **`APP_ENV=staging`**, `PAYMENT_PROVIDER=test`, `PAYMENT_SIMULATE_ENABLED=true`, `COOKIE_SECURE=true`.
3. Run `pnpm --filter @mazare3/db migrate:deploy` then `pnpm build` then `start` scripts.
4. Manual QA: [docs/staging-manual-qa.md](docs/staging-manual-qa.md).

Full env/security checklist: [docs/deployment-checklist.md](docs/deployment-checklist.md).  
Dry run & hosting layout: [docs/staging-deployment-plan.md](docs/staging-deployment-plan.md).  
**Deploy staging (you run):** [docs/staging-deploy-runbook.md](docs/staging-deploy-runbook.md).

**Not ready for production checkout** until a real PSP is integrated. API with **`APP_ENV=production`** **refuses** `PAYMENT_PROVIDER=test`.

## Production notes

- `NODE_ENV=production`, **`APP_ENV=production`**; `PAYMENT_SIMULATE_ENABLED=false`; no internal QA or auth rate-limit bypass.
- Live payments: see [docs/payment-provider-decision.md](docs/payment-provider-decision.md) — **no Stripe**; Jordan PSP via `card_gateway` when ready.
- Do not seed demo passwords on production databases.

## QA verification levels

| Level | Use when | Commands |
|-------|----------|----------|
| **1** | Docs, README, `.env.example`, light UI copy | `pnpm env:check`, `typecheck`, `pnpm --filter @mazare3/api build`, `pnpm --filter @mazare3/web build` |
| **2** | Single API/dashboard area | Level 1 + one `node scripts/qa-*-api.mjs` |
| **3** | Booking, payment, auth/RBAC, Prisma schema/migrations | `db:generate:safe`, typecheck, builds, `pnpm qa:api`, `pnpm test:e2e` |

## API (v1)

| Method | Path | Auth |
|--------|------|------|
| GET | `/health` | Public |
| GET | `/properties` | Public — query: `q`, `area`, `minPrice`, `maxPrice`, `guests`, `propertyType`, `amenities`, `hasPool`, `verifiedOnly`, `sort` |
| GET | `/properties/:slug` | Public (no owner phone / exact address) |
| GET | `/properties/:slug/availability?from=&to=` | Public |
| POST | `/bookings` | Cookie + `customer` role |
| GET | `/me/bookings` | Cookie (own bookings only) |
| GET | `/me/bookings/:id` | Cookie |
| POST | `/me/bookings/:id/cancel` | Cookie (owner of booking only) |
| GET | `/owner/summary` | Cookie + `owner` or `admin` |
| GET | `/owner/properties` | Cookie + `owner` or `admin` |
| GET | `/owner/properties/:id` | Cookie + `owner` or `admin` (own properties only) |
| GET | `/owner/bookings` | Cookie + `owner` or `admin` |
| GET | `/owner/availability?propertyId=&from=&to=` | Cookie + `owner` or `admin` |
| PATCH | `/owner/availability/:slotId` | Cookie + `owner` or `admin` (`status`: available/blocked, `price`) |
| GET | `/admin/summary` | Cookie + `admin` |
| GET | `/admin/users`, `/admin/users/:id` | Cookie + `admin` |
| PATCH | `/admin/users/:id/status` | Cookie + `admin` (`active` / `suspended`) |
| GET | `/admin/owners` | Cookie + `admin` |
| GET | `/admin/properties`, `/admin/properties/:id` | Cookie + `admin` |
| PATCH | `/admin/properties/:id/status` | Cookie + `admin` |
| GET | `/admin/bookings` | Cookie + `admin` |
| GET | `/admin/availability?propertyId=&from=&to=` | Cookie + `admin` |
| PATCH | `/admin/availability/:slotId` | Cookie + `admin` |
| GET | `/admin/audit-logs` | Cookie + `admin` |
| POST | `/auth/signup` | Public → `customer` |
| POST | `/auth/login` | Public |
| POST | `/auth/logout` | Cookie |
| GET | `/auth/me` | Cookie |

## Roles

- `customer` — default signup
- `owner` — seed / approved onboarding only
- `admin` — single full-access role (seed only)

## Phase 3 — try booking (after seed)

1. `pnpm dev` — web `:3000`, API `:4000`
2. Open a property, e.g. `/ar/properties/chalet-emerald-dead-sea`
3. Pick a date with available periods (seed blocks some days)
4. Log in as `customer@mazare3.jo` / `Mazare3Demo2026!` if prompted
5. Complete booking → view `/ar/account/bookings`

Re-run seed after schema changes: `pnpm db:migrate && pnpm db:seed`

## Phase 4A — Owner dashboard

After seed, log in as **`owner1@mazare3.jo`** / `Mazare3Demo2026!` and open:

- `/ar/owner` — summary stats
- `/ar/owner/properties` — your listings
- `/ar/owner/availability` — block/unblock slots and edit prices (not booked slots)

API (cookie + `owner` or `admin` role): `GET/PATCH /api/v1/owner/*`

Owner API QA: `node scripts/qa-owner-api.mjs` (API on `:4000`)

## Phase 4B — Owner dashboard QA

- Header shows **لوحة المالك / Owner dashboard** when logged in as `owner` only.
- Light Playwright tests: `pnpm test:e2e` (includes `e2e/owner.spec.ts`).
- Browser smoke: `node scripts/qa-browser-smoke.mjs` (owner routes; redirects to login when guest).

## Phase 5B — Owner onboarding & property submission

- `/ar/become-owner` — benefits + application form (customers only; admin approval required).
- Approved owners: `/ar/owner/properties/new`, `/ar/owner/properties/[id]/edit` — draft → submit for review.
- Admin: `/ar/admin/owners` — approve / reject / suspend owners; `/ar/admin/properties/[id]` — publish / request changes.

API: `POST /owner/apply`, `GET /owner/application/me`, `POST/PATCH /owner/properties`, `POST .../submit-review`, `PATCH /admin/owners/:id/status`.

Run migration after pull: `pnpm db:migrate`

QA: `node scripts/qa-onboarding-api.mjs`

## Phase 5A — Admin dashboard

After seed, log in as **`admin@mazare3.jo`** / `Mazare3Demo2026!` and open:

- `/ar/admin` — platform summary + recent audit logs
- `/ar/admin/users` — user list, suspend/activate (not last admin)
- `/ar/admin/owners` — owner profiles (read-only stats)
- `/ar/admin/properties` — all properties + status changes
- `/ar/admin/bookings` — all bookings (read-only)
- `/ar/admin/availability` — view/edit slots (same rules as owner)
- `/ar/admin/audit-logs` — audit trail (sanitized metadata)

API (cookie + `admin` role only): `GET/PATCH /api/v1/admin/*`

Admin API QA: `node scripts/qa-admin-api.mjs` (API on `:4000` or `:4010`)

Header shows **لوحة الأدمن / Admin dashboard** for `admin` only. Customers and owners receive 403 on admin API routes.

## Phase 6A — Trial payments foundation

- Booking flow: `pending_payment` → `/checkout/[bookingId]` → trial simulate → `confirmed` + paid.
- No real CliQ/Visa; no card data stored.
- API: `POST/GET /api/v1/payments/*`, `GET /api/v1/admin/payments`.
- Simulate endpoints are **disabled in production** (`NODE_ENV=production`).

## Phase 6B — Payment provider readiness

Configuration and placeholders for CliQ / card gateway — **no live API calls**.

- Config: `apps/api/src/config/payment-config.ts`
- Providers: `test`, `cliq-payment-provider.ts`, `card-gateway-payment-provider.ts` (throw until configured)
- Public: `GET /api/v1/payments/config`
- Webhooks: `POST /api/v1/payments/webhooks/:provider` (`test` ack; `cliq`/`card_gateway` → 501)
- Docs: [docs/payments-provider-readiness.md](docs/payments-provider-readiness.md)

Env: see `.env.example` (`PAYMENT_PROVIDER`, `CLIQ_*`, `CARD_GATEWAY_*`).  
Simulate requires `PAYMENT_SIMULATE_ENABLED=true` (set automatically by `pnpm qa:api` and E2E).

## Before real payments (Phase 6D)

The platform currently runs on the **internal test provider only** (`PAYMENT_PROVIDER=test`). Checkout uses simulate success/failure in dev, QA, and E2E — **no real CliQ, Visa, or card gateway calls**.

**Live payments require:**

1. Bank/PSP **sandbox then production** credentials (see `.env.example`)
2. `PAYMENT_PROVIDER=cliq` or `card_gateway` with **all** provider env vars set
3. Webhook URL registered with the provider → `/api/v1/payments/webhooks/{provider}`
4. Implementation of provider adapters and webhook handlers (next phase — **not** included in 6D)

When **`APP_ENV=production`**, the API **refuses to start** if:

- `PAYMENT_PROVIDER=test`, or
- `PAYMENT_PROVIDER=cliq|card_gateway` without complete credentials, or
- `PAYMENT_SIMULATE_ENABLED=true` / internal QA flags are enabled

**`APP_ENV=staging`** allows `PAYMENT_PROVIDER=test` with `NODE_ENV=production` (hosted build).

Read before go-live:

- [docs/payment-provider-decision.md](docs/payment-provider-decision.md) — provider choice, webhooks, refunds/payouts
- [docs/staging-payment-checklist.md](docs/staging-payment-checklist.md) — staging env, URLs, test cards, incident playbooks

## Phase 6A.1 — QA hardening & payment expiry

### Auth rate limit vs QA

- Normal `pnpm dev` on `:4000`: login/signup rate limit **enabled** (30 requests / 15 min per IP).
- `pnpm qa:api`: starts a **separate** API on `:4012` with `DISABLE_AUTH_RATE_LIMIT=true` and `ENABLE_INTERNAL_QA_ROUTES=true`, then runs all QA scripts in order. Your dev server is unchanged.
- Playwright E2E (`pnpm test:e2e`): API on `:4010` with `DISABLE_AUTH_RATE_LIMIT=true` (see `playwright.config.ts`).

**Never set `DISABLE_AUTH_RATE_LIMIT` in production.**

### Run all API QA (no 429)

```bash
pnpm qa:api
```

Or individually against the QA server:

```bash
# terminal 1
API_PORT=4012 DISABLE_AUTH_RATE_LIMIT=true ENABLE_INTERNAL_QA_ROUTES=true pnpm dev:api

# terminal 2
API_BASE=http://localhost:4012/api/v1 node scripts/qa-booking-api.mjs
# ... owner, admin, onboarding, payment
```

### Payment expiry cleanup

- Lazy: `expirePaymentIfNeeded` on payment read / intent create.
- Batch (QA/dev): `POST /api/v1/internal/payments/expire-stale` when `ENABLE_INTERNAL_QA_ROUTES=true`.
- QA backdate: `POST /api/v1/internal/payments/:id/backdate-expiry` then expire-stale.
- Idempotent: succeeded/confirmed bookings are never changed.

### Cancellation policy (current)

- `pending_payment`: customer can cancel → slot returns `available`.
- Paid + `confirmed`: cancel blocked (`PAID_BOOKING_CANCEL`) with localized UI message.

## Phase 3E — Playwright E2E

Prerequisites: `pnpm db:seed`. Playwright starts API on **4010** and web on **3010** (isolated from `pnpm dev` on 3000/4000). Stop any process already bound to 3010/4010 if a previous E2E run was interrupted.

```bash
pnpm test:e2e        # headless
pnpm test:e2e:ui     # interactive debugger
```

Tests live in `e2e/` (booking flow, slot conflict, auth guard, English LTR smoke). Slots are picked dynamically from the availability API (not a fixed calendar date).

## Phase status

- **Phase 1:** UI foundation, design system
- **Phase 2:** DB, auth, RBAC foundation, real property API, audit logs
- **Phase 3:** Search filters, availability slots, booking core (no real payment)
- **Phase 3E:** Playwright E2E booking tests (`pnpm test:e2e`)
- **Phase 4A:** Owner dashboard + availability management (no payments)
- **Phase 4B:** Owner header link, E2E smoke, rate-limit skip for Playwright
- **Phase 6A:** Trial payment foundation (no real gateway)
- **Phase 6A.1:** `pnpm qa:api`, payment expiry cleanup, QA hardening
- **Phase 6B–6D:** Provider config, refunds/disputes/payouts, deployment decision docs (no live calls)
- **Phase 7A–7B.1:** Deployment checklists, `APP_ENV`, staging cookies/guards
- **Phase 7C:** Staging deploy runbook (Railway/Render + Vercel + Neon)
- **Next:** You deploy staging using runbook, then manual QA

See `PROJECT_BRIEF_CURSOR_MAZARE3_JORDAN.md` for the full roadmap.

**Docs:** [deployment-checklist.md](docs/deployment-checklist.md) · [staging-deploy-runbook.md](docs/staging-deploy-runbook.md) · [staging-deployment-plan.md](docs/staging-deployment-plan.md) · [staging-manual-qa.md](docs/staging-manual-qa.md) · [staging-payment-checklist.md](docs/staging-payment-checklist.md)
