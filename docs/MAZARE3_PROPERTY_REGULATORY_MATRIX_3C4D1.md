# Mazare3 — Property Regulatory Matrix (Add Your Farm)

**Phase:** 3C.4D.1 — AUDIT ONLY  
**Rule:** Do **not** state unverified legal requirements as settled law. Separate product facts from counsel/regulator confirmation.

---

## Legend

| Tag | Meaning |
|-----|---------|
| **CONFIRMED BY CURRENT OFFICIAL SOURCE** | User-provided audit context citing Regulation No. 50 of 2025 architecture (classification/registration for listed tourism-accommodation categories). Exact farm/chalet mapping **not** confirmed here. |
| **PRODUCT REQUIREMENT** | What Mazare3 code/UI currently requires or stores |
| **COUNSEL / REGULATOR CONFIRMATION REQUIRED** | Applicability to Mazare3 farm/chalet / day-use / pool / insurance / municipal path |

---

## A. Tourism establishment framework (context)

### CONFIRMED BY CURRENT OFFICIAL SOURCE (audit brief)

Jordan Hotel and Tourism Establishments Regulation No. 50 of 2025 uses classification/registration approval architecture for relevant tourism accommodation establishments and expressly lists categories including:

- hotels, tourist resorts, tourist villages, hotel apartments  
- inns, motels, boutique hotels, floating hotels  
- tourist camps, guest houses, folk hotels  

It also allows new categories / other tourism-accommodation establishments to be brought within the framework through the competent authority.

### COUNSEL / REGULATOR CONFIRMATION REQUIRED

| Question | Notes |
|----------|-------|
| Does a typical Mazare3 “farm / chalet” listing fall under Reg. 50/2025 as written? | **Do not hard-code farm/chalet into a tourism class** |
| Does day-use-only recreational rental trigger the same path as overnight accommodation? | Activity-dependent |
| Do events/celebrations change the path? | Activity-dependent |
| Can competent authority bring farms into framework later? | Possible under “new categories” clause — product should stay flexible |

### PRODUCT REQUIREMENT (today)

| Field / gate | Present? |
|--------------|----------|
| Tourism classification category | **No** |
| Tourism registration / approval number | **No** |
| Issuing authority | **No** |
| Issue / expiry dates for tourism approval | **No** |
| Supporting tourism document upload typed as such | **No** |
| Distinct REGULATORY_STATUS separate from KYC / Property.status / VerificationStatus | **No** |
| Obsolete universal “Ministry of Tourism licence” field | **Not found as a dedicated product field** — also **must not** be invented as universal |

**Status:** MISSING product capture; farm classification = **COUNSEL / REGULATORY CONFIRMATION REQUIRED**

---

## B. Professional / municipal business licence

### COUNSEL / REGULATOR CONFIRMATION REQUIRED

| Dimension | Issue |
|-----------|--------|
| Greater Amman Municipality vs other municipality / local administration | Issuing authority may vary by location |
| Whether licence required for day-use vs overnight vs events | Activity + location dependent |
| Sole establishment vs company licence | Entity-type dependent |

### PRODUCT REQUIREMENT (today)

| Item | Present? |
|------|----------|
| Professional / municipal licence number | **No** |
| Issuing authority (Amman vs other) | **No** |
| Issue / expiry | **No** |
| Document type for municipal licence | **No** (only generic ownership / business_registration / other) |
| Fake government verification API | **Correctly absent** |

**Status:** MISSING

---

## C. Activity-type dimensions (product vs regulatory)

| Dimension | Product today | Regulatory branching |
|-----------|---------------|----------------------|
| Day-use / recreational periods | Availability periods / pricing units | COUNSEL CONFIRMATION REQUIRED |
| Overnight accommodation | `Property.allowsOvernight` | COUNSEL CONFIRMATION REQUIRED |
| Events / celebrations | Search filter `allowsEvents` — **not owner-editable on Property** | COUNSEL CONFIRMATION REQUIRED |
| Swimming pool | Amenity + `poolsCount` | See §E — **POOL_REGULATORY_SCOPE_COUNSEL_CONFIRMATION_REQUIRED** |
| Food / service activities | Not modeled | COUNSEL CONFIRMATION REQUIRED |
| Other commercial activities | Not modeled | COUNSEL CONFIRMATION REQUIRED |

**Assumption risk:** Product treats most farms under one KYC + listing path → **same regulatory requirements incorrectly assumed**.

---

## D. Identity / KYC vs regulatory vs platform vs content

