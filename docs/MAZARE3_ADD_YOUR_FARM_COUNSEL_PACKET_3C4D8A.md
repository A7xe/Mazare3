# Mazare3 Jordan — Add Your Farm
# Counsel / Accountant / Founder Decision Packet
## Phase 3C.4D.8A

**Document type:** Decision packet (audit / documentation only)  
**Audience:** Jordan counsel (commercial / regulatory / privacy), accountant, founder  
**Date context:** Post 3C.4D.1–7B local architecture  
**Status of legal corpus:** DRAFT — not counsel-approved — not Production-active  

| Locked document | Version |
|-----------------|---------|
| Terms & Conditions | 1.1.2-advisor-final |
| Cancellation & Refund Policy | 1.1.2-advisor-final |
| Booking Terms | 1.1.2-advisor-final |
| Privacy Policy | 1.1.2-advisor-final |
| Owner Agreement | 1.1.1-advisor-final |

**This packet does not change code, schema, migrations, legal text, activation, or Production.**

---

## How to use this packet

Each issue below states:

1. What Mazare3 currently does (product posture)
2. Why a decision matters
3. The exact question for counsel / accountant / founder
4. What product behaviour depends on the answer
5. Conservative temporary posture
6. Launch impact tag

**Tags**

| Tag | Meaning |
|-----|---------|
| `LAUNCH_BLOCKER` | Should be resolved (or formally waived with audit) before Production legal activation |
| `COUNSEL_DECISION` | Requires Jordan legal / regulatory / privacy counsel |
| `ACCOUNTANT_DECISION` | Requires accountant (often jointly with counsel) |
| `FOUNDER_DECISION` | Business / commercial / governance choice |
| `POST_LAUNCH_OPTIONAL` | May be deferred if launch posture remains conservative |

Companion docs:

- Short counsel questionnaire: `docs/MAZARE3_COUNSEL_QUESTIONS_3C4D8A.md`
- Founder / accountant sheet: `docs/MAZARE3_FOUNDER_ACCOUNTANT_DECISIONS_3C4D8A.md`

---

## A. Regulatory & licensing

### A1. Classification of farms / chalets under tourism and related regulation

**Marker:** `REGULATORY_PROPERTY_CLASSIFICATION_COUNSEL_DECISION_REQUIRED`  
**Tags:** `LAUNCH_BLOCKER` · `COUNSEL_DECISION`

**What Mazare3 currently does**  
Supports Property activities including day use, overnight accommodation, events, swimming pool, and food service. The product deliberately does **not** assume every farm/chalet needs the same tourism licence. Applicability is assessed per requirement type; unresolved applicable requirements **fail closed** (block publication and new paid Bookings).

**Why it matters**  
Wrong classification risks unlawful listings, regulator exposure, and Customer harm. Over-classification blocks legitimate Owners; under-classification creates compliance risk.

**Question for counsel / regulatory specialist**  
1. Which Mazare3 activity combinations fall within applicable tourism-establishment regulation?  
2. Do day-use farms, overnight chalets, event farms, and mixed-use farms require different treatment?  
3. Which competent authority/approval applies in each case?  
4. May any Property type lawfully operate without tourism classification/registration but still require municipal/professional licensing?  
5. What evidence should Mazare3 require before allowing paid Bookings?

**Depends on answer**  
Which regulatory requirement rows become applicable by default; what evidence is mandatory; admin assessment playbooks.

**Conservative posture**  
Fail closed for unresolved applicable requirements. Do not auto-mark tourism licences as universally required or universally N/A.

**Blocks launch?** Yes — until classification guidance exists for launch inventory categories, or founder accepts documented temporary fail-closed playbook approved by counsel.

---

### A2. Municipal / professional licensing

**Tags:** `LAUNCH_BLOCKER` · `COUNSEL_DECISION`

**What Mazare3 currently does**  
Supports conditional municipal/professional-style assessments. Does not hard-code Greater Amman vs other municipalities.

**Why it matters**  
Licence type, issuer, and fields vary by activity and location. Incorrect evidence rules create false compliance or false blocks.

