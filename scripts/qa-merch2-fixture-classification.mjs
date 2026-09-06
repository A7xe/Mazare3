/**
 * MERCH-2 — classification + safety unit checks (no DB mutations).
 */
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Dynamic import of the audit module (exports matchers).
const auditPath = resolve(__dirname, 'audit-local-qa-fixtures.mjs');
const audit = await import(pathToFileURL(auditPath).href);

let passed = 0;
function check(name, cond) {
  assert.ok(cond, name);
  passed++;
  console.log(`  ✅ ${name}`);
}

console.log('\n🧹 MERCH-2 fixture classification / safety\n');

check(
  'strong E2E Home matches',
  audit.matchStrongFamily('E2E Home S 123') === 'e2e_homepage',
);
check(
  'strong QA Future matches placement family',
  audit.matchStrongFamily('QA Future pl-1') === 'qa_placement_scripts',
);
check(
  'QA Search is ambiguous (not strong)',
  audit.matchStrongFamily('QA Search sr-1') === null &&
    audit.isAmbiguousQaE2eTitle('QA Search sr-1', null),
);
check(
  'QA Org is ambiguous',
  audit.matchStrongFamily('QA Org pl-1') === null &&
    audit.isAmbiguousQaE2eTitle('QA Org pl-1', null),
);
check(
  'demo Emerald is neither strong nor ambiguous',
  audit.matchStrongFamily('Emerald Chalet - Dead Sea View') === null &&
    !audit.isAmbiguousQaE2eTitle('Emerald Chalet - Dead Sea View', null),
);

check(
  'dry-run is default (APPLY flag not set in this process)',
  !process.argv.includes('--apply'),
);

check(
  'bare title containing E2E mid-string is not strong',
  audit.matchStrongFamily('Luxury E2E Farm') === null,
);

check(
  'generic QA prefix without family is ambiguous only',
  audit.matchStrongFamily('QA Random xyz') === null &&
    audit.isAmbiguousQaE2eTitle('QA Random xyz', null),
);

const prevApp = process.env.APP_ENV;
const prevNode = process.env.NODE_ENV;
const prevDb = process.env.DATABASE_URL;

try {
  process.env.APP_ENV = 'production';
  process.env.NODE_ENV = 'development';
  process.env.DATABASE_URL = 'postgresql://u:p@localhost/db';
  let refused = false;
  try {
    audit.assertLocalSafeForMutation();
  } catch {
    refused = true;
  }
  check('mutations refuse APP_ENV=production', refused);

  process.env.APP_ENV = 'local';
  process.env.NODE_ENV = 'production';
  refused = false;
  try {
    audit.assertLocalSafeForMutation();
  } catch {
    refused = true;
  }
  check('mutations refuse NODE_ENV=production', refused);

  process.env.APP_ENV = 'local';
  process.env.NODE_ENV = 'development';
  process.env.DATABASE_URL = 'postgresql://u:p@db.prod.example/mazare3';
  refused = false;
  try {
    audit.assertLocalSafeForMutation();
  } catch {
    refused = true;
  }
  check('mutations refuse production-like DATABASE_URL', refused);
} finally {
  if (prevApp === undefined) delete process.env.APP_ENV;
  else process.env.APP_ENV = prevApp;
  if (prevNode === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = prevNode;
  if (prevDb === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = prevDb;
}

console.log(`\n📊 ${passed} passed\n`);
