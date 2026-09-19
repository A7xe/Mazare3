# Mazare3 — Owner Onboarding Flow Map (Add Your Farm)

**Phase:** 3C.4D.1 — AUDIT ONLY  
**Source of truth:** Implemented code (not legal drafts)

---

## Exact stage sequence

```
[Public CTA]
  AddFarmLink / home / bottom-nav / footer / contact
  resolveAddFarmHref()
        │
        ├─ authenticated + OwnerStatus.approved ──► /owner/properties/new  (Add Farm)
        └─ else ──────────────────────────────────► /become-owner
                │
                ├─ guest ──► /auth?returnUrl=…/become-owner
                └─ logged-in (non-admin)
                        │
                        ▼
[Partner / Owner onboarding wizard]
  Steps: entity → contact → documents → review
  APIs: GET/PATCH /owner/onboarding
        GET /owner/onboarding/requirements
        POST /owner/onboarding/documents  (+ KYC Prior Consent)
        POST /owner/partner-agreement/accept
        POST /owner/onboarding/submit
                        │
                        ▼
[Admin partner review]
  Document review → approve / reject / changes_requested / suspend
  Approve ⇒ UserRole.owner + OwnerStatus.approved
                        │
                        ▼
[Optional post-approval]
  /owner/payout  (IBAN + payout Prior Consent) — NOT required for partner submit
  OwnerAgreementGate soft reacceptance (listings; payouts exempt)
                        │
                        ▼
[Add Farm / Property]
  Steps: basic → location → photos → pricing → review
  POST /owner/properties/draft
  PATCH property / media / availability
  POST …/submit-review  → pending_review
                        │
                        ▼
[Admin Property review]
  pending_review → changes_requested | approved | rejected
  approved → published (media completeness)
  Optional: set Property.verificationStatus (platform_verified etc.)
                        │
                        ▼
[Marketplace]
  Discoverable: published + owner.approved + listing completeness fields
  Bookable: published + owner.approved
```

---

## Stage detail & blocking gates

### 1. Public CTA
| Item | Detail |
|------|--------|
| Routes | `/become-owner`, `/owner/properties/new` |
| Files | `add-farm-entry.ts`, `add-farm-link.tsx`, home, bottom-nav, footer |
| Blockers | None (public) |

### 2. Auth / account
| Actor | Gate |
|-------|------|
| Guest | Must authenticate before wizard mutations |
| Customer | May create OwnerProfile on first meaningful PATCH |
| Approved Owner | Skip to Add Farm |
| Rejected / suspended | Status panel locked; no self-edit |
| Admin | Cannot apply |

### 3. Partner onboarding (KYC)
| Gate | Required for submit? |
|------|----------------------|
| Profile completeness (entity/contact) | Yes |
| Required docs uploaded (identity, ownership; business_registration if business) | Yes |
| PartnerAgreement accepted | Yes |
| KYC Prior Consent before upload | Yes (upload blocked without) |
| Payout / IBAN | **No** |
| CommercialTermsAcceptance | Only if custom terms; admin approve gate |
| Active Owner Agreement LegalAcceptance | Bridged on PartnerAgreement accept when ACTIVE OA exists |

### 4. Admin Owner approval
| Gate | Effect |
|------|--------|
| Admin approve | `OwnerStatus.approved`, role `owner` |
| Custom commercial terms | Must be accepted before approve if present |
| Platform default commission | May approve with default 18% path |

### 5. Property draft
| Gate | Required? |
|------|-----------|
| `requireApprovedOwnerChain` | Yes |
| Owner Agreement soft reacceptance | Yes (blocks create if required) |
| Listing complete | **No** (draft permissive) |
| Exact-location Prior Consent | Yes when persisting exact fields (API) |
| Regulatory docs | **No** |

### 6. Property submit → pending_review
| Gate | Required? |
|------|-----------|
| Listing completeness (city, area, approx+exact address, basePrice) | Yes |
| ≥1 media | Yes |
| Soft Owner Agreement | Yes |

### 7. Admin Property approval / publish
| Gate | Required? |
|------|-----------|
| Admin FSM transition | Yes |
| Publish media (≥3 + cover typically) | Yes for publish |
| Platform verification | **No** |
| Tourism / municipal / insurance | **No** |
| Payout reviewed | **No** |

### 8. Discoverable (search)
| Condition | Required |
|-----------|----------|
| `Property.status = published` | Yes |
| `OwnerStatus = approved` | Yes |
| city, area, approxAddress, basePrice non-null | Yes |
| platform_verified | No (optional filter) |

### 9. Bookable
| Condition | Required |
|-----------|----------|
| published + owner approved | Yes |
| Regulatory compliance status | **Not implemented** |
| Document non-expired | **Not implemented** |
| Payout ready | **No** |
| platform_verified | **No** |

---

## Blocking gate legend

| Symbol | Meaning |
|--------|---------|
| **HARD** | Server rejects action |
| **SOFT** | UX/status only or deferred |
| **ABSENT** | No product gate (legal risk) |

| Transition | Gate strength |
|------------|---------------|
| Draft create | HARD (approved owner + OA soft) |
| KYC upload | HARD (Prior Consent + private storage) |
| Partner submit | HARD (docs + agreement) |
| Owner approve | HARD (admin) |
| Property publish | HARD (admin + media) |
| Accept paid Booking | HARD only for published+approved owner — **ABSENT regulatory** |

---

## Key APIs

| Method | Path | Role |
|--------|------|------|
| GET/PATCH | `/owner/onboarding` | Partner profile |
| GET | `/owner/onboarding/requirements` | Doc checklist |
| POST | `/owner/onboarding/documents` | KYC upload |
| GET | `/owner/onboarding/documents/:id/file` | Private download |
| POST | `/owner/partner-agreement/accept` | Agreement |
| POST | `/owner/onboarding/submit` | Submit KYC |
| PUT | `/owner/payout-profile` | IBAN |
| POST | `/owner/properties/draft` | Draft Property |
| PATCH | `/owner/properties/:id` | Update |
| POST | `/owner/properties/:id/submit-review` | Submit listing |
| Admin | `/admin/partners/*`, property status/verification | Review |

---

## Key DB models

`OwnerProfile`, `OwnerVerificationProfile`, `OwnerDocument`, `OwnerPayoutProfile`, `PartnerAgreement`, `PartnerAgreementAcceptance`, `PartnerCommercialTerms`, `CommercialTermsAcceptance`, `LegalAcceptance`, `DataProcessingConsent`, `Property`, `PropertyMedia`, `PropertyStatus`, `VerificationStatus`, `PartnerVerificationStatus`, `OwnerStatus`
