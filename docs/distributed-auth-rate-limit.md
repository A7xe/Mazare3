# Distributed auth IP rate limiting (AUTH-5)

Mazare3 authentication IP rate limits are enforced through a **Postgres-backed**
`express-rate-limit` Store so multiple API instances share the same counters.

## Shared store

- Table: `RateLimitBucket`
- Key: HMAC-SHA256 of canonical client IP (`auth-ip-rate:v1:…`) — raw IP is not stored
- Namespaces:
  - `auth-general` — Login/Signup/auth router (30 / 15 min)
  - `auth-forgot-password` — 5 / 15 min
  - `auth-reset-password` — 10 / 15 min
- Window: **fixed window** (library default semantics via `resetAt`)
- Atomic upsert increments (no lost updates across instances)

Identifier-aware Login protection (AUTH-4 / `LoginAbuseState`) remains a separate layer.

## Trust proxy

Current API bootstrap:

```ts
app.set('trust proxy', 1)
```

Assumption (matches deployment docs): **exactly one trusted reverse-proxy hop**
(load balancer / nginx / platform proxy) in front of the API.

- Do **not** set `trust proxy` to `true` (permissive).
- Do **not** blindly trust leftmost `X-Forwarded-For` from direct clients.
- If the production topology uses a different hop count (CDN + LB + ingress),
  operators must set the hop count deliberately — report as
  `PROXY_TOPOLOGY_CONFIGURATION_REQUIRED` until confirmed.

## Database failure

If the shared rate-limit store cannot reach Postgres, auth IP limiting is
**fail-closed**: requests receive `503 AUTH_RATE_LIMIT_UNAVAILABLE` (safe message).
Silent fail-open is avoided so distributed protection is not falsely claimed.

## Cleanup

Expired buckets (`resetAt` in the past) are purged opportunistically in small batches.

## QA bypass

`DISABLE_AUTH_RATE_LIMIT=true` is rejected when `APP_ENV=production`.
