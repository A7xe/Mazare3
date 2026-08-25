# Staging deployment plan — Mazare3 (Phase 7B dry run)

**Purpose:** Practical dry run for trial staging **without** deploying to a host in this phase and **without** live CliQ/card payments.

Related: [staging-deploy-runbook.md](./staging-deploy-runbook.md) (Phase 7C — you deploy), [deployment-checklist.md](./deployment-checklist.md), [staging-manual-qa.md](./staging-manual-qa.md), [staging-payment-checklist.md](./staging-payment-checklist.md).

---

## 1. Architecture (recommended)

```txt
                    ┌─────────────────────────────────────┐
                    │  Neon PostgreSQL (managed)          │
                    │  DATABASE_URL — one branch per env    │
                    └──────────────────▲──────────────────┘
                                       │
┌──────────────────────┐     HTTPS      │      HTTPS     ┌──────────────────────┐
│  Web (Next.js 15)    │ ──────────────┼──────────────► │  API (Express)       │
│  staging.example.com │   cookies +   │                │  api.staging.example │
│                      │   CORS        │                │  .com                │
└──────────────────────┘               │                └──────────────────────┘
        ▲                              │                         ▲
        │ build-time                   │                         │
        │ NEXT_PUBLIC_*                └─────────────────────────┘
        │                              same .env keys on each host
   Vercel / Railway / Fly / Render
```

