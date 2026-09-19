# Mazare3 — Customer Booking & Payment
# End-to-End Product / Financial / Legal Audit
## Phase 3C.4E.1

**Type:** AUDIT ONLY  
**Date context:** Post 3C.4D.8A  
**Scope:** Customer Booking + payment lifecycle (local codebase)  

**Confirmed non-actions:** no product logic change · no schema/migration · no locked legal doc change · no deploy · Production untouched.

Locked drafts unchanged: Terms / Cancellation / Booking Terms / Privacy `1.1.2-advisor-final`; Owner Agreement `1.1.1-advisor-final`.

Companion maps:

- `docs/MAZARE3_CUSTOMER_BOOKING_STATE_MAP_3C4E1.md`
- `docs/MAZARE3_CUSTOMER_PAYMENT_FLOW_3C4E1.md`
- `docs/MAZARE3_BOOKING_FINANCIAL_EXAMPLES_3C4E1.md`

---

## 1. Exact Customer journey (code-traced)

| Step | Surface | Server authority |
|------|---------|------------------|
| Property detail | `apps/web/.../properties/[slug]` + booking panel | Public property mapper (approx location) |
| Date / period | Booking calendar / panel | Availability APIs |
| Quote | Panel → `GET` quote | `getBookingQuote` → `resolveBookingPricing` (`booking-quote.service.ts`) |
| Create Booking | Panel CTA | `POST /bookings` → `createBooking` (`booking.service.ts`) + bookability + Prior Consents + Terms middleware |
| Owner approval (if required) | Owner UI + Customer wait state | `acceptOwnerBooking` / `rejectOwnerBooking` / expiry job |
| Checkout / payment choice | `/[locale]/checkout/[bookingId]` | `getCheckoutBooking` (syncs live plan) → `createPaymentIntent` |
| Provider | PayTabs HPP / managed form / saved card | `payment.service.ts` + `paytabs-payment-gateway.ts` |
| Return URL | checkout return + `/api/payment-return/...` | **UX only** — `acknowledgeBrowserPaymentReturn` does not capture |
| Webhook / reconcile | `POST /payments/webhooks/:provider` | `handlePaymentWebhook` / `reconcilePayTabsPayment` → `finalizePaymentSuccess` |
| My Bookings | `/account/bookings` | Customer-scoped booking APIs + snapshot panel |
| Balance | My Bookings CTA → checkout | Purpose `balance` (skips bookability re-gate) |
| Check-in | When eligible | Check-in service; PIN window from policy constants |

---

## 2. Finding matrix

