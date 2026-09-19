# Mazare3 — Phase 3C.4A.4 Customer Legal Editorial Lock (Final Diff)

**Status:** DRAFT editorial lock complete  
**Version created:** `1.1.2-advisor-final`  
**Preserved history:** `1.1.1-advisor-revised`, `1.1.0-advisor-revised`  
**Scope:** Terms & Conditions · Cancellation & Refund Policy · Booking Terms only  
**Not changed:** Privacy, Owner Agreement, Verification, Community, Cookie; financial economics; backend workflows  
**Production:** NOT touched · no acceptances · no activation

---

## Versioning

| Constant | Value |
|---|---|
| `ADVISOR_REVISED_VERSION_110` | `1.1.0-advisor-revised` (historical) |
| `ADVISOR_REVISED_VERSION_111` | `1.1.1-advisor-revised` (historical) |
| `ADVISOR_REVISED_VERSION` | `1.1.2-advisor-final` (current corpus SSOT) |

---

## Clause diffs (BEFORE → AFTER)

### 1. Arabic grammar — “read together”

**Terms §1 (AR) — BEFORE**
> ويُقرأ هذه المستندات معاً بحسب الموضوع الذي تحكمه.

**AFTER**
> وتُقرأ هذه المستندات معاً بحسب الموضوع الذي تحكمه.

**Booking Terms §9 (AR) — BEFORE**
> ويُقرأ هذه المستندات معاً بحسب الموضوع الذي تحكمه.

**AFTER**
> وتُقرأ هذه المستندات معاً بحسب الموضوع الذي تحكمه.

---

### 2. Arabic heading — eligibility

**Terms §4 title (AR) — BEFORE**
> 4. الأهلية والأهلية القانونية

**AFTER**
> 4. الأهلية القانونية

---

### 3. Limitation of liability — “representations”

**Terms §34 (AR) — BEFORE**
> … أو تمثيلاتها، أو احتيالها …

**AFTER**
> … أو إقراراتها، أو احتيالها …

EN unchanged (“representations”).

---

### 4. Escrow terminology

**Terms §6 role (AR) — BEFORE**
> … ولا تقدّم بنفسها خدمة الإقامة في العقار، وليست مؤمِّناً، وليست خدمة ضمان، وليست جهة تحقق حكومية.

**AFTER**
> … ولا تقدّم بنفسها الخدمة المتعلقة باستخدام العقار المحجوز، وليست مؤمِّناً، ولا تقدم خدمة حفظ الأموال في حساب ضمان (Escrow)، وليست جهة تحقق حكومية.

**Booking Terms §9 (AR) — BEFORE**
> … ولا تقدّم بنفسها خدمة الإقامة في العقار، وليست مؤمِّناً، وليست خدمة ضمان.

**AFTER**
> … ولا تقدّم بنفسها الخدمة المتعلقة باستخدام العقار المحجوز، وليست مؤمِّناً، ولا تقدم خدمة حفظ الأموال في حساب ضمان (Escrow).

EN remains: “not an escrow service”.

---

### 5. Property / accommodation breadth

**Terms definitions (AR) — BEFORE**
> «العقار» مزرعة أو شاليه أو مكان إقامة منشور على مزارع.

**AFTER**
> «العقار» مزرعة أو شاليه أو موقع/عقار آخر معروض للحجز على مزارع.

**Terms booking formation (AR) — BEFORE**
> … لا يعني أن خدمة الإقامة في العقار مؤكدة بالفعل.

**AFTER**
> … لا يعني أن الخدمة المتعلقة باستخدام العقار المحجوز مؤكدة بالفعل.

EN “venue” / “hosted Property service” unchanged (already broad).

---

### 6. Refund Due vs completed refund (EN precision)

**Terms §15 Owner cancellation — BEFORE**
> … the Customer receives a 100% refund of Captured Amounts for that Booking (Refund Due of eligible Captured Amounts) …

**AFTER**
> … the Customer is entitled to a 100% refund of eligible Captured Amounts for that Booking; the resulting amount becomes a Refund Due until payment processing confirms completion …

