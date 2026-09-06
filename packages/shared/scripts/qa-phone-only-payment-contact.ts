/**
 * UA-5 pointer — full suite (static + runtime) lives with API deps:
 *   apps/api/scripts/qa-phone-only-payment-contact.ts
 *
 * Run from apps/api:
 *   pnpm exec dotenv -e ../../.env -- tsx scripts/qa-phone-only-payment-contact.ts
 */
console.log(
  [
    'UA-5 QA: apps/api/scripts/qa-phone-only-payment-contact.ts',
    'Run:',
    '  cd apps/api',
    '  pnpm exec dotenv -e ../../.env -- tsx scripts/qa-phone-only-payment-contact.ts',
  ].join('\n'),
);