**Question for counsel**  
- Which professional/business licence is relevant by Property activity?  
- Competent authority differences by location (including Greater Amman vs others)?  
- Which document fields Mazare3 should verify?  
- Expiry/renewal requirements?  
- Any activity exemptions?

**Depends on answer**  
Requirement seeding, verification checklists, expiry behaviour.

**Conservative posture**  
Conditional applicability; unresolved applicable items block new paid Booking.

**Blocks launch?** Yes for go-live categories without a counsel-approved evidence matrix.

---

### A3. Swimming-pool regulatory scope

**Marker:** `POOL_REGULATORY_SCOPE_COUNSEL_DECISION_REQUIRED`  
**Tags:** `LAUNCH_BLOCKER` · `COUNSEL_DECISION`

**What Mazare3 currently does**  
Detects swimming-pool activity; requires a pool safety profile; creates `POOL_REGULATORY_ASSESSMENT`; does **not** automatically assume Ministry of Health public-pool approval is required. Unresolved pool applicability blocks new paid Booking. Public UI must not claim government pool certification.

**Why it matters**  
Pool classification (private vs regulated/public) drives whether MoH or other approvals are mandatory.

**Question for counsel / regulatory specialist**  
1. When is a farm/chalet pool a regulated/public swimming pool?  
2. Does day-use commercial rental affect classification?  
3. Does overnight accommodation affect classification?  
4. What approval/document/evidence is required where applicable?  
5. Does requirement depend on capacity / use / public access?  
6. Renewal/expiry behaviour?

**Depends on answer**  
When pool assessment is “applicable vs N/A”; evidence checklist; Customer disclosures.

**Conservative posture**  
Unresolved pool assessment blocks new paid Booking; no MoH auto-assumption; no “government approved / safe” badges.

**Blocks launch?** Yes for pool-offering Properties until counsel guidance or fail-closed playbook is approved.

---

### A4. Civil liability insurance

**Tags:** `COUNSEL_DECISION` · `ACCOUNTANT_DECISION` · `FOUNDER_DECISION` · (may be `LAUNCH_BLOCKER` if counsel says legally mandatory for launch categories)

**What Mazare3 currently does**  
Supports conditional insurance requirements. Does **not** require insurance globally.

**Why it matters**  
Legal mandate vs commercial risk policy must stay separate.

**Questions**  
**LEGAL REQUIREMENT (counsel):** Which Property categories legally require civil-liability insurance? Minimum legally required scope? Evidence and renewal?  
**MAZARE3 OPTIONAL RISK POLICY (founder, with counsel input):** Should Mazare3 require insurance even when not legally mandatory?

**Depends on answer**  
Whether insurance becomes a bookability gate for some/all activities.

**Conservative posture**  
Keep conditional; do not invent a universal legal insurance mandate in product copy.

**Blocks launch?** Only if counsel confirms a legal mandate for launch Property types without product support — then become `LAUNCH_BLOCKER`. Otherwise founder optional policy may be `POST_LAUNCH_OPTIONAL`.

---

## B. Privacy & data

### B1. Owner account / marketplace processing purpose

**Marker:** `OWNER_ACCOUNT_MARKETPLACE_PROCESSING_COUNSEL_REVIEW_REQUIRED`  
**Tags:** `LAUNCH_BLOCKER` · `COUNSEL_DECISION`

**What Mazare3 currently does**  
Purpose `owner_account_and_marketplace_operation` is **suspended** (not collected, not asserted). Classified counsel-review because it overlaps account Prior Consent, Owner Agreement / Terms / Privacy acknowledgement, KYC, exact-location, and payout Prior Consents. **No blanket consent checkbox.**

**Why it matters**  
Unnecessary consent creates fake compliance and withdrawal complexity. Missing architecture creates PDPL risk.

**Question for privacy counsel**  
Should this purpose be:  
**A** removed as duplicate · **B** reclassified as essential contractual/service processing · **C** split into narrower purposes · **D** retained with another lawful architecture · **E** other  

Do **not** answer only “add consent?” — Mazare3 wants to **avoid unnecessary consent**.

