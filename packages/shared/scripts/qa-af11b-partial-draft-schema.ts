/**
 * AF-1.1b schema-safety QA (no draft API).
 * Run: pnpm --filter @mazare3/api exec tsx ../../packages/shared/scripts/qa-af11b-partial-draft-schema.ts
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createOwnerPropertySchema,
  isPropertyListingCoreComplete,
  listMissingPropertyListingFields,
} from '../src/index.ts';

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

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const read = (rel: string) => readFileSync(join(root, rel), 'utf8');

const schema = read('packages/db/prisma/schema.prisma');
const migrationPath =
  'packages/db/prisma/migrations/20260830160000_af11b_partial_property_draft_nullables/migration.sql';
const migration = existsSync(join(root, migrationPath)) ? read(migrationPath) : '';
const listingGuard = read('apps/api/src/lib/property-listing-guards.ts');
const ownerProp = read('apps/api/src/services/owner-property.service.ts');
const adminSvc = read('apps/api/src/services/admin.service.ts');
const search = read('apps/api/src/services/property-search.service.ts');
const createSchema = read('packages/shared/src/schemas/owner-onboarding.ts');
const editPage = read('apps/web/src/app/[locale]/owner/properties/[id]/edit/page.tsx');
const types = read('packages/shared/src/types.ts');

console.log('\n— Prisma nullability —');
{
  const propBlock = schema.slice(schema.indexOf('model Property {'), schema.indexOf('model PropertyMedia'));
  expect('1 city String?', /city\s+String\?/.test(propBlock));
  expect('2 area String?', /area\s+String\?/.test(propBlock));
  expect('3 approximateAddress String?', /approximateAddress\s+String\?/.test(propBlock));
  expect('4 basePrice Decimal?', /basePrice\s+Decimal\?/.test(propBlock));
  expect('5 migration exists', Boolean(migration));
  expect('6 migration drops city NOT NULL', migration.includes('ALTER COLUMN "city" DROP NOT NULL'));
  expect('7 migration drops area NOT NULL', migration.includes('ALTER COLUMN "area" DROP NOT NULL'));
  expect('8 migration drops approx NOT NULL', migration.includes('ALTER COLUMN "approximateAddress" DROP NOT NULL'));
  expect('9 migration drops basePrice NOT NULL', migration.includes('ALTER COLUMN "basePrice" DROP NOT NULL'));
}

console.log('\n— Full create stays strict —');
{
  const parsed = createOwnerPropertySchema.safeParse({
    type: 'farm',
    titleAr: 'مزرعة',
    descriptionAr: 'وصف قصير لمزرعة جميلة في عمان',
    capacity: 10,
  });
  expect('10 create schema still requires location+price', parsed.success === false);
  expect('11 create schema city min still present', createSchema.includes('city: z.string().min(2)'));
  expect('12 create schema basePrice positive', createSchema.includes('basePrice: z.coerce.number().positive()'));
}

console.log('\n— Submit/publish gates —');
{
  expect('13 listing guard file', listingGuard.includes('assertPropertyListingComplete'));
  expect('14 submit-review uses guard', ownerProp.includes('assertPropertyListingComplete(existing)'));
  expect('15 admin publish uses guard', adminSvc.includes('assertPropertyListingComplete(property)'));
  expect(
    '16 incomplete missing fields',
    listMissingPropertyListingFields({}).join(',') ===
      'city,area,approximateAddress,exactAddress,basePrice',
  );
  expect(
    '17 complete listing',
    isPropertyListingCoreComplete({
      city: 'Amman',
      area: 'Airport',
      approximateAddress: 'Near airport',
      exactAddress: 'Gate 12',
      basePrice: 100,
    }),
  );
  expect(
    '18 incomplete cannot pass core',
    isPropertyListingCoreComplete({
      city: 'Amman',
      area: 'Airport',
      approximateAddress: 'Near airport',
      exactAddress: 'Gate 12',
      basePrice: null,
    }) === false,
  );
}

console.log('\n— Public / edit safety —');
{
  expect('19 search excludes null location/price', search.includes('basePrice: { not: null }'));
  expect('20 edit page unchanged OwnerPropertyForm', editPage.includes('OwnerPropertyForm'));
  expect('21 OwnerPropertyEdit city nullable type', /city:\s*string\s*\|\s*null/.test(types));
  expect('22 draft create API now present', ownerProp.includes('createOwnerPropertyDraft'));
}

console.log(`\nAF-1.1b QA: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
