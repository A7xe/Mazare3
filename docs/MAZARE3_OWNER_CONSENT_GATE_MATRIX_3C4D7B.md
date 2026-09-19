# Mazare3 — Owner Consent Gate Matrix (Phase 3C.4D.7B)

INTERNAL product/privacy architecture matrix. Not legal advice. Locked Privacy Policy `1.1.2-advisor-final` and Owner Agreement `1.1.1-advisor-final` unchanged.

| Purpose | Data | Sensitive? | Start event | Prior Consent? | LegalAcceptance? | Privacy acknowledgement? | Gate | Withdrawal effect | Retention status | Counsel status |
|--------|------|------------|-------------|----------------|------------------|--------------------------|------|-------------------|------------------|----------------|
| Account registration / auth | name, email, phone, password hash, auth identities | No | Before marketplace account operation (after account Prior Consent UI) | Yes — `account_registration_and_authentication` | Terms at first-run | Privacy ack at first-run | First-run / account legal gate | Stops future consent-dependent account processing; DSR remains | LEGAL_REVIEW | Duration LEGAL_REVIEW |
| Owner Terms / OA | LegalAcceptance evidence | N/A (evidence) | Before Owner Agreement–gated surfaces | No | Yes — Terms + `owner_agreement` | Privacy ack separate | `require-terms-acceptance` / Owner Agreement gate | N/A (not Prior Consent) | LEGAL_REVIEW (immutable evidence) | OA not activated |
| Owner residual marketplace operation | OwnerProfile / partner status operational metadata | No | Become-owner / partner entry (processing already occurs under adjacent gates) | **No runtime Prior Consent** — purpose `owner_account_and_marketplace_operation` **COUNSEL_REVIEW_REQUIRED** | OA / Terms where applicable | Privacy ack | **None for this purpose** (do not checkbox) | Legacy withdraw auditable only | LEGAL_REVIEW | `OWNER_ACCOUNT_MARKETPLACE_PROCESSING_COUNSEL_REVIEW_REQUIRED` |
| KYC / identity docs | identity/authority docs, storage keys | HIGH_RISK / sensitive-possible | Before first KYC upload/storage | Yes — `owner_identity_and_authority_verification` | No | No | Partner KYC upload + server `assertPriorConsentActive` | No new KYC uploads; stored KYC not auto-erased | LEGAL_REVIEW / statutory may continue | Duration + DPIA |
| OperatorParty / declared Property owner | legal name, contacts, authority basis | No (fields) | Before OperatorParty / authority package persistence | Covered by KYC Prior Consent at authority doc upload | OA may require cooperation | No | Authority package + KYC consent on doc upload | Future authority uploads stop if KYC consent withdrawn | LEGAL_REVIEW | Third-party PD counsel |
| Authority third-party PD | declared owner / rep / manager names; incidental doc PD | Sensitive-possible | When Owner declares/uploads third-party-related authority data | No separate third-party consent UI | No | No | Same KYC/authority gates; **no fake third-party checkbox** | Counsel on third-party DSR | LEGAL_REVIEW | `OWNER_AUTHORITY_THIRD_PARTY_DATA_COUNSEL_REVIEW_REQUIRED` |
| Regulatory evidence | private regulatory documents | HIGH_RISK / sensitive-possible | Before regulatory evidence upload | Yes — same KYC purpose (upload assert) | No | No | Regulatory upload + `assertPriorConsentActive(KYC)` | No new uploads; evidence not auto-deleted | LEGAL_REVIEW | Inventory covered |
| Exact Property location | exact address/coords/arrival | Not classified sensitive; restricted | Before exact-location storage | Yes — `property_and_exact_location_processing` | No | No | Owner property create/save + server assert | No new exact-location writes; historic Booking arrival counsel | LEGAL_REVIEW | Duration LEGAL_REVIEW |
| Approximate public location | public approx | No | Listing publication | No separate | No | No | Listing completeness / bookability | N/A | LEGAL_REVIEW | Distinguish from exact |
| Pool / safety Property facts | pool facts | Ordinary listing facts — not over-classified | Property pool/safety save | No separate Prior Consent | No | No | Pool/safety Owner/admin flows | N/A | LEGAL_REVIEW | Attestor/reviewer IDs inventoried |
| Pool/safety free-text / actor IDs | attestation actor, reviewer, free-text | Sensitive-possible (free-text) | Attestation/review event | No separate | No | No | Existing pool/safety | Counsel if DSR on free-text | LEGAL_REVIEW | Inventory activity added |
| Payout IBAN / beneficiary | IBAN cipher, bank, beneficiary | SENSITIVE_PERSONAL_DATA_FINANCIAL | Before first sensitive payout-data save | Yes — `owner_payout_and_financial_processing` | No | No | Payout setup + server assert (7A cannot bypass) | No new IBAN collection; settlements/history preserved | LEGAL_REVIEW / statutory may continue | + third-party beneficiary counsel flag |
| Commercial terms acceptance | CommercialTermsAcceptance evidence | N/A (evidence) | Before commercial-terms-gated surfaces | No | Commercial acceptance (separate) | No | Commercial terms service | N/A | LEGAL_REVIEW | Keep separate from Prior Consent |
| Optional marketing | PrivacyConsent marketing | No | When Owner opts in | Optional PrivacyConsent (not DataProcessingConsent service Prior Consent) | No | No | Account privacy prefs — **not** onboarding/publication/Booking/payout required | Easy withdraw; core Owner service continues | LEGAL_REVIEW | Unbundled |
| Support / dispute (Owner as actor) | ticket/dispute text | Sensitive-possible | Before ticket/dispute create | Yes — `support_and_dispute_processing` | No | No | Support/dispute create assert | Future marketplace support gated; DSR portal open | LEGAL_REVIEW | — |
| Legal acceptance evidence | Terms/OA/Privacy ack rows | N/A | On accept event | No | Yes | Yes (privacy ack) | LegalAcceptance service | Do not erase | LEGAL_REVIEW | Art. 6(A)(5) candidate |
| Prior Consent evidence | DataProcessingConsent rows | N/A | On grant/withdraw | Self | No | Linked notice version optional | Append-only grant/supersede/withdraw | Auditable history; no silent overwrite | LEGAL_REVIEW | — |
| Security / audit logs | audit metadata | Sensitive-possible | Event time | No | No | No | System | Statutory candidate | LEGAL_REVIEW | Art. 6(A)(5) candidate |
| Fraud / security | security processing | Mixed | Detection/response | No Prior Consent checkbox | No | No | Operational | Counsel | LEGAL_REVIEW | Do not invent basis |
| Reviews / reliability (Owner PD) | review text, reliability signals | Sensitive-possible (free text) | Review publish / reliability update | No Owner-specific Prior Consent invented this phase | No | No | Existing review flows | Counsel | LEGAL_REVIEW | Inventory via reviews_support / performance |
| Privacy DSR / complaint | request content | Mixed | On DSR submit | **Must NOT require Prior Consent** | No | No | DSR service (explicit no assert) | N/A | LEGAL_REVIEW | Art. 6(A)(5) candidate |
| Abandoned onboarding datasets | KYC, authority, drafts, regulatory, location, payout, consents | Mixed | Upload/create without completion | Per purpose above when processing starts | Per gates | Per gates | No auto-purge | Retention **PRIVACY_RETENTION_DECISION_REQUIRED** | LEGAL_REVIEW | Founder/counsel |