**Terms §16 Owner no-show / access denied — BEFORE**
> Customer receives a 100% refund of Captured Amounts …

**AFTER**
> the Customer is entitled to a 100% refund of eligible Captured Amounts (Refund Due until payment processing confirms completion) …

**Cancellation §8 Owner-caused — BEFORE**
> the Customer receives a 100% refund of captured Booking payments (Refund Due of eligible Captured Amounts) …

**AFTER**
> the Customer is entitled to a 100% refund of eligible captured Booking payments; the resulting amount becomes a Refund Due until payment processing confirms completion …

**Cancellation §9 Owner no-show — BEFORE**
> Customer receives a 100% refund of captured payments …

**AFTER**
> the Customer is entitled to a 100% refund of eligible captured payments (Refund Due until payment processing confirms completion) …

**Booking Terms §5 — BEFORE**
> you receive a 100% refund of captured Booking payments.

**AFTER**
> you are entitled to a 100% refund of eligible captured Booking payments; the resulting amount becomes a Refund Due until payment processing confirms completion.

**Booking Terms §5 (AR) — BEFORE**
> … تسترد 100٪ من مدفوعات الحجز المحصّلة.

**AFTER**
> … تستحق استرداداً بنسبة 100٪ من مدفوعات الحجز المحصّلة المؤهلة؛ ويصبح المبلغ الناتج مبلغ استرداد مستحقاً حتى يؤكد مزود الدفع اكتمال المعالجة.

Other AR “يستحق” wording retained.

---

### 7. Reschedule cancellation anchor

**Terms / Cancellation / Booking Terms (EN) — BEFORE**
> … uses the more restrictive of the original Booking start and the new Booking start …

**AFTER**
> … is calculated using the earlier of the original Booking start and the new Booking start …

**AR — BEFORE**
> … يعتمد توقيت الإلغاء على الأكثر تقييداً بين بداية الحجز الأصلية والبداية الجديدة …

**AFTER**
> بعد إعادة الجدولة بطلب العميل، يُحتسب توقيت الإلغاء بالاستناد إلى الأسبق من موعد بداية الحجز الأصلي وموعد البداية الجديد …

Backend unchanged: `resolveCancellationPolicyHours` still uses `Math.min` of remaining hours (earlier start). JSDoc aligned to “earlier of”.

---

### 8. Force majeure Arabic style (outcomes unchanged)

**Terms / Cancellation / Booking Terms (AR) — BEFORE**
> … يجعل أداء الحجز مستحيلاً موضوعياً … على استحالة القوة القاهرة المعتمدة …

**AFTER**
> … يجعل تنفيذ الحجز متعذراً بصورة موضوعية … على حالة القوة القاهرة المعتمدة التي يتعذر معها التنفيذ …

EN outcomes unchanged: full refund entitlement; equivalent reschedule only with Customer agreement; Owner penalty = 0; no ordinary cancellation penalty.

---

### 9. English legal entity intro (rendering only)

**`formatLegalEntityIntroEn` — BEFORE**
> BATMAN TECHNOLOGY, a limited liability company (llc) registered in the Hashemite Kingdom of Jordan under Commercial Registration No. 62272

**AFTER**
> BATMAN TECHNOLOGY, a limited liability company registered in the Hashemite Kingdom of Jordan under Commercial Registration No. 62272

SSOT fields unchanged:
- `legalEntityNameEn = BATMAN TECHNOLOGY`
- `legalFormEn = Limited Liability Company (LLC)`

---

## Confirmation — economics unchanged

Unchanged SSOT:
- Deposit **30%**
- Full payment within **72h**
- Balance due **−48h**
- Cancel tiers **0 / 30 / 50 / 100**
- Force majeure / reschedule / refund financial rules (backend)

---

## QA

- `pnpm qa:phase3c4a4-editorial-lock`
- Regression: 3C.4A, 3C.4A.2, 3C.4A.3, 3C.3 identity
- Typecheck: shared / api / web
- Seeded DRAFT `1.1.2-advisor-final` locally (no activation)

**Do not proceed to Phase 3C.4B from this file alone.**
