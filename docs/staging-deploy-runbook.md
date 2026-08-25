# Staging deploy runbook — Mazare3 (Phase 7C)

Step-by-step guide to deploy **trial staging** (test payment provider only). The agent does **not** deploy for you — follow this on your hosting accounts.

**Target config:**

```env
NODE_ENV=production
APP_ENV=staging
PAYMENT_PROVIDER=test
PAYMENT_SIMULATE_ENABLED=true
COOKIE_SECURE=true
```

No live CliQ, card gateway, or Stripe.

Related: [staging-deployment-plan.md](./staging-deployment-plan.md), [staging-manual-qa.md](./staging-manual-qa.md), [deployment-checklist.md](./deployment-checklist.md).

---

## 1. Architecture

| Component | Host (suggested) | URL example |
|-----------|------------------|-------------|
| **Neon** | neon.tech | `DATABASE_URL` only (no public URL) |
| **API** | Railway **or** Render | `https://api-staging.yourdomain.com` |
| **Web** | Vercel **or** Railway | `https://staging.yourdomain.com` |

**Recommended DNS:** same parent domain for web + API (e.g. `staging.*` + `api.staging.*`) so `COOKIE_SAME_SITE=lax` works.

---

## 2. Deploy order

```txt
1. Neon staging branch + DATABASE_URL
2. Run migrations (one-off, from your machine or CI)
3. Optional: seed staging once
4. Deploy API → smoke /health
5. Deploy Web (with NEXT_PUBLIC_* pointing at API) → smoke /ar
6. Manual QA checklist (§8)
```

---

## 3. Neon (staging database)

