# Cursor Apply Prompt — Mazare3 Homepage Reference Rebuild

You are working on Mazare3 Jordan.

The user has supplied a prepared replacement bundle for the homepage.

Your role is IMPLEMENTATION ONLY.

## Rules

1. Replace the repository files with the supplied files at the exact matching paths.
2. Add the new file:
   `apps/web/src/components/home/home-search-sidebar.tsx`
3. Do NOT redesign or reinterpret any Tailwind classes.
4. Do NOT "improve" spacing, colors, sizing, radius, hero layout, card layout, category layout, sidebar layout, or visual hierarchy.
5. Do NOT change backend/API/business logic.
6. Preserve the existing global floating bottom dock exactly as-is.
7. Preserve the removed public top header; do NOT restore it.
8. Do NOT change payments, booking, PayTabs, R2, KYC, owner/admin flows, Prisma, discovery ranking, favorites logic, or search contract.

## Compatibility rule

If an import/type error occurs:
- first inspect the existing project API/type exports,
- make the smallest compatibility correction needed,
- do NOT redesign the page,
- report the exact compatibility change.

Do not replace real functionality with mock data.

The page must continue using:
- real `/properties/discovery` data,
- real city/date/period/guests search,
- real property routes,
- real favorites,
- real ratings,
- real JOD prices,
- real promotion/placement badges,
- real property media.

## Visual target

The supplied replacement code intentionally implements:
- fixed left desktop search/sidebar around 310px,
- compact category cells above the main hero,
- hero around 296px high,
- compact trust cards,
- three compact featured property cards,
- left offers/top-rated modules,
- compact Why Mazare3 cards,
- current discovery/personalized rails below.

Do NOT expand these back into the previous oversized design.

## Verification

Run only:

```bash
pnpm --filter @mazare3/web typecheck
```

Then run the existing focused homepage Playwright specs:

```bash
pnpm test:e2e e2e/homepage.spec.ts
pnpm test:e2e e2e/home-personalization.spec.ts
```

If the exact project test command differs, use the existing repository convention.

Capture:
- `/ar` at 1440x900
- `/en` at 1440x900
- `/ar` at 390x844

Check:
- desktop sidebar is physically LEFT even in Arabic,
- categories are above hero,
- hero is compact (not oversized),
- three featured cards fit across desktop,
- bottom dock is unchanged,
- no public top header returns,
- no horizontal overflow,
- no hydration errors.

## Git restrictions

Do NOT run:
- git add
- git commit
- git push
- git reset
- git clean
- git stash
- git checkout
- git switch
- git merge
- git rebase
- git tag
- PR operations

You may show `git diff` and `git status`.

## Final report

Return:
1. PASS / PARTIAL / BLOCKED
2. Files replaced
3. Any compatibility-only edits made
4. Web typecheck result
5. Focused Playwright results
6. Screenshot paths
7. Confirmation that bottom dock was untouched
8. Confirmation that no business/API logic changed
9. One proposed commit message only
