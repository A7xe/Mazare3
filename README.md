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

## Quick start (Phase 2)

```bash
pnpm install

# Environment (root + api + web)
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local

# Edit DATABASE_URL and JWT_SECRET (min 32 chars) in .env and apps/api/.env

pnpm db:generate
pnpm db:migrate    # applies migrations to Neon
pnpm db:seed       # 10 properties + demo users

pnpm dev
```

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
| `pnpm db:generate` | Generate Prisma client |

## API (v1)

| Method | Path | Auth |
|--------|------|------|
| GET | `/health` | Public |
| GET | `/properties` | Public (safe fields only) |
| GET | `/properties/:slug` | Public |
| POST | `/auth/signup` | Public → `customer` |
| POST | `/auth/login` | Public |
| POST | `/auth/logout` | Cookie |
| GET | `/auth/me` | Cookie |

## Roles

- `customer` — default signup
- `owner` — seed / approved onboarding only
- `admin` — single full-access role (seed only)

## Phase status

- **Phase 1:** UI foundation, design system
- **Phase 2:** DB, auth, RBAC foundation, real property API, audit logs
- **Next:** Booking, payments, dashboards (Phase 3+)

See `PROJECT_BRIEF_CURSOR_MAZARE3_JORDAN.md` for the full roadmap.
# Mazare3
# Mazare3
# Mazare3
