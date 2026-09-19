# Mazare3 — Owner Privacy Consent Closure (Phase 3C.4D.7B)

INTERNAL. Local/dev architecture closure only. Does **not** activate legal documents. Does **not** touch Production. Locked Privacy Policy `1.1.2-advisor-final` and Owner Agreement `1.1.1-advisor-final` unchanged. Customer legal docs unchanged.

## 1. Status

**COMPLETE (architecture closure)** — Owner Prior Consent / LegalAcceptance separation audited; unwired `owner_account_and_marketplace_operation` classified **without** adding a blanket checkbox; inventory, Article-9 start-event notes, activation blockers, withdrawal matrix, and focused QA updated.

## 2. `owner_account_and_marketplace_operation` conclusion

| Field | Value |
|--------|--------|
| Classification | **G. COUNSEL_REVIEW_REQUIRED** |
| Secondary product note | Overlap / duplicate-purpose candidate vs purpose-specific Prior Consents + LegalAcceptance |
| Was | Corpus `PRIOR_CONSENT_CONFIRMED` but **runtime UNWIRED** |
| Now | `legalBasisStatus: LEGAL_BASIS_COUNSEL_REVIEW_REQUIRED`, `runtimeGateRequired: false` |
| UI | No checkbox; `PriorConsentCheckbox` refuses non-runtime purposes |
| API | New grants rejected (`PURPOSE_COLLECTION_SUSPENDED_COUNSEL_REVIEW`); assert refuses misconfigured assert of this purpose |
| Do NOT | Invent Jordan contractual-necessity / Art. 6 exception from code |
| Blocker | `OWNER_ACCOUNT_MARKETPLACE_PROCESSING_COUNSEL_REVIEW_REQUIRED` |

**Intended coverage (historical):** Owner/Partner account + operational marketplace participation (become-owner / partner entry).

**Covered instead by:** account Prior Consent; KYC / exact-location / payout Prior Consents; Terms + Owner Agreement + Privacy acknowledgement LegalAcceptance.

## 3. Full Owner processing-purpose map (code-traced)

| Letter | Processing | Inventory key(s) | Architecture |
|--------|------------|------------------|--------------|
| A | Owner account/profile | `customer_account` (User) + `owner_account_and_marketplace_operation` residual | Account Prior Consent + counsel residual |
| B | Contracting OperatorParty | `owner_operator_party_and_declared_property_owner` | KYC Prior Consent on authority docs; OA LegalAcceptance |
| C | Declared Property owner | same + third-party activity | Inventoried; counsel on third-party basis |
| D | Authority-to-list evidence | KYC docs + authority package | KYC Prior Consent at upload |
| E | KYC / identity | `owner_kyc_documents` | Prior Consent gated |
| F | Property draft/listing | listing media / property fields | Exact-location Prior Consent where exact PD; media gate pending separately |
| G | Exact location | `exact_property_location` | Prior Consent gated |
| H | Regulatory evidence | `property_regulatory_evidence` | KYC Prior Consent at upload; private storage |
| I | Pool/safety | `property_pool_safety_personal_data_implications` | Listing facts not over-classified; actor/free-text inventoried |
| J | Payout IBAN/beneficiary | `owner_payout_iban` | Prior Consent gated; 7A review separate |
| K | Owner communications | transactional notifications overlay | Counsel; not marketing |
| L | Support/dispute | `reviews_support_disputes` | Prior Consent gated |
| M | Fraud/security | `security_audit_logs` | Statutory candidate; no consent checkbox |
| N | Legal acceptance evidence | `legal_acceptance_evidence` | LegalAcceptance only |
| O | Commercial terms evidence | commercial-terms acceptance service | Separate from DataProcessingConsent |
| P | Audit/security logs | `security_audit_logs` | No Prior Consent |
| Q | Optional marketing | `optional_privacy_consent` | Optional; not required for Owner flows |
| R | Reviews/reliability | reviews retention + owner performance | Free-text sensitive-possible; no new Owner consent invented |

## 4. LegalAcceptance vs Prior Consent

