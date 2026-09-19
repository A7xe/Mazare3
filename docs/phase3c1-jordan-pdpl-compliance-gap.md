# Phase 3C.1 — Jordan PDPL Compliance Gap Analysis

**Status:** Internal engineering / compliance gap checklist — **not legal advice**.  
**Baseline framework (cite by name/number only; paraphrase; do not quote large legislation):**

- Personal Data Protection Law No. 24 of 2023  
- Regulations, instructions, official forms, and decisions under the PDPL framework, including currently applicable **2025 instruments** (disclosure, technical/organizational security, consent/withdrawal, data-subject rights, controller/processor/DPO obligations)  
- Electronic Transactions Law No. 15 of 2015, as amended by Law No. 1 of 2026  
- Consumer Protection Law No. 7 of 2017  

Where interpretation is uncertain: **REQUIRES JORDANIAN LEGAL REVIEW**.

Related: [phase3c1-legal-identity-inputs.md](./phase3c1-legal-identity-inputs.md), [phase3c1-third-party-processor-inventory.md](./phase3c1-third-party-processor-inventory.md), [phase3c1-retention-matrix.md](./phase3c1-retention-matrix.md), [phase3b-legal-consent-architecture.md](./phase3b-legal-consent-architecture.md).

**Status legend**

| Status | Meaning |
|--------|---------|
| **IMPLEMENTED** | Product/architecture meaningfully addresses the topic |
| **PARTIAL** | Some controls exist; gaps remain before Production claim |
| **MISSING** | Not present in repo / ops |
| **REQUIRES JORDANIAN LEGAL REVIEW** | Law/instrument application or sufficiency needs counsel |

---

## 1. Data Protection Officer (DPO)

| Aspect | Finding |
|--------|---------|
| Status | **MISSING** + **REQUIRES JORDANIAN LEGAL REVIEW** |
| Evidence | No DPO env var, appointment record, public contact, or registration workflow in repo |
| Gap | Determine whether Mazare3’s processing scale/sensitivity triggers DPO appointment under PDPL + 2025 instruments; if required, appoint, document tasks, and publish contact (`[[DPO_OR_PRIVACY_CONTACT]]`) |

---

## 2. Processing / records of processing (register)

| Aspect | Finding |
|--------|---------|
| Status | **PARTIAL** + **REQUIRES JORDANIAN LEGAL REVIEW** |
| Evidence | Engineering inventories exist: Phase 1/2 privacy data-flow docs, Phase 3B retention map / cookie audit / KYC notice audit, Phase 3C.1 processor inventory & retention matrix |
| Gap | No formal controller “record of processing activities” mapped to PDPL/2025 register requirements (purposes, categories, recipients, transfers, retention, security). Convert inventories into counsel-approved register |

---

## 3. Controller / processor roles

| Aspect | Finding |
|--------|---------|
| Status | **PARTIAL** + **REQUIRES JORDANIAN LEGAL REVIEW** |
| Evidence | Mazare3 operates accounts, bookings, KYC refs, legal acceptances, DSR workflow → likely **controller** (or joint-controller scenarios) for marketplace personal data. Vendors (Neon, Cloudflare R2, PayTabs, Google, Resend when enabled, hosting) process on behalf of or as independent controllers depending on role |
| Gap | Legal entity of controller is **MISSING** (see identity inputs). PayTabs **MoR** unknown — payment role may be controller, processor, or independent controller for card data. Document each relationship; do not invent |

---

## 4. Sensitive / special-category data

| Aspect | Finding |
|--------|---------|
| Status | **PARTIAL** + **REQUIRES JORDANIAN LEGAL REVIEW** |
| Evidence | Partner KYC / verification documents (identity, business registration, payout proofs) in **private** R2; restricted admin streaming; not on public listings. No PAN/CVV stored in Mazare3 DB |
| Gap | Classify KYC and any biometric/ID images under PDPL sensitive-data rules; confirm lawful basis, notices, retention, and access controls with counsel. Publish dedicated verification privacy language (Phase 3C verification policy) |

---

## 5. Cross-border transfers

| Aspect | Finding |
|--------|---------|
| Status | **MISSING** (location evidence) + **REQUIRES JORDANIAN LEGAL REVIEW** |
| Evidence | Neon, Cloudflare R2 (public + private), Google OAuth, Resend (when used), and hosting locations are **UNKNOWN** in repo. PayTabs uses Jordan endpoint default `https://secure-jordan.paytabs.com` — still does not by itself prove all processing stays in Jordan |
| Gap | Map each transfer/recipient; assess PDPL + 2025 cross-border / disclosure conditions; update Privacy Policy disclosures only after locations and safeguards are known |

---

## 6. Vendor DPAs / processing agreements

| Aspect | Finding |
|--------|---------|
| Status | **MISSING** (in-repo) + **REQUIRES JORDANIAN LEGAL REVIEW** |
| Evidence | No stored DPA/SCC/Jordan-equivalent processor agreements in repository. Vendor inventory lists purposes only |
| Gap | Execute and file DPAs (or equivalent) with Neon, Cloudflare, PayTabs, Google, Resend, hosting; align subprocessors list with Privacy Policy |

---

## 7. Breach notification