## Gate sequence (Owner journey)

1. **Account creation** — Terms + Privacy acknowledgement + `account_registration_and_authentication` Prior Consent (first-run). Marketing optional off-by-default.
2. **Owner onboarding start** — Owner Agreement LegalAcceptance where gated; **no** `owner_account_and_marketplace_operation` checkbox.
3. **KYC** — Prior Consent `owner_identity_and_authority_verification` before document processing.
4. **OperatorParty / authority evidence** — KYC Prior Consent on authority document upload; third-party PD inventoried without fake consent.
5. **Property draft** — exact-location Prior Consent before exact location writes; approximate/listing fields follow listing rules.
6. **Regulatory evidence** — KYC Prior Consent at upload (same purpose); private storage.
7. **Pool/safety** — no new Prior Consent; attestation actor IDs inventoried.
8. **Submit for review / publication** — bookability/authority/regulatory READY rules; marketing not required.
9. **Booking participation** — Customer Prior Consents on Customer side; Owner Customer-data role remains counsel blocker.
10. **Payout setup** — `owner_payout_and_financial_processing` before IBAN/beneficiary save.
11. **Payout release** — 7A beneficiary readiness (separate from consent); consent still required to have stored payout data.

## Explicit non-gates

- No blanket “consent to all Mazare3 processing” checkbox.
- Privacy acknowledgement ≠ Prior Consent.
- Owner Agreement ≠ KYC / payout / marketing consent.
- Commercial terms ≠ payout Prior Consent.
- Marketing not required for onboarding, publication, Booking, or payout.