**Depends on answer**  
Inventory/status; whether any residual gate is needed; Privacy Policy wording later.

**Conservative posture**  
Keep suspended; rely on purpose-specific Prior Consents + LegalAcceptance; fail closed on high-risk gates (KYC / location / payout).

**Blocks launch?** Yes for Privacy / Owner activation readiness until counsel closes the reclassification.

---

### B2. Third-party authority Personal Data

**Marker:** `OWNER_AUTHORITY_THIRD_PARTY_DATA_COUNSEL_REVIEW_REQUIRED`  
**Tags:** `LAUNCH_BLOCKER` · `COUNSEL_DECISION`

**What Mazare3 currently does**  
May process Personal Data of declared Property owner, authorised representative, manager, or other authority-granting individual. Mazare3 does **not** fabricate consent from that third party. Data stored privately for admin/Owner review.

**Why it matters**  
Indirect Personal Data triggers notice / basis / DSR obligations that Owner declaration alone may not satisfy.

**Question for privacy counsel**  
Proper processing basis/status; privacy notice mechanism; indirect-data notification obligations and exceptions; retention; DSR handling; whether Owner declaration is operationally sufficient.

**Depends on answer**  
Notice templates; possible Owner instructions; retention; admin handling of third-party DSRs.

**Conservative posture**  
Minimise fields; private storage; no fake third-party consent UI; counsel blocker retained.

**Blocks launch?** Yes for Privacy activation / authority go-live without counsel basis memo.

---

### B3. Owner–Customer data role

**Marker:** `OWNER_CUSTOMER_DATA_ROLE_COUNSEL_REVIEW_REQUIRED`  
**Tags:** `LAUNCH_BLOCKER` · `COUNSEL_DECISION`

**What Mazare3 currently does**  
Owner Agreement deliberately does **not** declare every Owner as controller, processor, or independent controller. Owners receive Customer data necessary to fulfil Bookings under platform rules. No invented public role label.

**Why it matters**  
Wrong role language creates PDPL / contractual misrepresentation.

**Question for privacy counsel**  
- Is Owner independent controller for Property service delivery?  
- Any processing as processor for Mazare3?  
- Context-dependent?  
- Need separate data-sharing / C2C terms?  
- What Customer data should Owners receive?  
- Retention/use restrictions?

**Depends on answer**  
Future Owner Agreement / Privacy redline (not yet); Customer data minimisation to Owners; contractual schedules.

**Conservative posture**  
Do not invent role labels in public docs; minimise Customer data shared for fulfilment; counsel blocker retained.

**Blocks launch?** Yes before Owner Agreement / Privacy Production activation.

---

### B4. Retention schedule

**Marker:** `PRIVACY_RETENTION_DECISION_REQUIRED`  
**Tags:** `LAUNCH_BLOCKER` · `COUNSEL_DECISION` · `ACCOUNTANT_DECISION`

**What Mazare3 currently does**  
No invented retention periods. Abandoned Owner onboarding datasets and other categories flagged for founder/counsel decision. Evidence rows are generally retained (not hard-deleted on withdrawal).

**Why it matters**  
Retention that is too short undermines legal/financial evidence; too long increases PDPL risk.

**Decision table (durations not decided — counsel/accountant to fill)**

| Category | Trigger (current technical) | Ask: min / max / delete-anonymise / legal-hold |
|----------|----------------------------|------------------------------------------------|
| Unsuccessful / abandoned Owner onboarding | Incomplete partner flow | |
| KYC documents | Upload / verification decision | |
| Authority evidence | Upload / declaration | |
| Regulatory evidence | Upload / decision | |
| Exact location | Property save | |
| Rejected Owner records | Rejection event | |
| Property drafts | Draft create | |
| Payout / IBAN data | Profile save | |
| Payout review evidence | Admin review events | |
| Booking listing snapshots | Booking create | |
| Removed listing media referenced by snapshots | Soft-remove after Booking | |
| LegalAcceptance evidence | Accept event | |
| Prior Consent evidence | Grant / withdraw | |
| Financial / accounting records | Payment / settlement | |
| Disputes / security logs | Event time | |