| Aspect | Finding |
|--------|---------|
| Status | **MISSING** + **REQUIRES JORDANIAN LEGAL REVIEW** |
| Evidence | No documented personal-data breach playbook, regulator notification timers, or user-notification templates tied to PDPL/2025 instruments. Audit logs exist for some security/ops events but are not a breach program |
| Gap | Define detection, containment, assessment, authority/user notification, and evidence retention with counsel |

---

## 8. DPIA / impact assessment

| Aspect | Finding |
|--------|---------|
| Status | **MISSING** + **REQUIRES JORDANIAN LEGAL REVIEW** |
| Evidence | No DPIA (or Jordan-equivalent assessment) artifact for marketplace + KYC + payment + cross-border processing |
| Gap | Counsel to determine when assessment is mandatory; prioritize KYC, payment metadata, and large-scale account profiling if any |

---

## 9. Consent

| Aspect | Finding |
|--------|---------|
| Status | **PARTIAL** + **REQUIRES JORDANIAN LEGAL REVIEW** |
| Evidence | Phase 3B separates: Terms acceptance; Privacy **acknowledgement** (not “consent to Privacy Policy”); purpose-specific `PrivacyConsent` (marketing/optional cookies/analytics); no bundled Terms+Privacy+Marketing checkbox; withdraw keeps history |
| Gap | Map each processing purpose to PDPL lawful basis (consent vs contract vs legal obligation vs other). Confirm 2025 consent/withdrawal instruments against UI/API. Optional marketing must remain unticked by default |

---

## 10. Data subject rights (DSR)

| Aspect | Finding |
|--------|---------|
| Status | **PARTIAL** + **REQUIRES JORDANIAN LEGAL REVIEW** |
| Evidence | `DataSubjectRequest` supports access / correction / erasure / objection / portability / privacy_inquiry; user create + admin status updates; erasure may be `rejected_with_reason` when retention applies |
| Gap | Confirm response timelines, identity verification, fee rules, and scope against PDPL + 2025 data-subject-rights instruments. Publish privacy contact. Wire production email so requests can be acknowledged operationally (`EMAIL_PROVIDER` currently `none`) |

---

## 11. Security measures (technical / organizational)

| Aspect | Finding |
|--------|---------|
| Status | **PARTIAL** + **REQUIRES JORDANIAN LEGAL REVIEW** |
| Evidence (high level only) | Auth sessions (HttpOnly cookies), hashed passwords / check-in PINs, private KYC object storage, admin-gated document access, audit logging for selected actions, no card PAN/CVV in Mazare3 DB, PayTabs hosted checkout path |
| Gap | Compare controls to 2025 technical/organizational security instructions; document TOMs for counsel without exposing secrets or attack defenses. Do not claim “100% secure” |

---

## Adjacent instruments (flags for counsel — not full gap tables)

### Electronic Transactions Law No. 15 of 2015 (as amended by Law No. 1 of 2026)

| Topic | Flag |
|-------|------|
| Electronic acceptance evidence | Phase 3B `LegalAcceptance` / content hashes / booking legal snapshots — **PARTIAL** technical evidence; **REQUIRES JORDANIAN LEGAL REVIEW** for evidentiary sufficiency under amended ETL |
| Electronic notifications / contracts | Transactional email currently off (`EMAIL_PROVIDER=none`) — operational gap for notices |

### Consumer Protection Law No. 7 of 2017

| Topic | Flag |
|-------|------|
| Fair / clear pre-contract information | Launch-candidate Terms / Cancellation / Booking Terms must mirror SSOT (commission, deposit, cancellation) — consistency work in Phase 3C.1; **REQUIRES JORDANIAN LEGAL REVIEW** for consumer-facing fairness |
| Misleading claims | Ban escrow, government verification, insurer, absolute “no liability” / “all payments non-refundable” language unless true |

---

## Summary scorecard

| Topic | Status |
|-------|--------|
| DPO | **MISSING** / **REQUIRES JORDANIAN LEGAL REVIEW** |
| Processing register | **PARTIAL** / **REQUIRES JORDANIAN LEGAL REVIEW** |
| Controller / processor | **PARTIAL** / **REQUIRES JORDANIAN LEGAL REVIEW** |
| Sensitive data | **PARTIAL** / **REQUIRES JORDANIAN LEGAL REVIEW** |
| Cross-border | **MISSING** (locations) / **REQUIRES JORDANIAN LEGAL REVIEW** |
| Vendor DPAs | **MISSING** / **REQUIRES JORDANIAN LEGAL REVIEW** |
| Breach notification | **MISSING** / **REQUIRES JORDANIAN LEGAL REVIEW** |
| DPIA | **MISSING** / **REQUIRES JORDANIAN LEGAL REVIEW** |
| Consent | **PARTIAL** / **REQUIRES JORDANIAN LEGAL REVIEW** |
| DSR | **PARTIAL** / **REQUIRES JORDANIAN LEGAL REVIEW** |
| Security measures | **PARTIAL** / **REQUIRES JORDANIAN LEGAL REVIEW** |

**Blockers before Production privacy claims:** legal entity + contacts, DPO determination, MoR/payment role, transfer locations + DPAs, retention periods, breach/DPIA posture, and lawyer-reviewed Privacy Policy (not Phase 3B placeholders).
