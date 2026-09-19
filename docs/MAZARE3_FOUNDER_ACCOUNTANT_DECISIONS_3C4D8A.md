# Mazare3 — Founder / Accountant Decision Sheet
## Phase 3C.4D.8A

Decisions that can be advanced **without waiting for full legal interpretation first**.  
Legal/regulatory questions remain in `docs/MAZARE3_COUNSEL_QUESTIONS_3C4D8A.md`.  
Full context: `docs/MAZARE3_ADD_YOUR_FARM_COUNSEL_PACKET_3C4D8A.md`.

**Rules:** Do not change Production. Do not activate legal documents. Do not treat a code default as a contractual promise.

---

## 1. Settlement cycle (`[[OWNER_SETTLEMENT_CYCLE]]`)

**Marker:** `OWNER_SETTLEMENT_CYCLE_REQUIRES_FOUNDER_DECISION`

| Decision | Your choice |
|----------|-------------|
| Settlement frequency (e.g. weekly / biweekly / monthly / other) | |
| Post-visit holding period (if any) | |
| Minimum payout threshold (if any) | |
| Weekend / bank-day behaviour | |
| Dispute / chargeback hold rules (ops summary) | |
| Payout failure / retry behaviour (ops summary) | |

**Approved contractual wording for `[[OWNER_SETTLEMENT_CYCLE]]`:**  
_________________________________________________________________

Founder: ________ Date: ________  
Accountant review: ☐ Not required · ☐ Reviewed by ________ Date: ________

---

## 2. PSP / payment-processing fee treatment

**Marker:** `OWNER_PAYMENT_FEE_TREATMENT_REQUIRES_FOUNDER_DECISION`

Current product recommendation for launch: **Option A** — Mazare3 absorbs PSP fees within platform commission/economics. Code does **not** deduct a separate Owner PSP fee today.

| Option | Choose one |
|--------|------------|
| **A** Absorb PSP fees in platform economics (recommended) | ☐ |
| **B** Owner bears an explicitly disclosed separate fee | ☐ |

If **B**: fee basis, disclosure surface, and accountant confirmation:  
_________________________________________________________________

Founder: ________ Date: ________  
Accountant: ________ Date: ________

---

## 3. Settlement thresholds / operating process (optional detail)

| Item | Decision |
|------|----------|
| Minimum payout amount | |
| Manual vs automatic release | |
| Who approves exception payouts | |
| Currency / bank corridor assumptions (Jordan launch) | |
| Ops SLA for payout investigation | |

---

## 4. Third-party payout at launch (business choice)

**Marker:** `PAYOUT_THIRD_PARTY_BENEFICIARY_COUNSEL_CONFIRMATION_REQUIRED`  
Product already blocks third-party from payout READY.

**Founder launch choice (independent of eventual legal permissibility):**

| Choice | Select |
|--------|--------|
| Keep third-party payout **disabled** at launch (only operator self / legal entity) — **recommended** | ☐ |
| Enable third-party later only after counsel + accountant clearance | ☐ |
| Seek counsel to permit third-party before launch | ☐ |

Notes: _________________________________________________________________

---

## 5. Optional commercial insurance (above legal minimum)

Counsel will decide **legal** insurance mandates separately.

| Choice | Select |
|--------|--------|
| Do **not** add a Mazare3-only insurance gate beyond legal minimum at launch | ☐ |
| Require proof of civil-liability insurance for some/all launch categories as **commercial risk policy** | ☐ |

If require: which Property activities / categories:  
_________________________________________________________________

Minimum coverage amount (if any commercial policy): ________________  
Evidence required: ________________

---

## 6. Regulatory / payout permissions (RBAC)

**Marker:** `REGULATORY_RBAC_HARDENING_PENDING`

Assign roles (names or job functions). Prefer separation of duties for Production.

| Capability | Who may perform |
|------------|-----------------|
| Review regulatory evidence | |
| Decide regulatory applicability | |
| Confirm requirement N/A | |
| Verify regulatory evidence | |
| Approve payout beneficiary | |
| View full payout / IBAN data | |
| Platform-verify Property (“Verified by Mazare3”) | |
| Super-admin break-glass | |

**Production admin hygiene**  
☐ Limit number of Production admin accounts  
☐ Dual review required for: ☐ payout READY · ☐ N/A confirm · ☐ platform verify · ☐ other: ______

Founder / security owner: ________ Date: ________

---

## 7. Legal entity publication values (founder-confirmed)

Fill only final **public** values. Do not paste unnecessary shareholder/private data into public docs.

| Field | Final public value |
|-------|-------------------|
| Legal entity name (AR) | |
| Legal entity name (EN) | |
| Legal form (AR/EN) | |
| Intro line (AR/EN) | |
| Registered address (AR/EN) | |
| Commercial registration number | |
| National establishment number (if published) | |
| Legal contact email | |
| Privacy contact email | |
| Partnership / ops phone (if published) | |
| Privacy Policy effective / last-updated dates | |

☐ Values confirmed for publication · ☐ Not yet — block activation  

Founder: ________ Date: ________

---

## 8. Provider facts founder must obtain from contracts (not invent)

| Provider area | Legal name | Privacy contact | Processing region / country | Contract on file? |
|---------------|------------|-----------------|----------------------------|-------------------|
| Payment (PSP) | | | | ☐ |
| Primary database | | | | ☐ |
| Object storage (KYC/media) | | | | ☐ |
| App hosting | | | | ☐ |
| Email (if used in Prod) | | | | ☐ |
| Google Sign-In (if enabled) | | | | ☐ |

Hand completed table to privacy counsel for Privacy Policy / transfer register.

---

## 9. Launch scope (founder product choice)

Which Property activity categories are **in scope for first Production launch**?  
(Counsel licensing answers will be applied to this list.)

| Activity | In launch? |
|----------|------------|
| Day use | ☐ Yes · ☐ No · ☐ Later |
| Overnight | ☐ Yes · ☐ No · ☐ Later |
| Events | ☐ Yes · ☐ No · ☐ Later |
| Swimming pool | ☐ Yes · ☐ No · ☐ Later |
| Food service | ☐ Yes · ☐ No · ☐ Later |

Geographic launch scope: ________________

---

## 10. Sign-off

| Role | Name | Date | Signature / OK |
|------|------|------|----------------|
| Founder | | | |
| Accountant | | | |
| Ops / security (RBAC) | | | |

**After this sheet:** merge with counsel questionnaire answers → decision log → Launch Compliance Preflight.  
**Do not** implement or activate from this sheet alone.