**Depends on answer**  
Privacy Policy retention placeholders; purge jobs (future); DSR erasure limits.

**Conservative posture**  
No automated purge of high-risk / financial / legal evidence until schedule approved.

**Blocks launch?** Yes for Privacy Policy activation (retention placeholders).

---

### B5. Provider / data-transfer information

**Tags:** `LAUNCH_BLOCKER` · `COUNSEL_DECISION` · `FOUNDER_DECISION`

**What Mazare3 currently does**  
Privacy launch remains blocked on unresolved provider identity, regions, cross-border transfers, processor register sufficiency, and DPIA where required. Placeholders remain in Privacy corpus.

**Missing-information checklist (do not invent answers)**

| Item | Owner | Status |
|------|-------|--------|
| Payment provider legal name + privacy contact + processing region | Founder + PSP contract + counsel | Unresolved placeholder |
| Database provider legal name / region | Founder + provider | Unresolved |
| Object storage legal name / region | Founder + provider | Unresolved |
| App hosting provider / region | Founder | Unresolved |
| Email provider (if active) | Founder | Unresolved |
| Google Sign-In processing geography | Founder + counsel | Unresolved |
| Cross-border DPIAs where required | Counsel | Required before relying on outside-Jordan transfers |
| Article 14 transfer register legal sufficiency | Counsel | Counsel review required |
| DPO appointment / public privacy contact | Founder + counsel | Not appointed / contact gaps |

**Conservative posture**  
No Privacy Production activation until checklist closed or counsel-approved interim disclosures.

**Blocks launch?** Yes for Privacy Policy activation.

---

## C. Commercial / financial / payout

### C1. Third-party payout beneficiary

**Marker:** `PAYOUT_THIRD_PARTY_BENEFICIARY_COUNSEL_CONFIRMATION_REQUIRED`  
**Tags:** `LAUNCH_BLOCKER` (unless launch explicitly disables third-party) · `COUNSEL_DECISION` · `ACCOUNTANT_DECISION` · `FOUNDER_DECISION`

**What Mazare3 currently does**  
Supports relationship `authorised_third_party` in data model but deliberately does **not** make it payout READY.

**Question**  
May Mazare3 pay Owner Earnings to a third-party beneficiary? Under what written authority? Evidence? Tax/accounting? Fraud/AML/KYC? Or prohibit at launch?

**Conservative launch option (recommended until counsel clears)**  
Only `operator_self` and `operator_legal_entity` may become payout READY. Third-party remains blocked.

**Blocks launch?** Payout release to third parties: blocked today. Launch of marketplace can proceed with third-party disabled if founder confirms that policy.

---

### C2. Payment-processing fee treatment

**Marker:** `OWNER_PAYMENT_FEE_TREATMENT_REQUIRES_FOUNDER_DECISION`  
**Tags:** `LAUNCH_BLOCKER` · `FOUNDER_DECISION` · `ACCOUNTANT_DECISION`

**What Mazare3 currently does**  
Owner Agreement assumes **no** separate PSP/payment-processing fee deducted from Owner Earnings. Code deducts documented Owner financial adjustments, not a separate Owner PSP fee.

**Options**  
**A** Mazare3 absorbs PSP fees within platform commission/economics (**current product recommendation for launch**).  
**B** Owner bears an explicitly disclosed separate fee.

**Depends on answer**  
Owner Agreement wording; settlement statements; Customer/Owner economics disclosure.

**Conservative posture**  
Keep Option A until founder decides otherwise; do not silently deduct a new PSP fee.

**Blocks launch?** Yes for Owner Agreement activation until founder confirms Option A or B.

---

### C3. Settlement cycle

**Marker:** `OWNER_SETTLEMENT_CYCLE_REQUIRES_FOUNDER_DECISION`  
**Tags:** `LAUNCH_BLOCKER` · `FOUNDER_DECISION` · `ACCOUNTANT_DECISION`

**What Mazare3 currently does**  
Contractual placeholder `[[OWNER_SETTLEMENT_CYCLE]]`. Code may have an operational default; that default must **not** become a contractual promise without founder approval.