| Concept | Store | Used for |
|---------|-------|----------|
| Terms acceptance | LegalAcceptance | Contract |
| Owner Agreement acceptance | LegalAcceptance | Partner contract |
| Privacy acknowledgement | LegalAcceptance | Notice ack ≠ Prior Consent |
| Prior Consent | DataProcessingConsent | Purpose-specific Arts 4–5 gates |
| Commercial terms | CommercialTermsAcceptance | Commercial instruments |
| Optional marketing | PrivacyConsent | Unbundled optional |

Central helper: `assertProcessingConsent({ userId, purpose, context })` → wraps `assertPriorConsentActive` **only** for `runtimeGateRequired` purposes.

## 5–9. Prior Consent results

### KYC
- Purpose: `owner_identity_and_authority_verification`
- Start: before KYC / authority / regulatory document upload
- Evidence: purpose, version, timestamp, user, sourceSurface, text hash, append-only supersede/withdraw
- Withdrawal: stops future uploads; does **not** auto-delete stored KYC / Bookings

### Exact location
- Purpose: `property_and_exact_location_processing`
- Start: before exact-location storage
- Distinct from approximate public location
- Withdrawal: stops new exact writes; public exact exposure remains forbidden; historic Booking arrival counsel

### Payout
- Purpose: `owner_payout_and_financial_processing`
- Start: before IBAN/beneficiary save
- 7A routes still assert consent; withdrawal does not confiscate settled earnings / rewrite history

## 10. Authority third-party data

Inventoried as `owner_authority_third_party_personal_data`.

- Purpose: authority assessment when declared owner/rep/manager ≠ account holder
- Source: Owner declaration / uploads
- Disclosure: Owner self + admin review
- Retention: LEGAL_REVIEW
- **No** fabricated third-party consent checkbox
- Blocker: `OWNER_AUTHORITY_THIRD_PARTY_DATA_COUNSEL_REVIEW_REQUIRED`

## 11. Regulatory evidence

Covered by `property_regulatory_evidence`; upload gated under KYC Prior Consent (existing assert). No separate consent checkbox solely because documents may contain PD.

## 12. Pool/safety

Ordinary Property pool/safety facts = listing information. PD implications limited to attestation/reviewer identity and optional free-text (`property_pool_safety_personal_data_implications`).

## 13. Marketing

Remains optional PrivacyConsent; not required for Owner onboarding, publication, Booking, or payout. Withdrawal must not affect core Owner service.

## 14. Withdrawal matrix (technical)

See `PRIOR_CONSENT_WITHDRAWAL_EFFECT_MATRIX` in `jordan-prior-consent.ts` and gate matrix doc.

Common rules:

- Owner may withdraw Prior Consent purposes that were granted
- Future consent-dependent processing stops
- Feature unavailable until re-consent where gated
- Historical evidence / financial / Booking / DSR / breach paths preserved
- Manual privacy review may be required (LEGAL_REVIEW flags)
- Withdrawal must **not**: auto-cancel confirmed Bookings; erase financial obligations; erase legal evidence; block DSR/privacy complaint

## 15. Account closure interaction

Account closure must **not** mean “delete every row.” LegalAcceptance, Prior Consent history, settlements, disputes, regulatory/KYC evidence, and audit logs may lawfully remain under retention review. No invented retention durations.

## 16. Legacy Owners

No fabricated Prior Consent, Owner Agreement acceptance, or Privacy acknowledgement. Future gated actions require grant at the relevant gate only. Unrelated payout history / legal records / privacy requests remain available.

## 17. Abandoned-application retention

`PRIVACY_RETENTION_DECISION_REQUIRED` retention categories added for:

- KYC, authority, Property drafts, regulatory, exact location, payout (if entered), consent/acceptance evidence

No purge periods invented.

## 18. Data-minimisation findings (3C.4D.3–7A)

