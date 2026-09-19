# Mazare3 — Booking Financial Examples
## Phase 3C.4E.1

Deterministic results from shared SSOT (`@mazare3/shared` money + financial policy + booking-financials).  
Currency: **JOD**. Math via **integer fils** (`jodToFils` / `percentOfFils`).  
Assume **customer service fee = 0** unless noted. No tax in current Customer snapshot.

**Boundary rule:** `fullPaymentRequired` when `hoursUntilStart <= 72` (exactly 72h = full only).

---

### A. 200 JOD, >72h, 30% deposit

| Field | Value |
|-------|-------|
| Commercial / booking total | 200 |
| Customer total | 200 |
| Captured now (deposit) | **60** |
| Balance | **140** |
| `balanceDueAt` | start − 48h |
| Platform commission @18% (if fully retained later) | 36 on full value |
| Owner net @18% if fully paid | 164 |

`calculateBookingFinancialSnapshot({200, deposit 30%, commission 18%})`.

---

### B. 200 JOD, >72h, full

| Field | Value |
|-------|-------|
| Captured now | **200** |
| Balance | **0** |
| Commission 18% | 36 |
| Owner net | 164 |

---

### C. 200 JOD, ≤72h (including exactly 72h)

| Field | Value |
|-------|-------|
| Plan | full required (`depositPercent` 100) |
| Captured now | **200** |
| Balance | **0** |

`resolvePaymentPlan({ hoursUntilStart: 72, customerPayable: 200 })`.

---

### D. Owner-funded discount (property coupon): 200 → 180 payable

| Field | Value |
|-------|-------|
| Commercial Booking Value (payable basis) | **180** |
| Deposit 30% | **54** |
| Balance | **126** |
| Commission 18% of 180 | **32.4** |
| Owner net | **147.6** |

Owner absorbs discount; commission follows reduced total.

---

### E. Platform-funded coupon: merchant 200, discount 20 → customer 180

| Field | Value |
|-------|-------|
| Merchant / commission basis | **200** |
| Customer payable | **180** |
| Deposit 30% of 180 | **54** |
| Balance | **126** |
| Commission 18% of **200** | **36** |
| Owner net | **164** |

Platform bears subsidy; Owner economics on full merchant value.

---

### F. Customer cancellation >72h (deposit 60 captured)

| Field | Value |
|-------|-------|
| Charge % | 0 |
| Policy charge | 0 |
| Retained | **0** |
| Refund | **60** |
| Platform / Owner retained | 0 / 0 |

---

### G. Cancellation 72–48h window (example hoursUntil=60; deposit 60 captured)

| Field | Value |
|-------|-------|
| Charge % | 30 of 200 = 60 |
| Retained | min(60,60)=**60** |
| Refund | **0** |
| Platform 18% of retained | **10.8** |
| Owner retained | **49.2** |

---

### H. Cancellation 48–24h (hoursUntil=36; deposit 60)

| Field | Value |
|-------|-------|
| Charge % | 50 → policy 100 |
| Retained | min(60,100)=**60** |
| Refund | **0** |
| Split @18% | 10.8 / 49.2 |

*No extra collection to reach 100 of merchant value.*

---

### I. Cancellation ≤24h (hoursUntil=12; deposit 60)

| Field | Value |
|-------|-------|
| Charge % | 100 → policy 200 |
| Retained | min(60,200)=**60** |
| Refund | **0** |
| Split @18% | 10.8 / 49.2 |

---

### J. Unpaid balance (`BALANCE_NOT_PAID`) — deposit 60 captured

| Field | Value |
|-------|-------|
| Extra charge | **none** |
| Retained | **60** (all captured) |
| Refund | **0** |
| Platform / Owner @18% | **10.8 / 49.2** |
| Booking | cancelled; slot released |

Reconcile-before-cancel is required in job path.

---

### K. Standard 18% (200 fully paid)

| Field | Value |
|-------|-------|
| Platform commission | **36** |
| Owner net | **164** |

KYC alone does **not** switch to 15%.

---

### L. platform_verified 15% (200 fully paid)

| Field | Value |
|-------|-------|
| Platform commission | **30** |
| Owner net | **170** |

Rate snapshotted at Booking create from listing verification / commercial terms — not recomputed from live Property for historical payout math.

---

## Discrepancies / notes

1. **Deposit rounding:** snapshot uses fils `percentOfFils`; `resolvePaymentPlan` uses `roundPolicyMoney((payable * percent)/100)` — equivalent for clean 200/30 cases; watch odd fils edges.  
2. **Full via 100% deposit mode:** collection mode often remains `deposit_balance` with 100% deposit rather than enum `full` — intentional product path; integrity script still reports some legacy `full_mode` rows.  
3. **Multi-capture refunds:** examples assume single capture; deposit+balance full refunds need multi-Payment handling (CRITICAL in audit).  
4. **No Customer tax** in these snapshots — tax treatment remains accountant counsel item (3C.4D.8A).

**STOP — audit examples only; no policy change.**