**Question**  
Settlement frequency; post-visit holding period; minimum payout threshold; weekends/bank-day behaviour; dispute/chargeback holds; payout failure behaviour.

**Depends on answer**  
Owner Agreement placeholder fill; Customer/Owner expectations; ops playbooks.

**Conservative posture**  
Do not publish a contractual cycle until founder/accountant lock it. Operational holds for fraud/dispute remain available.

**Blocks launch?** Yes for Owner Agreement activation.

---

### C4. Owner financial adjustments

**Marker:** `OWNER_FINANCIAL_ADJUSTMENT_COUNSEL_REVIEW_REQUIRED`  
**Tags:** `LAUNCH_BLOCKER` · `COUNSEL_DECISION`

**What Mazare3 currently does**  
Owner-caused cancellation adjustments: **0% / 10% / 20%** of merchant Booking value with **min 10 JOD / max 50 JOD** where adjustment applies. Applied against **future Settlement**, not automatic card debit. Confirmed Owner no-show / unjustified access denial uses 20% tier (same clamp). Double recovery of the same loss is prohibited in OA draft.

**Question for counsel**  
Enforceability / characterisation; preferred legal term (financial adjustment / agreed compensation / other); court-adjustment risk; whether min/max should change.

**Depends on answer**  
Owner Agreement wording; dispute playbooks; possible future code/config change (not now).

**Conservative posture**  
Keep current structure as DRAFT pending counsel; do not increase severity without counsel.

**Blocks launch?** Yes for Owner Agreement activation.

---

### C5. Liability / indemnity

**Markers:** `LIABILITY_CAP_COUNSEL_REVIEW_REQUIRED` · `INDEMNITY_ENFORCEABILITY_COUNSEL_REVIEW_REQUIRED`  
**Tags:** `LAUNCH_BLOCKER` · `COUNSEL_DECISION`

**Current OA structure (summary only)**  
- Mandatory Jordanian liability that cannot be excluded remains.  
- Owner not liable for Mazare3 negligence / system fault / misconduct.  
- Owner may be responsible for documented third-party claims arising directly from unlawful listing, lack of authority, infringing Owner content, Owner fraud/wilful misconduct, or material Owner breach.  
- Not a blanket unlimited indemnity for everything platform-related.  
- Liability **cap formula** still pending counsel (blocker).

**Question for counsel**  
Appropriate liability cap; exclusions; fraud/wilful misconduct; Property injury/damage; platform fault allocation; third-party claims; enforceability under Jordanian law.

**Depends on answer**  
Owner Agreement redline (future phase after decisions).

**Conservative posture**  
Do not invent a numeric cap; keep DRAFT markers; do not activate OA.

**Blocks launch?** Yes for Owner Agreement activation.

---

### C6. Tax / licence / invoice treatment

**Marker:** `OWNER_TAX_LICENCE_ACCOUNTANT_COUNSEL_REVIEW_REQUIRED`  
**Tags:** `LAUNCH_BLOCKER` · `ACCOUNTANT_DECISION` · `COUNSEL_DECISION`

**What Mazare3 currently does**  
Does not invent tax percentages. Settlement and commercial records exist; tax field completeness for statements is unresolved.

**Question**  
Owner tax responsibilities; Mazare3 invoicing; commission invoice treatment; sales tax; withholding if any; individual vs company Owner differences; documentation to retain; required tax fields on settlement statements.

**Depends on answer**  
Invoicing product; OA/Privacy tax language; accounting ops.

**Conservative posture**  
No invented tax rates in public docs; accountant memo before go-live invoicing claims.

**Blocks launch?** Yes for OA/commercial activation claims about tax treatment.

---

## D. Operations after confirmation

### D1. Existing Booking after later compliance failure

**Tags:** `LAUNCH_BLOCKER` · `COUNSEL_DECISION` · `FOUNDER_DECISION`

