/**
 * Phase 3C.4B.2B QA — historical 1.1.1 corpus (updated for 2C coexistence).
 * Run: pnpm qa:phase3c4b2b-privacy-hardening
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ADVISOR_REVISED_VERSION,
  PRIVACY_ADVISOR_REVISED_VERSION_110,
  PRIVACY_ADVISOR_REVISED_VERSION_111,
  getLaunchLegalDocument,
  privacyPolicyAdvisorRevised110,
  privacyPolicyAdvisorRevised111,
} from '../src/index.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
let passed = 0;
let failed = 0;

function pass(name: string) {
  passed++;
  console.log(`  ✅ ${name}`);
}
function fail(name: string, detail: string) {
  failed++;
  console.log(`  ❌ ${name}: ${detail}`);
}
function expect(name: string, cond: boolean, detail = '') {
  if (cond) pass(name);
  else fail(name, detail || 'assertion failed');
}
function src(rel: string) {
  return readFileSync(resolve(root, rel), 'utf8');
}

console.log('\nPhase 3C.4B.2B Privacy Policy Hardening QA (historical 1.1.1)\n');

const historical = privacyPolicyAdvisorRevised111;
const en = historical.markdownEn;
const ar = historical.markdownAr;

expect('A 1.1.0 preserved', privacyPolicyAdvisorRevised110.version === PRIVACY_ADVISOR_REVISED_VERSION_110);
expect('B 1.1.1 frozen', historical.version === PRIVACY_ADVISOR_REVISED_VERSION_111);
expect('C no INTERNAL REVIEW in 1.1.1 body', !en.includes('INTERNAL REVIEW ONLY'));
expect('E AR DPO term', ar.includes('مراقب حماية البيانات الشخصية'));
expect('G Prior Consent purpose+duration in 1.1.1', en.includes('specific as to purpose') && en.includes('specific as to duration'));
expect('I Art.14 in 1.1.1', en.includes('Article 14'));
expect('M split retention tokens', en.includes('[[RETENTION_PRIVACY_REQUESTS]]') && en.includes('[[RETENTION_BREACH_RECORDS]]'));
expect('Q no financial consequence in 1.1.1', en.includes('financial or contractual consequences'));
expect('R 15 working days legal period', en.includes('applicable legal period of 15 working days'));
expect('U 24h/72h', en.includes('within 24 hours') && en.includes('within 72 hours'));
expect('W booked Property service', en.includes('booked Property service'));
expect('Y does not sell Personal Data', en.includes('Mazare3 does not sell Personal Data.'));
expect('AD contractual 1.1.2', ADVISOR_REVISED_VERSION === '1.1.2-advisor-final');
expect(
  'current corpus advanced beyond 1.1.1',
  getLaunchLegalDocument('privacy_policy').version === '1.1.2-advisor-final',
);
expect('2B review export exists', src('docs/MAZARE3_PRIVACY_POLICY_3C4B2B_REVIEW.md').includes('1.1.1-advisor-revised'));

console.log(`\n3C.4B.2B QA: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
