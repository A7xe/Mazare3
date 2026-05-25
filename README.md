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

## Quick start

```bash
pnpm install

# Single local env file at repo root (see .env.example)
cp .env.example .env
# Edit DATABASE_URL and JWT_SECRET (min 32 chars), and NEXT_PUBLIC_* URLs

pnpm db:generate
pnpm db:migrate    # applies migrations to Neon
pnpm db:seed       # 10 properties + availability slots + demo users

pnpm dev
```

### Environment (Phase 3B)

Local development uses **one file only**: `.env` at the repository root.

| Variable | Used by | Notes |
|----------|---------|--------|
| `DATABASE_URL` | API, Prisma | Secret — never `NEXT_PUBLIC_` |
| `JWT_SECRET` | API auth | Min 32 chars |
| `API_PORT`, `CORS_ORIGIN` | API | |
| `NEXT_PUBLIC_API_URL` | Next.js client | Public API base URL only |
| `NEXT_PUBLIC_APP_URL` | Next.js client | Public app URL |

`apps/api/.env` and `apps/web/.env` are **not** required.

- **API / Prisma:** `dotenv-cli` loads `../../.env` in npm scripts; API `env.ts` also reads root `.env` on startup.
- **Web:** `next.config.ts` loads root `.env` with `override: false` so `next build` keeps `NODE_ENV=production` (root `NODE_ENV=development` is for local API/Prisma only).

Do **not** put `DATABASE_URL`, `JWT_SECRET`, or other secrets in `NEXT_PUBLIC_*` variables.

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
| `pnpm typecheck` | TypeScript check |
| `pnpm db:migrate` | Run Prisma migrations |
| `pnpm db:seed` | Seed database |
| `pnpm test:e2e` | Playwright E2E (booking flows; requires seed + dev servers) |
| `pnpm test:e2e:ui` | Playwright UI mode |
| `pnpm db:generate` | Generate Prisma client |
| `node scripts/qa-owner-api.mjs` | Phase 4A owner API QA |

### Prisma `db:generate` on Windows (EPERM)

If `pnpm db:generate` fails with **`EPERM: operation not permitted, rename ... query_engine-windows.dll.node`**, the Prisma query engine file is locked — usually because **`pnpm dev`** (API) or another Node process is still running.

**Fix:**

1. Stop dev servers (`Ctrl+C` in the terminal running `pnpm dev`).
2. Close DB Studio or any other tool using the Prisma client.
3. Run `pnpm db:generate` again.

This is a **Windows file lock**, not a schema or migration error. CI/Linux typically does not hit this. You can still run `typecheck`, `build`, and E2E while dev is running; only regenerate the client after stopping Node when EPERM appears.

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

- Header shows **لوحة المالك / Owner dashboard** when logged in as `owner` or `admin`.
- Light Playwright tests: `pnpm test:e2e` (includes `e2e/owner.spec.ts`).
- Browser smoke: `node scripts/qa-browser-smoke.mjs` (owner routes; redirects to login when guest).

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
- **Next:** Payments (Visa/CliQ), owner/admin dashboards

See `PROJECT_BRIEF_CURSOR_MAZARE3_JORDAN.md` for the full roadmap.
# Mazare3
# Mazare3
# Mazare3