| Finding | Status |
|---------|--------|
| `owner_account_and_marketplace_operation` as collectable Prior Consent | Suspended (was near-blanket) |
| Third-party names in authority packages | Inventoried; minimise national IDs (already policy) |
| Regulatory docs | Private storage; no public mapper |
| Pool free-text | Minimise; do not over-collect |
| Payout IBAN | Encrypted; last4 only in Owner UI; admin decrypt restricted (7A) |
| Listing snapshot (7D.6) | Immutable Booking evidence — retain; not a new consent purpose |
| No deletion this phase | Confirmed |

## 19. Privacy Policy alignment (`1.1.2-advisor-final`)

| Item | Classification |
|------|----------------|
| Account / KYC / location / payout / support Prior Consents | ALREADY_DISCLOSED (generally) / DISCLOSED_GENERALLY_BUT_COUNSEL_CONFIRM on durations |
| OperatorParty / regulatory evidence naming | DISCLOSED_GENERALLY_BUT_COUNSEL_CONFIRM → possible future PUBLIC_DISCLOSURE_GAP if counsel requires naming |
| Third-party authority PD | DISCLOSED_GENERALLY_BUT_COUNSEL_CONFIRM / counsel blocker |
| Residual owner_account purpose | INTERNAL_ONLY_NO_PUBLIC_CHANGE_NEEDED pending counsel merge/remove |
| Abandoned retention categories | INTERNAL_ONLY_NO_PUBLIC_CHANGE_NEEDED |

No Privacy 1.1.3 created.

## 20. Owner Agreement alignment (`1.1.1-advisor-final`)

No rewrite. Product notes only:

- Payout beneficiary review (7A) is operational trust/compliance; OA privacy cooperation / Customer-data duties remain counsel (`OWNER_CUSTOMER_DATA_ROLE_COUNSEL_REVIEW_REQUIRED`)
- Regulatory evidence / attestations consistent with OA compliance cooperation themes at high level
- Account closure / retention still counsel — no contradiction forced into OA text

## 21. Internal inventory changes

- New/updated activities: `owner_account_and_marketplace_operation`, `owner_authority_third_party_personal_data`, `property_pool_safety_personal_data_implications`
- Overlay statuses updated
- Retention map abandoned-onboarding rows
- Purpose defs: `runtimeGateRequired`; KYC inventory keys expanded

## 22. Activation-readiness blockers (added/kept)

- `OWNER_ACCOUNT_MARKETPLACE_PROCESSING_COUNSEL_REVIEW_REQUIRED` **added**
- `OWNER_AUTHORITY_THIRD_PARTY_DATA_COUNSEL_REVIEW_REQUIRED` **added**
- `PRIVACY_RETENTION_DECISION_REQUIRED` **added** (abandoned onboarding)
- Existing: `OWNER_CUSTOMER_DATA_ROLE_COUNSEL_REVIEW_REQUIRED`, Privacy/OA not finalised, duration, DPIA/cross-border, etc. **kept**

## 23. Consent gate service

- `assertProcessingConsent` added (API)
- `isRuntimePriorConsentGatedPurpose` / `runtimePriorConsentGatedPurposes` (shared)
- Existing wired asserts: KYC, exact location, payout, support/dispute (unchanged call sites)

## 24. UI changes

- `PriorConsentCheckbox` returns null for non-runtime purposes (defense against blanket Owner consent)
- No new generic checkbox
- Existing KYC / exact-location / payout checkboxes unchanged and purpose-specific

## 25. Confirmations

- No blanket Owner consent
- No fabricated legacy consent
- Locked legal docs unchanged
- Production untouched
- Prefer no schema migration — satisfied (enum value retained; collection suspended)

## 26. Documentation paths

- `docs/MAZARE3_OWNER_PRIVACY_CONSENT_CLOSURE_3C4D7B.md` (this file)
- `docs/MAZARE3_OWNER_CONSENT_GATE_MATRIX_3C4D7B.md`

## 27. Suggested next phase

Counsel review packet for:

1. Close `owner_account_and_marketplace_operation` (merge/remove vs alternate Jordan basis)
2. Third-party authority PD basis
3. Abandoned onboarding retention periods
4. Owner–Customer Personal Data role
5. Then only: public Privacy Policy redline if counsel finds PUBLIC_DISCLOSURE_GAP

**STOP after 3C.4D.7B.**