**What Mazare3 currently does (safe behaviour)**  
If regulatory readiness fails **after** a Booking is confirmed:  
- no automatic cancellation  
- no automatic refund  
- no automatic Owner penalty  
- balance payment not blocked solely because later Property readiness changed  
- admin review signal created  

**Question for counsel**  
Decision tree for: document expires before visit; authority disputed; licence revoked; serious pool issue; regulator orders stop.

Options to assign per scenario:  
**HONOUR BOOKING · SUSPEND · RESCHEDULE WITH CUSTOMER CONSENT · CANCEL + REFUND · OTHER**  
Plus Owner financial consequences where legally appropriate.

**Depends on answer**  
Ops playbooks; future automation; Customer communications; OA/Booking Terms consistency.

**Conservative posture**  
Keep current non-automatic behaviour until counsel tree exists; escalate to admin/counsel for serious cases.

**Blocks launch?** Yes for a Production ops playbook; product can remain fail-closed for *new* Bookings meanwhile.

---

### D2. Booking listing snapshot

**Tags:** `COUNSEL_DECISION` · (disclosure may be `POST_LAUNCH_OPTIONAL` if counsel says already covered)

**What Mazare3 currently does**  
New Bookings preserve immutable listing facts (details, amenities, capacity, rules, activities, pool/safety, media refs, legal-policy versions, regulatory readiness summary). Legacy Bookings are **not** falsely backfilled.

**Question for counsel**  
Any public Privacy/Terms/Booking Terms disclosure change needed? Evidentiary retention expectations? Media retention limits? Dispute/access rules?

**Depends on answer**  
Possible future redline; retention schedule; Customer/Owner access policies.

**Conservative posture**  
Retain snapshots; no false legacy backfill; private regulatory evidence not snapshotted into Customer views.

**Blocks launch?** Usually no if counsel confirms general Booking/contract evidence already disclosed; confirm in questionnaire.

---

### D3. “Verified by Mazare3” wording

**Tags:** `COUNSEL_DECISION` · may be `POST_LAUNCH_OPTIONAL` if current wording OK

**What Mazare3 currently does**  
Platform-level verification only. Must **not** imply government certification, title certification, safety guarantee, tourism licence, or pool certification. Commission 15% is platform verification, independent of regulatory READY.

**Question**  
Does existing public wording need refinement?

**Conservative posture**  
Keep platform-only meaning; no government/safety badges.

**Blocks launch?** Only if counsel finds misleading wording requiring pre-launch redline.

---

### D4. Regulatory RBAC

**Marker:** `REGULATORY_RBAC_HARDENING_PENDING`  
**Tags:** `LAUNCH_BLOCKER` · `FOUNDER_DECISION` (SECURITY/OPERATIONS)

**What Mazare3 currently does**  
ADMIN / SUPER_ADMIN protect regulatory review. Granular capabilities not fully separated.

**Question for founder / security governance**  
Who may: review evidence; decide applicability; confirm N/A; verify evidence; approve payout beneficiary; view full payout data; platform-verify Property?

**Depends on answer**  
Future RBAC implementation; audit design.

**Conservative posture**  
Limit Production admin accounts; dual-control for high-risk actions where feasible; treat as required before Production scale.

**Blocks launch?** Yes for Production security readiness (operational), even if external legal interpretation is not the main issue.

---

## E. Legal entity publication values

**Tags:** `LAUNCH_BLOCKER` · `FOUNDER_DECISION`

Populate only after founder confirms final publication values. Do **not** expose unnecessary shareholder/private information in public docs.

| Placeholder | Needed for |
|-------------|------------|
| `LEGAL_ENTITY_NAME` / AR / EN | All public legal docs |
| `LEGAL_ENTITY_INTRO_AR` / `EN` | Introductions |
| `LEGAL_FORM_AR` / `EN` | Entity description |
| `REGISTERED_ADDRESS` (+ AR/EN) | Contact / identity |
| `COMMERCIAL_REGISTRATION_NUMBER` | Identity |
| `NATIONAL_ESTABLISHMENT_NUMBER` | Identity (if used) |
| `LEGAL_CONTACT_EMAIL` | Legal contact |
| `PRIVACY_CONTACT_EMAIL` / DPO contact | Privacy |
| Effective / last-updated dates | Privacy & contracts |