| Area | Current behavior | Expected policy | Status | Risk | Customer impact | Financial impact | Required action | Code reference |
|------|------------------|-----------------|--------|------|-----------------|------------------|-----------------|----------------|
| Booking statuses | `pending` (legacy), `pending_owner_approval`, `pending_payment`, `confirmed`, `cancelled`, `expired` | Clear machine | ALIGNED | LOW | Labels mostly map | — | Document legacy `pending` | `schema.prisma` `BookingStatus` |
| Payment states | `unpaid` → deposit/balance/full → refunded variants | Clear machine | ALIGNED | LOW | Shown in checkout/My Bookings | — | — | `BookingPaymentState` |
| Owner approval 60m | Default `OWNER_APPROVAL_RESPONSE_MINUTES=60`; pay blocked while pending | 60m; no capture before accept | ALIGNED | LOW | Wait / expire messaging | Hold not charged | Confirm Prod env | `owner-approval-config.ts`, `createPaymentIntent` |
| Approval expiry | Job + lazy expiry → `expired` / timed_out | Expire; not confirmed | ALIGNED | LOW | Slot released | No payment | Schedule job in Prod | `expire-owner-approval-requests` |
| Bookability NEW | `evaluatePropertyBookability` / assert on quote, create, accept, first pay | READY + authority; no platform_verified | ALIGNED | LOW | Unbookable properties fail closed | — | — | `property-bookability.service.ts` |
| Bookability TOCTOU | Assert at quote; create TX does not re-assert | Ideal: re-assert in TX | PARTIAL | MEDIUM | Rare race to hold then fail at first pay | Temporary slot hold | Remediation: re-assert in create TX | `booking.service.ts` create |
| Balance vs regulatory | Balance purpose skips bookability | Do not block balance solely for later non-ready | ALIGNED | LOW | Can pay balance | Aligns policy | — | `payment.service.ts` comments + gate skip |
| Slot concurrency | Property `FOR UPDATE` + slot `available`→`booked` + holding statuses | No double book | PARTIAL | HIGH | Second Customer fails | Mitigated | Prefer DB unique / stronger constraint | `createBooking`, `payment-hold.ts` |
| No unique active booking/slot | Index only | Strong uniqueness | PARTIAL | HIGH | Relies on app locks | Residual double-book risk if TX missed | Schema unique (future) | Prisma Booking indexes |
| Timezone | Platform `Asia/Amman`; windows via UTC Instant deltas; legacy slots UTC midnight fallback | Authoritative Amman start | PARTIAL | MEDIUM | Legacy deadline edge cases | Rare mis-tier | Avoid legacy slots | `timezone.ts`, `resolveBookingPeriodStart` |
| 72h boundary | `hoursUntilStart <= 72` → full only; `>72` deposit OR full | Exact 72 = full | ALIGNED (math) | LOW | — | — | — | `resolvePaymentPlan` |
| 72h at payment API | `createPaymentIntent` does **not** call `syncLivePaymentPlanForBooking` (checkout GET does) | Force full when crossed | CONFLICT | **HIGH** | May still start 30% deposit after crossing if checkout sync skipped | Under-collection risk | Remediation: sync/revalidate in intent | `payment.service.ts`, `booking.service.ts` sync |
| Deposit formula | 30% of customer payable (fils); fee with first installment | 30% deposit | ALIGNED | LOW | Clear | — | — | `booking-financials.ts` |
| Balance due | `bookingStartAt − 48h` snapshotted on Booking | Start−48h immutable | ALIGNED | LOW | My Bookings shows due | — | — | `computeBalanceDueAtFromStart` |
| BALANCE_NOT_PAID | Job reconciles open balance intents then cancels; retain captured; no extra charge; commission split on retained | Reconcile-first; retain deposit | ALIGNED | LOW | Auto-cancel notice | Deposit retained @ snapshotted % | Schedule job in Prod | `auto-cancel-unpaid-balances`, `booking-hold.service` |
| Listing snapshot | Created in create TX; required before first pay | Immutable Booking-time evidence | ALIGNED | LOW | History uses snapshot | — | — | `booking-listing-snapshot.service.ts` |
| Financial snapshot | Price, commission %, deposit/balance, merchant value stored on Booking | No live reprice of history | ALIGNED | LOW | — | — | — | `createBooking` fields |
| Return URL | Ack only; not capture | Server truth | ALIGNED | LOW | UX “processing” | — | — | `acknowledgeBrowserPaymentReturn` |
| Webhook HMAC | Raw-body HMAC + timing-safe; profile id | Signed | ALIGNED | LOW | — | — | — | `paytabs-signature.ts` |
| Webhook amount/currency | Not verified on webhook success path; reconcile verifies | Match local amount/currency | CONFLICT | **HIGH** | Wrong amount could confirm if PSP mis-sends | Over/under confirm | Remediation: verify on webhook | `paytabs-payment-gateway.verifyWebhook` |
| Duplicate payment | Idempotency key; purpose already succeeded blocked; event dedupe | No double charge | ALIGNED | LOW | Safe retry | — | — | `providerIdempotencyKey`, `finalizePaymentSuccess` |
| Multi-capture refund | Refunds attach to **latest succeeded Payment** for full obligation | Refund all captures | CONFLICT | **CRITICAL** | Full refund after deposit+balance may fail/under-refund | Customer money stuck | Remediation: multi-payment refund plan | `ensureSystemCancellationRefund` et al. |
| Coupons | `fundedBy: platform \| property` | Platform: commission on merchant; Owner: reduced value | ALIGNED | LOW | Discount visible | Correct economics | Naming vs “OWNER_FUNDED” enum | `booking-financials.ts` |
| Customer cancel tiers | 0/30/50/100%; retained=min(captured, charge) | Policy | ALIGNED | LOW | Policy on My Bookings | Correct | — | `evaluateCancellationSettlement` |
| Owner cancel | Full Customer refund; Owner payout 0; commission 0; adjustment separate | Policy | ALIGNED | LOW | Full refund path | — | Multi-capture refund caveat | `owner-cancellation.service.ts` |
| Force majeure | Full refund default; reschedule only with Customer choice | Policy | ALIGNED | LOW | Choice recorded | — | — | `force-majeure.service.ts` |
| Customer no-show | Admin confirm; 60m grace; no refund; status stays `confirmed` | Review required | PARTIAL | **HIGH** | Location/check-in still eligible while confirmed | Owner keeps earnings | Clarify UX / status | `no-show.service.ts` |
| Owner no-show / access denied | Full refund; payout 0; 20% adjustment | Policy | ALIGNED | LOW | Refund | Multi-capture caveat | — | `no-show.service.ts` |
| Exact location | After confirmed + paid-enough states | Privacy design | ALIGNED | LOW | Reveal when eligible | — | No-show residual reveal | `location-privacy.ts` |
| Legal acceptance | Terms middleware + Prior Consents; booking doc version IDs optional; snapshot best-effort | Versioned Booking Terms / Cancel ack | PARTIAL | **HIGH** | May book without hard Booking Terms ID | Evidence gap | Counsel/product gate | `createBooking`, `requireTermsAcceptance` |
| Cancellation disclosure | Checkout/My Bookings show policy; legal pages exist | Clear before pay | PARTIAL | MEDIUM | Policy may feel buried | — | UX hardening (no legal rewrite) | checkout + my-bookings |
| Payment disclosure | Due now / remaining / balanceDueAt on checkout | Clear before deposit | ALIGNED | LOW | — | — | — | `checkout-payment-summary.tsx` |
| Notifications | Broad inventory (request/accept/pay/balance cancel/refund/reschedule/FM) | Adequate | PARTIAL | MEDIUM | Channel coverage varies | — | Audit Prod channels | `notification.service.ts` |
| IDOR | Bookings scoped by userId; Owner scoped | Secure | ALIGNED | LOW | — | — | Keep tests | routes/services |
| Production jobs | Code registry; **no in-process cron** in API index — external scheduler expected | Jobs must be scheduled | MISSING (ops) | **CRITICAL** (launch) | Approvals/balances may not expire/cancel | Financial drift | Founder/ops: configure scheduler | `background-jobs.service.ts` |
| Mobile parity | Server APIs shared; no separate mobile money engine found in audit | Same rules | ALIGNED | LOW | — | — | Confirm if native app ships | API routes |
| Legacy bookings | No listing snapshot backfill; some full_mode legacy rows | No rewrite | ALIGNED | LOW | Legacy UI limits | Integrity script notes | — | 3C.4D.6 + integrity counts |

