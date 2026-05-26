# Test stability (Phase 6B.2)

## Prisma `db:generate` on Windows

| Command | Purpose |
|---------|---------|
| `pnpm db:generate:check` | List dev ports in use + whether `query_engine-windows.dll.node` is locked |
| `pnpm db:generate:safe` | Run generate only when checks pass |
| `pnpm db:generate` | Direct generate (fails with EPERM if `pnpm dev` is running) |

The safe scripts **do not** kill Node processes. Stop `pnpm dev` / Playwright manually first.

## QA API vs Playwright E2E

- **QA** (`pnpm qa:api`): API on port **4012**, scripts use availability roughly **+1 … +30** days.
- **E2E** (`pnpm test:e2e`): API on **4010**, tests use **staggered** windows (see `E2E_SLOT_WINDOWS` in `e2e/booking.spec.ts`).
- **Conflict test** uses **+38 … +75** and releases the slot via API cancel in `finally`.

After pulling Phase 6B.2, run **`pnpm db:seed` once** so slots exist for 90 days.

Optional: `pnpm test:e2e:seed` or `E2E_SEED=1 pnpm test:e2e`.

## Flaky E2E notes

- `net::ERR_NETWORK_IO_SUSPENDED` is usually browser/IO suspension (long runs, sleep, throttling) — Playwright **retries: 1** helps.
- Booking conflict flakiness was addressed with dedicated slot window + API cleanup + explicit `waitForResponse` / `domcontentloaded`.