**Do not activate docs** until values + counsel approval + founder publication approval.

---

## Master decision table

| ID | Issue | Decision owner | Current product posture | Question requiring decision | Conservative launch posture | Blocks launch? | Affected code/docs | Decision received? | Implementation needed? |
|----|-------|----------------|-------------------------|----------------------------|----------------------------|----------------|--------------------|--------------------|------------------------|
| AYF-01 | Property tourism/regulatory classification | REGULATORY_SPECIALIST / COUNSEL | Conditional applicability; fail closed | Activity matrix + competent authority + evidence | Fail closed unresolved applicable | **Yes** | Regulatory requirements / bookability | ☐ | Yes after decision |
| AYF-02 | Municipal / professional licensing | COUNSEL | Conditional assessments | Licence types / issuers / fields / expiry / exemptions | Fail closed unresolved applicable | **Yes** | Regulatory evidence model | ☐ | Yes after decision |
| AYF-03 | Pool regulatory scope | REGULATORY_SPECIALIST / COUNSEL | Pool assessment; no MoH auto | When regulated; evidence; renewal | Unresolved blocks new paid Booking | **Yes** | Pool safety + regulatory | ☐ | Yes after decision |
| AYF-04 | Civil liability insurance (legal) | COUNSEL | Conditional; not global | Legal mandate by category | No invented universal mandate | If counsel says mandatory | Insurance requirement rows | ☐ | Maybe |
| AYF-05 | Insurance above legal minimum | FOUNDER | Optional commercial policy unset | Require commercially? | Optional / post-launch OK | No if legal min clear | Policy config | ☐ | Maybe |
| AYF-06 | Owner account marketplace purpose | PRIVACY_COUNSEL | Suspended; no blanket consent | A–E reclassification | Keep suspended | **Yes** (Privacy/OA readiness) | Prior consent corpus / inventory | ☐ | Inventory/docs; maybe gates |
| AYF-07 | Third-party authority PD | PRIVACY_COUNSEL | Inventoried; no fake consent | Basis; notice; DSR; retention | Minimise + private | **Yes** | Authority package | ☐ | Notice/process |
| AYF-08 | Owner–Customer data role | PRIVACY_COUNSEL | No invented controller/processor label | Role; sharing terms; data scope | Minimise fulfilment data | **Yes** | OA / Privacy (future) | ☐ | Likely OA/Privacy redline |
| AYF-09 | Retention schedule | PRIVACY_COUNSEL + ACCOUNTANT | No invented periods | Min/max/trigger/delete/hold per category | No auto-purge high-risk | **Yes** | Privacy placeholders / jobs | ☐ | Yes |
| AYF-10 | Providers / transfers / DPIA | FOUNDER + COUNSEL | Placeholders; blockers | Complete checklist | No Privacy activation | **Yes** | Privacy / transfer register | ☐ | Disclosures + contracts |
| AYF-11 | Third-party payout beneficiary | COUNSEL + ACCOUNTANT + FOUNDER | Model exists; not READY | Permit or prohibit; evidence; tax/AML | Only self / legal entity READY | **Yes** for third-party payout | Payout beneficiary | ☐ | If permit: gates/evidence |
| AYF-12 | PSP fee treatment | FOUNDER + ACCOUNTANT | Absorb in economics (rec.) | Option A vs B | Keep A | **Yes** (OA) | OA / settlement | ☐ | If B: code + OA |
| AYF-13 | Settlement cycle | FOUNDER + ACCOUNTANT | `[[OWNER_SETTLEMENT_CYCLE]]` | Cadence; holds; thresholds | No contractual promise from code default | **Yes** (OA) | OA placeholder / ops | ☐ | Config + OA text |
| AYF-14 | Owner financial adjustments | COUNSEL | 0/10/20% · 10–50 JOD · future settlement | Characterisation; enforceability | Keep DRAFT structure | **Yes** (OA) | OA / adjustment logic | ☐ | Maybe wording only |
| AYF-15 | Liability cap | COUNSEL | Cap pending | Cap formula; exclusions | No invented cap; OA DRAFT | **Yes** (OA) | OA | ☐ | OA redline |
| AYF-16 | Indemnity enforceability | COUNSEL | Narrow documented indemnity DRAFT | Enforceability under Jordan law | Keep narrow DRAFT | **Yes** (OA) | OA | ☐ | OA redline |
| AYF-17 | Tax / invoice / licence wording | ACCOUNTANT + COUNSEL | No invented rates | Tax/invoice duties; statement fields | No public tax invention | **Yes** | OA / invoicing | ☐ | Ops + possible product |
| AYF-18 | Post-confirm compliance failure | COUNSEL + FOUNDER | No auto cancel/refund/penalty | Decision tree per scenario | Admin escalate; keep safe defaults | **Yes** (ops playbook) | Bookability / support | ☐ | Playbook; later automation |
| AYF-19 | Listing snapshot disclosure | COUNSEL | Immutable snapshots for new Bookings | Public disclosure / retention / access | Retain; no legacy backfill | Confirm | Privacy/Terms/Booking | ☐ | Maybe redline |
| AYF-20 | Platform verification wording | COUNSEL | Platform-only meaning | Any refinement needed? | No government/safety implication | Only if misleading | Public copy / Verification page | ☐ | Maybe copy |
| AYF-21 | Regulatory / payout RBAC | SECURITY/OPERATIONS + FOUNDER | Admin reuse | Role matrix | Limit admins; dual-control preferred | **Yes** (Prod security) | Admin authZ | ☐ | Yes before scale |
| AYF-22 | Legal entity publication values | FOUNDER | Placeholders | Final public identity values | Do not activate until filled | **Yes** | All legal docs | ☐ | Fill placeholders |
| AYF-23 | Prior Consent duration / Art. 5 | PRIVACY_COUNSEL | Duration LEGAL_REVIEW | Duration architecture | Keep review status | **Yes** (Privacy) | Consent corpus | ☐ | Policy + maybe code |
| AYF-24 | Customer legal corpus activation | COUNSEL + FOUNDER | DRAFT advisor-final | Approve + publish | No activation | **Yes** | Terms/Cancel/Booking/Privacy | ☐ | Activation process |
| AYF-25 | Owner Agreement activation | COUNSEL + FOUNDER | DRAFT 1.1.1-advisor-final | Approve after blockers | No activation | **Yes** | OA | ☐ | Activation process |