1. Create a **staging branch** (or separate Neon project) at [console.neon.tech](https://console.neon.tech).
2. Copy **connection string** → this becomes `DATABASE_URL` (never commit).
3. Ensure `?sslmode=require` is present.

**Migrate (from your laptop, repo root):**

```bash
# Set DATABASE_URL to Neon staging (PowerShell example — use your shell’s export syntax)
# $env:DATABASE_URL = "postgresql://..."

pnpm install
cd packages/db
npx prisma migrate deploy
cd ../..
```

Alternative (uses root `.env` if `DATABASE_URL` is staging there):

```bash
pnpm --filter @mazare3/db migrate:deploy
```

**Seed once (optional — demo users for QA):**

```bash
pnpm db:seed
```

Demo logins (after seed): `customer@mazare3.jo`, `owner1@mazare3.jo`, `admin@mazare3.jo` / `Mazare3Demo2026!`  
**Do not** run seed on future production DB.

---

## 4. API environment variables

Set in Railway / Render **Variables** (secrets). Do not commit values.

| Variable | Staging value | Required |
|----------|---------------|----------|
| `NODE_ENV` | `production` | Yes |
| `APP_ENV` | `staging` | Yes |
| `DATABASE_URL` | Neon staging connection string | Yes |
| `JWT_SECRET` | Random ≥32 chars | Yes |
| `SESSION_SECRET` | Random ≥32 chars | Yes |
| `JWT_EXPIRES_IN` | `7d` | Yes |
| `API_PORT` | Host port (see §5.1) | Yes on Railway/Render |
| `API_URL` | `https://api-staging.yourdomain.com` | Yes |
| `FRONTEND_URL` | `https://staging.yourdomain.com` | Yes |
| `CORS_ORIGIN` | Same as `FRONTEND_URL` (no trailing slash) | Yes |
| `COOKIE_SECURE` | `true` | Yes |
| `COOKIE_SAME_SITE` | `lax` | Yes |
| `COOKIE_DOMAIN` | `.yourdomain.com` | Optional (subdomains) |
| `LOG_LEVEL` | `info` | Optional |
| `PAYMENT_PROVIDER` | `test` | Yes |
| `PAYMENT_MODE` | `full` | Yes |
| `PAYMENT_CURRENCY` | `JOD` | Yes |
| `PLATFORM_COMMISSION_PERCENT` | `12` | Yes |
| `CUSTOMER_SERVICE_FEE_PERCENT` | `0` | Yes |
| `OWNER_PAYOUT_DELAY_HOURS` | `24` | Yes |
| `CANCELLATION_FREE_UNTIL_HOURS` | `72` | Yes |
| `CANCELLATION_PARTIAL_UNTIL_HOURS` | `24` | Yes |
| `CANCELLATION_PARTIAL_REFUND_PERCENT` | `50` | Yes |
| `LATE_CANCELLATION_REFUND_PERCENT` | `0` | Yes |
| `PAYMENT_SIMULATE_ENABLED` | `true` | Yes (checkout QA) |
| `CLIQ_*` | empty | Yes (leave blank) |
| `CARD_GATEWAY_*` | empty | Yes (leave blank) |

**Must be unset on staging:**

- `DISABLE_AUTH_RATE_LIMIT`
- `ENABLE_INTERNAL_QA_ROUTES`

---

## 5. API hosting commands

Monorepo root: repository root. Node **20+**, **pnpm 9**.

### 5.1 Railway (API)

| Setting | Value |
|---------|--------|
| Root directory | `/` (repo root) |
| Build command | `corepack enable && pnpm install && pnpm --filter @mazare3/api build` |
| Start command | `node apps/api/dist/index.js` |
| Watch paths | `apps/api/**`, `packages/**` |

**Port:** Railway sets `PORT`. Also set:

```env
API_PORT=${{PORT}}
```

(or map `API_PORT` to the same number Railway exposes)

**Custom domain:** `api-staging.yourdomain.com` → set `API_URL` to that HTTPS URL.

**Pre-deploy check (local):**

```bash
pnpm --filter @mazare3/api build
```

### 5.2 Render (API)

| Setting | Value |
|---------|--------|
| Environment | Node |
| Root directory | repo root |
| Build command | `corepack enable && pnpm install && pnpm --filter @mazare3/api build` |
| Start command | `node apps/api/dist/index.js` |

Set `API_PORT` to Render’s `PORT` (often automatic if you use `$PORT` in start — our app reads `API_PORT`; set `API_PORT=$PORT` in Render env).

**Health check path:** `/api/v1/health`

### 5.3 API smoke test (after deploy)

```bash
curl -sS https://api-staging.yourdomain.com/api/v1/health
```

Expected: JSON `200` (healthy). Check deploy logs for:

```txt
APP_ENV=staging
cookie secure=true sameSite=lax
```

If API crashes on start, see §9 (misconfigured `APP_ENV=production` with `PAYMENT_PROVIDER=test`).

---

## 6. Web environment variables

Set on **Vercel** or **Railway** (build-time for `NEXT_PUBLIC_*`).

| Variable | Staging value |
|----------|---------------|
| `NEXT_PUBLIC_APP_URL` | `https://staging.yourdomain.com` |
| `NEXT_PUBLIC_API_URL` | `https://api-staging.yourdomain.com/api/v1` |

No payment secrets in `NEXT_PUBLIC_*`.

---

## 7. Web hosting commands

### 7.1 Vercel (Web) — recommended for Next.js

| Setting | Value |
|---------|--------|
| Framework preset | Next.js |
| Root directory | `apps/web` |
| Install command | `cd ../.. && corepack enable && pnpm install` |
| Build command | `cd ../.. && pnpm --filter @mazare3/web build` |
| Output directory | (default `.next`) |

Add **Environment variables** in Vercel project settings for Production + Preview (staging).

**Domain:** `staging.yourdomain.com` → update `NEXT_PUBLIC_APP_URL`.

### 7.2 Railway (Web)

| Setting | Value |
|---------|--------|
| Root directory | repo root |
| Build | `corepack enable && pnpm install && pnpm --filter @mazare3/web build` |
| Start | `pnpm --filter @mazare3/web start` |
| `PORT` | Railway `PORT` (Next respects `PORT`) |

Set `NEXT_PUBLIC_*` before build.

### 7.3 Web smoke test (after deploy)

1. Open `https://staging.yourdomain.com/ar`
2. Browser devtools → Network: API calls go to `NEXT_PUBLIC_API_URL` host
3. No CORS errors on first load

---

## 8. Post-deploy manual QA checklist

Use after API + Web are live. Full detail: [staging-manual-qa.md](./staging-manual-qa.md).

| # | Check | Pass? |
|---|--------|-------|
| 1 | `GET /api/v1/health` | |
| 2 | `/ar` loads | |
| 3 | Signup + login + logout | |
| 4 | `/ar/search` | |
| 5 | Book slot → checkout | |
| 6 | Checkout **simulate success** (test provider) | |
| 7 | `/ar/account/bookings` shows confirmed booking | |
| 8 | Refund request on paid booking | |
| 9 | `/ar/become-owner` (customer) | |
| 10 | `/ar/owner` (owner after approval) | |
| 11 | `/ar/admin` (admin) | |
| 12 | Admin refunds / disputes / payouts pages | |
| 13 | Public property: **no** phone, WhatsApp, exactAddress | |

---

## 9. Troubleshooting

### Login fails / session not kept

| Symptom | Fix |
|---------|-----|
| Login succeeds but next request is guest | Cookie not sent cross-origin |
| API on `railway.app`, web on `vercel.app` | Set `COOKIE_SAME_SITE=none`, `COOKIE_SECURE=true`, redeploy API |
| Subdomains same domain | `COOKIE_SAME_SITE=lax`, optional `COOKIE_DOMAIN=.yourdomain.com` |
| Cookie missing Secure on HTTPS | `COOKIE_SECURE=true`, `APP_ENV=staging` |
| Wrong API URL in browser | Fix `NEXT_PUBLIC_API_URL`, **rebuild** web |

Test: DevTools → Application → Cookies → `mazare3_session` after login.

### CORS errors

| Symptom | Fix |
|---------|-----|
| Browser blocks API from web origin | Set `CORS_ORIGIN` **exactly** to web URL (scheme + host, no path) |
| Multiple frontends | `CORS_ORIGIN=https://a.com,https://b.com` |
| Used `*` | Not allowed — API rejects `*` at startup |

### Checkout simulate missing or 403

| Symptom | Fix |
|---------|-----|
| No simulate buttons | `PAYMENT_SIMULATE_ENABLED=true`, `APP_ENV=staging` (not `production`) |
| 403 Payment simulation not available | Same as above; redeploy API |
| `APP_ENV` missing | Defaults to `production` when `NODE_ENV=production` → **blocks test provider** — set `APP_ENV=staging` explicitly |

### API won’t start

| Log / error | Fix |
|-------------|-----|
| `PAYMENT_PROVIDER=test is not allowed when APP_ENV=production` | Set `APP_ENV=staging` |
| `JWT_SECRET ... required` | Set secrets ≥32 chars |
| Prisma connection | Check `DATABASE_URL`, Neon IP allowlist |

### Migrate failed

- Run `npx prisma migrate deploy` from `packages/db` with staging `DATABASE_URL`
- Never use `migrate dev` on staging (interactive)

---

## 10. Rollback

| Step | Action |
|------|--------|
| 1 | Redeploy previous **API** deployment in Railway/Render/Vercel |
| 2 | Redeploy previous **Web** deployment |
| 3 | If bad migration | Restore Neon branch / PITR; redeploy API |
| 4 | Maintenance | Point web to static “down” page if needed |

Keep previous image/git tag noted before first staging cutover.

---

## 11. Local preflight (before you deploy)

```bash
pnpm env:check
pnpm typecheck
pnpm --filter @mazare3/api build
pnpm --filter @mazare3/web build
```

Sync `.env` keys from `.env.example`; staging secrets only on host UI.

---

## 12. After staging is stable

1. Share staging URLs with team; run full [staging-manual-qa.md](./staging-manual-qa.md).
2. When bank/PSP ready: new env on **production** host — `APP_ENV=production`, real `PAYMENT_PROVIDER`, no simulate ([staging-payment-checklist.md](./staging-payment-checklist.md)).
3. Do **not** copy staging `DATABASE_URL` to production.

---

## Quick reference — commands

| Task | Command |
|------|---------|
| Env key audit | `pnpm env:check` |
| Build API | `pnpm --filter @mazare3/api build` |
| Build Web | `pnpm --filter @mazare3/web build` |
| Migrate staging DB | `cd packages/db && npx prisma migrate deploy` |
| Seed staging (once) | `pnpm db:seed` |
| API start (host) | `node apps/api/dist/index.js` |
| Web start (host) | `pnpm --filter @mazare3/web start` |
