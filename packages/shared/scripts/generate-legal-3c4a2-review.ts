/**
 * Generate docs/MAZARE3_LEGAL_3C4A2_FINAL_REVIEW.md — full AR+EN bodies with raw placeholders.
 * Run: pnpm --filter @mazare3/api exec tsx ../../packages/shared/scripts/generate-legal-3c4a2-review.ts
 */
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ADVISOR_REVISED_VERSION,
  getLaunchLegalDocument,
  getLaunchLegalMarkdown,
  getLegalIdentityFromEnv,
  toPlaceholderValues,
} from '../src/index.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const identity = getLegalIdentityFromEnv();
const valuesEn = toPlaceholderValues(identity, 'en');

const types: Array<[Parameters<typeof getLaunchLegalDocument>[0], string]> = [
  ['terms_and_conditions', 'Terms & Conditions'],
  ['cancellation_refund_policy', 'Cancellation & Refund Policy'],
  ['booking_terms', 'Booking Terms'],
];

const parts: string[] = [];
parts.push('# Mazare3 — Phase 3C.4A.2 Final Customer Legal Review Export');
parts.push('');
parts.push('> LOCAL / DEV review corpus only. Not Production-active. Not counsel-approved.');
parts.push('');
parts.push(`**Version:** \`${ADVISOR_REVISED_VERSION}\` DRAFT`);
parts.push('');
parts.push('Documents included (FULL AR + EN, no summarization):');
parts.push('1. Terms & Conditions');
parts.push('2. Cancellation & Refund Policy');
parts.push('3. Booking Terms');
parts.push('');
parts.push(
  'Unresolved internal placeholders (e.g. `[[TOKEN]]`) are preserved in the document bodies below.',
);
parts.push('');
parts.push('---');
parts.push('');

for (const [type, label] of types) {
  const doc = getLaunchLegalDocument(type);
  if (doc.version !== ADVISOR_REVISED_VERSION) {
    throw new Error(`Unexpected version for ${type}: ${doc.version}`);
  }
  const en = getLaunchLegalMarkdown(type, 'en');
  const ar = getLaunchLegalMarkdown(type, 'ar');
  parts.push(`## ${label}`);
  parts.push('');
  parts.push(`### English (\`${doc.version}\`)`);
  parts.push('');
  parts.push(en.trimEnd());
  parts.push('');
  parts.push(`### Arabic (\`${doc.version}\`)`);
  parts.push('');
  parts.push(ar.trimEnd());
  parts.push('');
  parts.push('---');
  parts.push('');
}

parts.push('## Identity fill reference (not substituted in the bodies above)');
parts.push('');
parts.push(
  'Counsel export keeps raw `[[PLACEHOLDER]]` tokens. Confirmed identity values from env/SSOT for cross-check:',
);
parts.push('');
for (const [k, v] of Object.entries(valuesEn)) {
  parts.push(`- \`${k}\` EN: ${v || '(empty)'}`);
}
parts.push('');

const out = resolve(root, 'docs/MAZARE3_LEGAL_3C4A2_FINAL_REVIEW.md');
const body = `${parts.join('\n')}\n`;
writeFileSync(out, body, 'utf8');
console.log(`Wrote ${out} (${body.length} chars)`);