---

## Highest-priority five (recommended sequence)

1. **AYF-01 / AYF-03** — Regulatory classification + pool scope (defines what “READY” means)  
2. **AYF-13 / AYF-12** — Settlement cycle + PSP fee (Owner commercial promise)  
3. **AYF-08 / AYF-06 / AYF-07** — Privacy roles and Owner processing architecture  
4. **AYF-15 / AYF-16 / AYF-14** — Liability, indemnity, financial adjustments  
5. **AYF-09 / AYF-10 / AYF-22** — Retention, providers, legal entity publication  

---

## Contradictions vs current product behaviour

None identified that require emergency code change. Known **intentional** gaps (not contradictions):

- Code settlement default ≠ contractual `[[OWNER_SETTLEMENT_CYCLE]]` (by design).  
- Third-party beneficiary exists in model but cannot become READY (by design).  
- Pool assessment exists without MoH auto-applicability (by design).  
- Post-confirm regulatory failure does not auto-cancel Bookings (by design; needs counsel tree).  
- Suspended Owner marketplace Prior Consent purpose (by design after 3C.4D.7B).

---

## After decisions — recommended next phase

**Launch Compliance Preflight (post-decision):**

1. Record counsel/accountant/founder answers in a decision log.  
2. Implement only approved product changes (gates, copy, RBAC, payout policy).  
3. Counsel redlines to locked docs **only if required** (new version; not this phase).  
4. Fill placeholders; complete provider/DPIA evidence.  
5. Run full activation readiness + Production legal activation checklist.  
6. Then Production cutover planning.

**STOP after 3C.4D.8A — no automatic implementation.**
