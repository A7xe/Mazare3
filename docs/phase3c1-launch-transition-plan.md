# Phase 3C.1 — Legal Launch Transition Plan

**Status:** Process plan for moving from Phase 3B bootstrap placeholders to Production-ready legal releases.  
**Safety:** LOCAL drafting only until explicitly approved. **Do not** deploy or activate launch documents in Production from this phase alone. **Never silently mutate immutable versions.**

Related: [phase3b-legal-consent-architecture.md](./phase3b-legal-consent-architecture.md), [phase3c1-legal-identity-inputs.md](./phase3c1-legal-identity-inputs.md).

---

## Lifecycle (required sequence)

```
1) Placeholder bootstrap ACTIVE          (Phase 3B — local only)
        ↓  create NEW releases (do not edit ACTIVE in place)
2) Launch-candidate DRAFT 1.0.0          (Phase 3C.1)
        ↓  founder + Jordanian counsel review
3) Lawyer-reviewed release               (may stay DRAFT or move to scheduled)
        ↓  explicit Production publish decision
4) Production ACTIVE                     (only after guards pass)
```

| Stage | Typical version / status | Allowed actions | Forbidden |
|-------|--------------------------|-----------------|-----------|
| **Placeholder bootstrap** | e.g. `1.0.0-placeholder`, **ACTIVE** (local) | Leave as historical bootstrap; supersede later via publish of a **new** release | Edit ACTIVE/superseded content in place; treat as Production contract |
| **Launch-candidate** | **`1.0.0`** (or next convention), **DRAFT** | Author AR/EN content; QA vs SSOT; fill `[[PLACEHOLDER]]` only with founder facts | Auto-publish to Production; fabricate acceptances |
| **Lawyer-reviewed** | Same major version or counsel-bumped version; DRAFT or scheduled | Counsel edits via **new draft** if material; changelog + `materialChange` / `requiresReacceptance` proposals | Silent content swap on immutable rows |
| **Production ACTIVE** | Published release; prior ACTIVE → **superseded** | Normal publish pipeline + audit log | Activating unresolved placeholders; Production bootstrap of placeholder content |

---

## Immutability rules (from Phase 3B architecture)

1. Only `draft` (or `scheduled`) releases can be published.  
2. On publish: prior `active` → `superseded`; new → `active`.  
3. Content of `active` / `superseded` **cannot** be edited (updates on `draft` only).  
4. Never two overlapping ACTIVE versions for the same `documentType` + `language`.  
5. Every publish writes `AuditLog` (`legal.release.published`).  
6. **Never** fabricate `LegalAcceptance` / force Production reacceptance from this drafting phase.

---

## Placeholder → launch-candidate handoff

| Step | Action |
|------|--------|
| 1 | Keep Phase 3B bootstrap ACTIVE placeholders untouched on Production (Production must not rely on them). Locally they may remain until superseded by a controlled local test publish if needed. |
| 2 | Create **new** launch-candidate releases at version **`1.0.0`** with status **DRAFT** for each document type (Terms, Privacy, Cancellation/Refund, Booking Terms, Owner Agreement, plus Verification / Community / Cookie as drafted). |
| 3 | Banner / changelog must state launch-candidate status and **REQUIRES JORDANIAN LEGAL REVIEW** until counsel signs off. |
| 4 | Resolve all `[[LEGAL_ENTITY_NAME]]` (and related) tokens — or leave them visible and **block** Production activation. |
| 5 | Run Phase 3C.1 consistency QA against financial SSOT (18%/15%, deposit/cancellation ladders, etc.). |

Do **not** overwrite placeholder ACTIVE documents in place to “upgrade” them to launch content.

---

## Production activation guards (required)

Production **must not activate placeholders**. Implement / verify guards such as:

| Guard | Intent |
|-------|--------|
| **Reject / warn on placeholder ACTIVE** | If content or changelog still marks Phase 3B bootstrap / `1.0.0-placeholder` / “placeholder pending Phase 3C”, Production start or legal publish path must **fail closed** or hard-warn with deploy abort |
| **Unresolved identity placeholders** | Detect `[[…]]` tokens or empty `NEXT_PUBLIC_LEGAL_*` / support / privacy contacts before allowing Production ACTIVE legal publish |
| **No Production bootstrap** | `seed:legal` / `POST /admin/legal/bootstrap-placeholders` must refuse when `APP_ENV=production` (already intended for seed) |
| **Explicit human publish** | Production ACTIVE only via controlled admin publish after counsel approval — never silent cron mutation |

---

## Reacceptance (proposal only — do not execute on Production in 3C.1)

| Event | Proposal |
|-------|----------|
| First real Production legal set replacing any non-production or empty state | Treat as initial Production contract; set `requiresReacceptance` / `materialChange` per counsel |
| Later material policy change | New version; prior ACTIVE → superseded; require reacceptance where material |
| Non-material typo fix | Prefer new draft version with clear changelog; counsel decides reacceptance |

Do **not** automatically force reacceptance on Production users during drafting.

---

## Local QA vs Production

| Environment | Guidance |
|-------------|----------|
| **Local / staging** | May activate a clearly labelled test release for acceptance UX QA; do not invent Production acceptances |
| **Production** | Only lawyer-reviewed, placeholder-free, identity-complete ACTIVE releases |

---

## Exit criteria for this plan

- [ ] Launch-candidate **DRAFT 1.0.0** corpus exists (AR + EN)  
- [ ] Counsel review completed; FOUNDER INPUT gaps closed or explicitly deferred with Production block  
- [ ] Placeholder Production guard verified  
- [ ] Publish path documented; Production **not** silently mutated  
- [ ] Confirmation: Phase 3B placeholders never become unnoticed Production contracts