| Layer | Product concept | Used for Booking gate? |
|-------|-----------------|------------------------|
| IDENTITY / KYC | `PartnerVerificationStatus`, `OwnerDocument`, partner approve | Indirect (Owner must be approved) |
| REGULATORY COMPLIANCE | **Absent** | N/A |
| MAZARE3 PLATFORM VERIFICATION | `VerificationStatus` (`platform_verified`, …) | **No** (commission only) |
| PROPERTY CONTENT APPROVAL | `PropertyStatus` → published | **Yes** (with Owner approved) |

**Conflict:** Booking eligibility = content publish + Owner KYC approval — **not** a distinct regulatory layer.

---

## E. Swimming pool

### PRODUCT REQUIREMENT (today)

| Item | Behavior |
|------|----------|
| Identifies pool presence | Yes (amenity / poolsCount) |
| Distinguishes swimming pool vs agricultural reservoir | **No** |
| Pool depth / children restrictions | **No** structured fields |
| MoH health approval / safety evidence | **No** |
| Admin pool compliance review | **No** dedicated |
| Publishes pool amenity without regulatory review | **Yes** |

### COUNSEL / REGULATOR CONFIRMATION REQUIRED

Jordan Ministry of Health operates health-approval processes for **public** swimming pools under applicable health/safety conditions.

**Do not conclude** every private farm pool automatically requires the same licence.

**Flag:** `POOL_REGULATORY_SCOPE_COUNSEL_CONFIRMATION_REQUIRED`

---

## F. Insurance

### CONFIRMED BY CURRENT OFFICIAL SOURCE (audit brief)

Jordan tourism regulation contains civil-liability insurance requirements for **certain regulated categories**.

### PRODUCT REQUIREMENT (today)

| Capability | Present? |
|------------|----------|
| Ask for insurance certificate | **No** |
| Status: required / not_applicable / pending / verified / expired | **No** |
| Legal copy: Mazare3 does not provide insurance | In Owner Agreement draft (locked) — informational only |

### COUNSEL / REGULATOR CONFIRMATION REQUIRED

Exact applicability to Mazare3 farm/chalet inventory — **do not universally require insurance in code** until counsel confirms.

---

## G. Authority-to-list evidence (not title verification)

| Doc type | PRODUCT REQUIREMENT | Legal note |
|----------|---------------------|------------|
| `property_ownership` | Required for partner submit | Evidence of relationship — **not** government title verification by Mazare3 |
| `management_authorization` | Optional (individual) | Authorised management path partially supported |
| Company authority / lease / sublease typed docs | **Not dedicated types** | COUNSEL + product taxonomy needed |
| Checkbox-only authority | **Not used** (docs required) | Better than checkbox-only; still free-form review |

Mazare3 **does not** claim or perform legal title verification in product.

---

## H. Conditional matrix (dimensions × product capture)

| Dimension | Product captures? | Recommended gate strength (design only) | Confirmation |
|-----------|-------------------|------------------------------------------|--------------|
| Accommodation (overnight) vs day-use | Partial (`allowsOvernight`) | Booking > publish > draft | COUNSEL |
| Pool vs no pool | Amenity only | Conditional disclosure / docs if counsel says applicable | POOL flag |
| Company vs individual | `PartnerEntityType` | Stronger entity docs | PARTIAL product |
| Greater Amman vs other municipality | City string only | Licence issuer conditional | COUNSEL |
| Tourism classification / registration | **No** | If applicable: Booking gate | COUNSEL / REGULATOR |
| Insurance | **No** | If applicable: Booking gate | COUNSEL / REGULATOR |
| Document expiry | **No** | Block **new** Bookings if expired; do not auto-cancel history | PRODUCT gap |

---

## I. Safest practical architecture (design recommendation — not implemented)

| State | Recommended posture |
|-------|---------------------|
| **A. Draft** | Permissive — create/save before regulatory complete |
| **B. Public discoverable** | Identity + content review sufficient; show compliance-pending where needed |
| **C. Accept paid Bookings** | **Strongest** gate: regulatory status (where counsel says applicable) + commercial/legal acceptances + non-expired required docs |

---

## J. Explicit non-claims

- This matrix does **not** classify Mazare3 farms as hotels, camps, or any Reg. 50 category.  
- This matrix does **not** invent municipal licence numbers or MoH pool rules for private pools.  
- Product must not display government certification badges without supporting verification.  
- Locked legal documents were **not** modified for this audit.