---

## 3. CRITICAL findings

1. **Multi-installment refund against a single Payment / `tran_ref`** — deposit+balance (or +reschedule) full refunds can fail or under-refund at PSP.  
2. **Production scheduler not proven by code alone** — approval expiry, unpaid-hold expiry, and `BALANCE_NOT_PAID` auto-cancel require external cron; absence is a launch blocker.

## 4. HIGH findings

1. **72h full-payment not recomputed inside `createPaymentIntent`** — checkout GET syncs; direct API / skipped sync can allow deposit after threshold.  
2. **Webhook success lacks local amount/currency verification** (reconcile path does verify).  
3. **No DB unique constraint** for one active holding Booking per slot (app locks mitigate).  
4. **Customer legal document version IDs optional**; acceptance/snapshot failure after create is non-fatal.  
5. **Customer no-show leaves Booking `confirmed`** (exact location / check-in surfaces may remain eligible).  
6. **Create bookability TOCTOU** between quote assert and create TX.  
7. **`parsePaytabsCartId` omits `reschedule_difference`** (depends on `tran_ref` fallback).

## 5. MEDIUM findings

- Legacy slot start UTC-midnight fallback for 48h/72h math.  
- Cancellation / payment policy disclosure depth in UX.  
- Notification channel completeness in Production.  
- Active payment session reuse may skip re-bookability.  
- Customer cancel path concurrency vs payment finalize (accept path locks; cancel path should be reviewed in remediation).

## 6. Legal / counsel gaps (document only)

- Whether optional Booking Terms / Cancellation version capture at checkout is sufficient for Jordan evidence.  
- Customer no-show status/UX vs refund-0 economics disclosure.  
- Whether webhook amount verification is required as a contractual PSP control.  
- Public disclosure of listing snapshots (carry 3C.4D.8A AYF-19).  
- Locked docs not activated — activation still blocked by 3C.4D.8A packet.

## 7. Founder decisions

- Confirm **Production scheduler** for booking/payment jobs before launch.  
- Accept residual slot uniqueness risk until schema hardening, or prioritize unique constraint.  
- Prioritize remediation of multi-capture refunds before high-volume deposit+balance traffic.  
- Decide whether checkout must hard-require Booking Terms + Cancellation acknowledgement versions.

## 8. Required remediation phases (suggested — do not start now)

| Phase | Focus |
|-------|--------|
| 3C.4E.2 | Payment integrity: multi-capture refunds; webhook amount/currency; 72h revalidation at intent |
| 3C.4E.3 | Concurrency: slot unique constraint; create bookability re-assert; cancel/payment locks |
| 3C.4E.4 | Customer disclosure UX + hard legal version gates (if counsel requires) |
| 3C.4E.5 | Production job scheduler preflight + monitoring |
| 3C.4E.6 | No-show status/UX cleanup |

## 9. QA / race-test results (this audit)

| Suite | Result |
|-------|--------|
| CB-6 deposit vs full | **60/60 passed** |
| CB-2 customer booking quote | **44/44 passed** |
| Payment integrity (counts) | Ran; `new_bookings_missing_snapshot=0`, `over_captured_bookings=0`; notes legacy full_mode remaining anomalies + payout eligibility without fully_paid count=6 (investigate in remediation, not changed here) |
| 3C.4D.4B / 3C.4D.6 | Previously green; behaviors referenced, not re-broken in this audit |

Race scenarios **A–Q**: assessed from code (not live Production races). Highest residual: multi-capture refund, 72h intent gap, webhook amount, scheduler, slot unique.

## 10. Confirmations

- No policy/code/schema changed in 3C.4E.1  
- Locked legal docs unchanged  
- Production untouched  

**STOP after 3C.4E.1.**