| Component | Where it runs | Notes |
|-----------|---------------|--------|
| **Neon** | [neon.tech](https://neon.tech) — stays external | Create **staging branch** or separate project; never share prod `DATABASE_URL` with local dev by accident |
| **API** | Node 20 container/service | Must expose HTTPS URL; `trust proxy` enabled in app |
| **Web** | Next.js standalone host | Build embeds `NEXT_PUBLIC_*` at build time |

**Stripe is not used.** Card path remains generic `card_gateway` when a Jordan PSP is chosen later.

---

## 2. Where to deploy (suggestions)

You can mix providers; below are common fits for this monorepo.

### Web app (`apps/web`)

| Platform | Pros | Config notes |
|----------|------|----------------|
| **Vercel** | Strong Next.js support | Root: repo root; framework preset Next; build `pnpm --filter @mazare3/web build`; output default |
| **Railway** | Same project as API possible | Dockerfile or Nixpacks; set `PORT` |
| **Cloudflare Pages** | Edge CDN | May need `@cloudflare/next-on-pages` — verify Next 15 compatibility before choosing |
| **Fly.io / Render** | Full control | `pnpm build` + `next start` |

### API (`apps/api`)

| Platform | Pros | Config notes |
|----------|------|----------------|
| **Railway** | Simple Node service + env UI | Start: `pnpm --filter @mazare3/api start`; health: `/api/v1/health` |
| **Render** | Free tier for trials | Web service, Node 20 |
| **Fly.io** | Global regions | Bind `API_PORT` internally |
| **Same VPS** | Cheapest single machine | nginx: web → :3000, api → :4000 |

### Database

| Platform | Role |
|----------|------|
| **Neon** | Only database — no app code |

**Dry run (local, no deploy):** run build/start commands below on your machine to verify artifacts; use Neon **staging** URL only in a local `.env.staging` copy (not committed).

---

## 3. Domain & cookie strategy (critical)

The API sets an **HttpOnly** session cookie on login (`mazare3_session`). The web client calls the API with `credentials: 'include'`.

| Setup | Cookie `SameSite=lax` | Works without code change? |
|-------|----------------------|----------------------------|
| `https://staging.example.com` + `https://api.staging.example.com` (same registrable domain) | Cross-subdomain often **same-site** | **Yes** — recommended |
| `https://app.vercel.app` + `https://api.railway.app` (unrelated domains) | Cross-site | **Likely broken** — cookie not sent on XHR |
| Single origin: `https://staging.example.com` + reverse proxy `/api` → API | Same origin | **Yes** — best UX |

**Trial staging (test payment):** use **`NODE_ENV=production`** + **`APP_ENV=staging`** + `PAYMENT_PROVIDER=test` + `PAYMENT_SIMULATE_ENABLED=true` + **`COOKIE_SECURE=true`**. Secure cookies work on HTTPS without faking `NODE_ENV=development`.

**If web and API must live on unrelated domains:** set `COOKIE_SAME_SITE=none` and `COOKIE_SECURE=true` (and optional `COOKIE_DOMAIN`). Documented in `.env.example`; test login immediately after deploy.

**Never** use `CORS_ORIGIN=*` — the API rejects it when credentials are enabled.

**CORS:** set `CORS_ORIGIN` (and `FRONTEND_URL`) to the **exact** web origin, e.g. `https://staging.mazare3.jo` (no trailing slash). Multiple origins: comma-separated list (supported in `app.ts`).

---

## 4. Environment variables per service

Use host secret UI — **never** commit real values. Copy keys from `.env.example`; run `pnpm env:check` locally after editing template.

### API service

| Variable | Staging trial (no live PSP) |
|----------|----------------------------|
| `NODE_ENV` | `production` |
| `APP_ENV` | **`staging`** |
| `COOKIE_SECURE` | `true` |
| `COOKIE_SAME_SITE` | `lax` (or `none` if cross-site — see §3) |
| `DATABASE_URL` | Neon staging connection string |
| `JWT_SECRET` | Random ≥32 chars |
| `SESSION_SECRET` | Random ≥32 chars (optional if JWT set) |
| `JWT_EXPIRES_IN` | `7d` |
| `API_PORT` | Host port (e.g. `4000`) |
| `API_URL` | `https://api.staging.yourdomain.com` |
| `FRONTEND_URL` | `https://staging.yourdomain.com` |
| `CORS_ORIGIN` | Same as `FRONTEND_URL` |
| `LOG_LEVEL` | `info` |
| `PAYMENT_PROVIDER` | `test` |
| `PAYMENT_MODE` | `full` |
| `PAYMENT_CURRENCY` | `JOD` |
| `PLATFORM_COMMISSION_PERCENT` | `12` |
| `PAYMENT_SIMULATE_ENABLED` | `true` (optional — enables checkout simulate buttons) |
| `CLIQ_*` / `CARD_GATEWAY_*` | Empty |
| **Must be unset** | `DISABLE_AUTH_RATE_LIMIT`, `ENABLE_INTERNAL_QA_ROUTES` |

### Web service (build + runtime)

| Variable | Staging |
|----------|---------|
| `NEXT_PUBLIC_APP_URL` | `https://staging.yourdomain.com` |
| `NEXT_PUBLIC_API_URL` | `https://api.staging.yourdomain.com/api/v1` |

Do **not** set payment secrets as `NEXT_PUBLIC_*`.

### Neon

| Item | Action |
|------|--------|
| Branch | `staging` branch or separate project |
| `DATABASE_URL` | API + migrate only |
| Seed | Run once for demo QA users — **not** on future production DB |

---

## 5. Dry-run commands (run locally before first deploy)

From repository root, with `.env` pointing at **staging Neon** (optional dry run):

```bash
pnpm install
pnpm env:check
pnpm --filter @mazare3/db migrate:deploy
pnpm build
```

**Verify API artifact:**

```bash
pnpm --filter @mazare3/api start
# curl https://localhost:4000/api/v1/health   # or http if local
```

**Verify Web artifact:**

```bash
pnpm --filter @mazare3/web start
# open http://localhost:3000/ar
```

Stop processes after smoke. This validates build/start only — not production hosting.

---

## 6. Deploy sequence (when you approve go-live)

1. Create Neon staging DB; copy `DATABASE_URL` to API secrets.
2. Set all API env vars (section 4).
3. Run migrations from CI or one-off job:

   ```bash
   pnpm --filter @mazare3/db migrate:deploy
   ```

4. (Optional) Seed staging demo data **once**:

   ```bash
   pnpm db:seed
   ```

5. Deploy **API**; confirm `GET /api/v1/health` returns 200 over HTTPS.
6. Set `NEXT_PUBLIC_*` on web host; **build** web (vars baked at build).
7. Deploy **web**; open `/ar`.
8. Run [staging-manual-qa.md](./staging-manual-qa.md) section **0** then full checklist.

---

## 7. Post-deploy checklist (summary)

- [ ] `GET {API_URL}/api/v1/health` → 200
- [ ] Web `/ar` loads; `NEXT_PUBLIC_API_URL` correct
- [ ] Login sets cookie; `GET /auth/me` works from browser
- [ ] CORS: no browser error on API calls from web origin
- [ ] Booking + checkout simulate (test provider)
- [ ] Public property: no phone / WhatsApp / exactAddress
- [ ] Admin + owner routes RBAC smoke
- [ ] No `PAYMENT_SIMULATE` on any host with `NODE_ENV=production` until PSP live

---

## 8. Rollback plan

| Failure | Action |
|---------|--------|
| Bad deploy | Redeploy previous API/web image or git tag |
| Bad migration | Restore Neon branch backup / point-in-time; fix migration; redeploy |
| Auth broken (CORS/cookie) | Fix `CORS_ORIGIN` / domain layout; redeploy API only |
| Payment misconfig | Set maintenance page on web; API stays on `test` until PSP ready |

Keep previous container image and known-good `DATABASE_URL` branch snapshot before first staging cutover.

---

## 9. Package scripts reference (unchanged in 7B)

| Task | Command |
|------|---------|
| Env key audit | `pnpm env:check` |
| Typecheck | `pnpm typecheck` |
| Build all | `pnpm build` |
| API build | `pnpm --filter @mazare3/api build` |
| Web build | `pnpm --filter @mazare3/web build` |
| API start | `pnpm --filter @mazare3/api start` |
| Web start | `pnpm --filter @mazare3/web start` |
| Migrate deploy | `pnpm --filter @mazare3/db migrate:deploy` |
| Seed (staging only) | `pnpm db:seed` |

---

## 10. What this phase did **not** do

- No deploy to Vercel/Railway/Neon from CI
- No live CliQ, card gateway, or Stripe
- No application code changes (CORS/cookie behavior documented as-is)

**Next after your review:** create staging Neon branch, configure host env, run migrate + deploy, execute manual QA.
