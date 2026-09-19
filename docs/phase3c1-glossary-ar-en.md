# Phase 3C.1 — Glossary (AR / EN)

**Purpose:** Consistent bilingual terminology for launch-candidate legal documents and UI.  
**Arabic** is the primary market-facing language. Prefer these pairs over ad-hoc synonyms in public legal text.

Related: financial SSOT in `packages/shared` (commission, deposit, cancellation) — numeric rules are **not** redefined here.

---

## Core marketplace terms

| English | Arabic | Notes |
|---------|--------|-------|
| Mazare3 Jordan | مزارع الأردن | Product / brand name — **not** automatically the legal entity |
| Booking | حجز | Confirmed or in-progress reservation of a stay/slot |
| Owner | مالك / شريك عقاري | Independent property partner; supplies the stay |
| Customer | عميل / زبون | Guest booking through the marketplace |
| Property / listing | عقار / إعلان | Farm, chalet, or venue listing on Mazare3 |
| Marketplace / platform | سوق إلكتروني / منصة | Mazare3’s role: connect parties; not the on-site host |

---

## Money & payments

| English | Arabic | Notes |
|---------|--------|-------|
| Deposit | عربون / دفعة أولى | 30% option when start &gt; 72h (Asia/Amman) |
| Balance | المبلغ المتبقي | Remainder due no later than 48h before start |
| Full payment | الدفع الكامل | Required when start ≤ 72h; also optional earlier |
| Refund | استرداد | Return of eligible captured amounts via durable PSP process |
| Cancellation charge | رسوم الإلغاء | Policy percentage applied only against **already captured** funds |
| Commission | عمولة | Platform fee on merchant booking value (18% / 15% verified) |
| Settlement | تسوية | Owner payout process after eligibility rules |
| Jordanian Dinar | دينار أردني (د.أ) | Use د.أ in compact UI; دينار أردني in formal legal prose |

---

## Operations & incidents

| English | Arabic | Notes |
|---------|--------|-------|
| No-show | عدم الحضور | Customer or owner failure to attend / grant access after process |
| Check-in | تسجيل الوصول | One-time PIN/code as arrival evidence only |
| Reschedule | إعادة جدولة | Requires counterparty acceptance; does not reset cancellation clock |
| Force majeure | قوة قاهرة | Extraordinary events outside reasonable control; subject to review |
| Verified by Mazare3 | تم التحقق بواسطة Mazare3 | **Only** when `platform_verified`; **not** government certification |
| Reliability incident | حادثة موثوقية | Internal owner reliability record |

---

## Legal & privacy

| English | Arabic | Notes |
|---------|--------|-------|
| Personal Data | البيانات الشخصية | As under Jordan PDPL No. 24/2023 (counsel-defined scope) |
| Consent | موافقة | Purpose-specific; **not** the Privacy Policy acknowledgement |
| Acknowledgement (privacy notice) | إقرار بالاطلاع | “I have read the Privacy Policy” — distinct from marketing consent |
| Terms and Conditions | الشروط والأحكام | Contract acceptance |
| Privacy Policy | سياسة الخصوصية | Notice + rights; not blanket processing consent |
| Data subject request (DSR) | طلب صاحب البيانات | Access, correction, erasure, etc. |
| Controller | المتحكم | Mazare3 legal entity once identified — **FOUNDER INPUT** |
| Processor | المعالج | Vendors processing on controller instructions |
| Merchant of record | التاجر المسؤول / سجل التاجر | **UNKNOWN** for PayTabs — REQUIRES PSP / JORDANIAN LEGAL REVIEW |
| Escrow | حساب ضمان / إسكرو | **Do not claim** unless independently proven |

---

## Usage rules

1. Keep EN and AR substance equivalent; do not soften financial percentages in one language.  
2. Never translate “Verified by Mazare3” into language implying government approval.  
3. Prefer “acknowledge / read” for Privacy Policy clickwrap; reserve “consent / موافقة” for optional purposes.  
4. When legal entity is unknown, use `[[LEGAL_ENTITY_NAME]]` — do not substitute the brand glossary entry.
