# Staging manual QA checklist — Mazare3 (Phase 7A / 7C)

Run on a **staging host** after deploy. Step-by-step deploy: [staging-deploy-runbook.md](./staging-deploy-runbook.md).

Prerequisites:

- Web and API reachable over HTTPS
- API: `NODE_ENV=production`, `APP_ENV=staging`, `PAYMENT_PROVIDER=test`, `PAYMENT_SIMULATE_ENABLED=true`, `COOKIE_SECURE=true`
- Web: `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_API_URL` match live URLs
- Demo users seeded once (optional): `admin@mazare3.jo`, `owner1@mazare3.jo`, `customer@mazare3.jo` / `Mazare3Demo2026!`

Record: date, tester, environment URL, pass/fail per row.

---

## 0. After staging deploy — smoke (15 min)

Run immediately after first deploy ([staging-deployment-plan.md](./staging-deployment-plan.md)).

| # | Check | Pass? |
|---|--------|-------|
| 0.1 | `GET {API_URL}/api/v1/health` | Returns 200 JSON |
| 0.2 | Web home `/ar` loads (no 5xx) | |
| 0.3 | Login as `customer@mazare3.jo` (if seeded) or new signup | Session cookie set |
| 0.4 | Search → open property → book slot | Reaches checkout |
| 0.5 | Checkout — simulate **success** (requires `PAYMENT_PROVIDER=test` + simulate enabled on API) | Booking confirmed |
| 0.6 | Account bookings lists reservation | |
| 0.7 | Customer — refund request on paid booking | Request created |
| 0.8 | Owner login → `/ar/owner` dashboard | Owner data only |
| 0.9 | Admin login → `/ar/admin` dashboard | Admin access |
| 0.10 | Public property page / API JSON — **no** phone, WhatsApp, exactAddress | Privacy OK |

If 0.3 fails: check `CORS_ORIGIN`, `NEXT_PUBLIC_API_URL`, HTTPS, and subdomain cookie layout (see deployment plan §3).

---

## 1. Auth

| # | Step | Expected |
|---|------|----------|
| 1.1 | Open `/ar/signup`, create new customer | Account created; role customer only |
| 1.2 | Logout | Session cleared |
| 1.3 | Login with new account | Redirect to app; header shows account state |
| 1.4 | `GET /api/v1/auth/me` while logged in | Returns user, no password hash |
| 1.5 | Logout | `/auth/me` returns 401 |

---

## 2. Search & public property

| # | Step | Expected |
|---|------|----------|
| 2.1 | `/ar/search` — search by city/area | Results list loads |
| 2.2 | Open property detail from search | Page renders AR; LTR check on `/en/...` |
| 2.3 | Inspect property JSON or UI for contact leaks | **No** owner `phone`, **no** `whatsapp`, **no** `exactAddress` |
| 2.4 | Public fields only | `approximateLocation` / city / area OK |
| 2.5 | Availability calendar | Shows slots; booked/blocked states sensible |

---

## 3. Booking & checkout (test provider)

| # | Step | Expected |
|---|------|----------|
| 3.1 | As customer, book available slot | Booking `pending_payment`; checkout link works |
| 3.2 | Checkout — simulate **failure** | Booking not confirmed; slot not permanently lost |
| 3.3 | New booking — simulate **success** | `confirmed`; payment `succeeded` |
| 3.4 | `/ar/account/bookings` | Booking listed with correct status |
| 3.5 | Try cancel **paid** booking | Blocked with clear message (policy) |
| 3.6 | Optional: cancel `pending_payment` | Cancelled; slot available again |

---

## 4. Become owner & owner dashboard

| # | Step | Expected |
|---|------|----------|
| 4.1 | Customer → `/ar/become-owner` — submit application | Success message; pending state |
| 4.2 | Customer without approval → `/ar/owner` | Forbidden or redirect (not full dashboard) |
| 4.3 | Admin → `/ar/admin/owners` — approve test owner | Status approved |
| 4.4 | Owner login → `/ar/owner` | Summary visible |
| 4.5 | Owner → properties, availability, bookings | Data scoped to own properties only |
| 4.6 | Owner → `/ar/owner/payouts` | List loads; no provider secrets in UI |

---

## 5. Admin dashboard

| # | Step | Expected |
|---|------|----------|
| 5.1 | Admin → `/ar/admin` | Summary + recent audit |
| 5.2 | Users — suspend non-admin test user | Status updates |
| 5.3 | Properties / bookings / availability | Read or edit per role rules |
| 5.4 | `/ar/admin/payments` | Payment list; no card numbers |
| 5.5 | `/ar/admin/refunds` | Refund requests visible |
| 5.6 | `/ar/admin/disputes` | Dispute list loads |
| 5.7 | `/ar/admin/payouts` | Payout ops; mark-paid flow if testing |
| 5.8 | Customer → `/ar/admin` | 403 or login redirect |

---

## 6. Refunds / disputes / payouts (internal ops)

| # | Step | Expected |
|---|------|----------|
| 6.1 | Customer — paid booking → request refund | `RefundRequest` created |
| 6.2 | Admin — approve/process refund (internal) | Status updates; no real bank refund |
| 6.3 | Customer — open dispute on booking | Dispute visible to admin |
| 6.4 | Admin — payout list for eligible payment | Shows amount; blocked if open refund/dispute |
| 6.5 | Owner payouts page | Matches owner’s properties only |

---

## 7. Privacy & security smoke

| # | Step | Expected |
|---|------|----------|
| 7.1 | Guest property API `GET /properties/:slug` | No phone / whatsapp / exactAddress in JSON |
| 7.2 | Browser devtools → Application → cookies | Auth cookie `HttpOnly`; `Secure` on HTTPS prod |
| 7.3 | Wrong API origin from browser | CORS blocks unauthorized origin |
| 7.4 | Trigger 500 (invalid route) | Generic error JSON, no stack trace in response |
| 7.5 | Production API: hit simulate endpoint | **404/403** — simulate disabled |

---

## 8. Sign-off

- [ ] All critical paths (sections 1–5) passed
- [ ] Privacy rows 7.1–7.4 passed
- [ ] Payment mode documented (test vs live)
- [ ] Known issues logged with ticket links

**Next:** live PSP staging per [staging-payment-checklist.md](./staging-payment-checklist.md) when bank credentials exist.
