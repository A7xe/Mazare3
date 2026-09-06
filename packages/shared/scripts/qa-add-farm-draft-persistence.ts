/**
 * Phase AF-1.1c — Real partial draft persistence + resume.
 * Run: pnpm --filter @mazare3/api exec tsx ../../packages/shared/scripts/qa-add-farm-draft-persistence.ts
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createOwnerPropertyDraftSchema,
  createOwnerPropertySchema,
  isOwnerPropertyEditableStatus,
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

const schemaFile = read('packages/shared/src/schemas/owner-onboarding.ts');
const service = read('apps/api/src/services/owner-property.service.ts');
const routes = read('apps/api/src/routes/owner.ts');
const wizard = read('apps/web/src/components/owner/add-farm-onboarding/add-farm-wizard.tsx');
const apiOwner = read('apps/web/src/lib/api-owner.ts');
const editPage = read('apps/web/src/app/[locale]/owner/properties/[id]/edit/page.tsx');
const search = read('apps/api/src/services/property-search.service.ts');
const listingGuard = read('apps/api/src/lib/property-listing-guards.ts');
const en = JSON.parse(read('apps/web/messages/en.json'));
const ar = JSON.parse(read('apps/web/messages/ar.json'));
const prismaSchema = read('packages/db/prisma/schema.prisma');

const basicOk = {
  type: 'farm' as const,
  titleAr: 'مزرعة النخيل',
  descriptionAr: 'وصف قصير لمزرعة جميلة في عمان الأردن',
  capacity: 12,
  allowsOvernight: true,
  allowsFamilies: true,
  allowsYouth: false,
};

console.log('\n— Draft schema —');
{
  const ok = createOwnerPropertyDraftSchema.safeParse(basicOk);
  expect('1 valid basic creates draft schema', ok.success);
  const draftStart = schemaFile.indexOf('export const createOwnerPropertyDraftSchema');
  const draftEnd = schemaFile.indexOf('export const updateOwnerPropertySchema');
  const draftSrc = draftStart >= 0 && draftEnd > draftStart ? schemaFile.slice(draftStart, draftEnd) : '';
  expect('2 draft schema block found', draftSrc.includes('z.object'));
  expect('3 draft schema has no city', !/\bcity\s*:/.test(draftSrc));
  expect('3b draft schema has no area', !/\barea\s*:/.test(draftSrc));
  expect('4 draft schema has no basePrice', !/\bbasePrice\s*:/.test(draftSrc));
  expect('5 draft schema has no status field', !/\bstatus\s*:/.test(draftSrc));
  expect(
    '6 incomplete title rejected',
    createOwnerPropertyDraftSchema.safeParse({ ...basicOk, titleAr: 'ab' }).success === false,
  );
  expect(
    '7 short description rejected',
    createOwnerPropertyDraftSchema.safeParse({ ...basicOk, descriptionAr: 'short' }).success ===
      false,
  );
}

console.log('\n— Full create remains strict —');
{
  expect(
    '8 full create still needs location+price',
    createOwnerPropertySchema.safeParse(basicOk).success === false,
  );
  expect('9 full create city required', schemaFile.includes('city: z.string().min(2)'));
}

console.log('\n— Service / route —');
{
  expect('10 createOwnerPropertyDraft service', service.includes('export async function createOwnerPropertyDraft'));
  expect('11 forces PropertyStatus.draft', /status:\s*PropertyStatus\.draft/.test(service));
  expect('12 city null on draft create', /city:\s*null/.test(service));
  expect('13 area null', /area:\s*null/.test(service));
  expect('14 approximateAddress null', /approximateAddress:\s*null/.test(service));
  expect('15 basePrice null', /basePrice:\s*null/.test(service));
  const draftFn = service.slice(
    service.indexOf('export async function createOwnerPropertyDraft'),
    service.indexOf('export async function getOwnerPropertyForEdit'),
  );
  expect('16 no TBD/Unknown placeholders in draft create', !/TBD|Unknown/.test(draftFn));
  expect('17 POST /properties/draft route', routes.includes("'/properties/draft'"));
  expect('18 uses createOwnerPropertyDraftSchema', routes.includes('createOwnerPropertyDraftSchema'));
  expect('19 approved owner chain still global', routes.includes('requireApprovedOwnerChain'));
}

console.log('\n— Wizard persistence —');
{
  expect('20 createOwnerPropertyDraft client', apiOwner.includes('createOwnerPropertyDraft'));
  expect('21 wizard uses draft create', wizard.includes('createOwnerPropertyDraft'));
  expect('22 creatingRef guard', wizard.includes('creatingRef'));
  expect(
    '23 setPropertyId immediately after create response',
    /res\.data\.id[\s\S]{0,120}setPropertyId\(id\)/.test(wizard),
  );
  expect('24 Save validates basic', /handleSaveDraft[\s\S]*validateBasic/.test(wizard));
  expect('25 Next persists before advance on basic', wizard.includes("step === 'basic' || propertyId"));
  expect('26 no advance without id after persist fail', /if \(!id\) return;/.test(wizard));
  expect('27 PATCH via buildPatchPayload', wizard.includes('buildPatchPayload'));
  expect(
    '28 create only inside persistDraft',
    /async function persistDraft[\s\S]*createOwnerPropertyDraft/.test(wizard) &&
      !/useEffect\([^)]*createOwnerPropertyDraft/.test(wizard),
  );
  expect('29 resume editable status check', wizard.includes('isOwnerPropertyEditableStatus'));
  expect('30 hydration from fetchOwnerPropertyEdit', wizard.includes('fetchOwnerPropertyEdit(draftParam)'));
  expect(
    '30b skip re-hydrate after create (AF-6 race)',
    wizard.includes('hydratedDraftRef') && wizard.includes('hydratedDraftRef.current = id'),
  );
}

console.log('\n— Completeness / public —');
{
  expect(
    '31 partial listing incomplete',
    isPropertyListingCoreComplete({
      city: null,
      area: null,
      approximateAddress: null,
      exactAddress: null,
      basePrice: null,
    }) === false,
  );
  expect(
    '32 missing includes basePrice',
    listMissingPropertyListingFields({ city: 'Amman', area: 'X', approximateAddress: 'approx addr', exactAddress: 'exact addr', basePrice: null }).includes(
      'basePrice',
    ),
  );
  expect('33 listing guard present', listingGuard.includes('assertPropertyListingComplete'));
  expect('34 submit uses listing complete', service.includes('assertPropertyListingComplete(existing)'));
  expect('35 search excludes null basePrice', search.includes('basePrice: { not: null }'));
  expect('36 edit route OwnerPropertyForm', editPage.includes('OwnerPropertyForm'));
  expect('37 draft editable', isOwnerPropertyEditableStatus('draft'));
  expect('38 published not editable', isOwnerPropertyEditableStatus('published') === false);
}

console.log('\n— i18n / schema freeze —');
{
  expect('39 EN draftCreateFailed', Boolean(en.addFarm?.errors?.draftCreateFailed));
  expect('40 AR draftCreateFailed', Boolean(ar.addFarm?.errors?.draftCreateFailed));
  expect('41 EN draftInaccessible', Boolean(en.addFarm?.errors?.draftInaccessible));
  expect('42 AR draftNotEditable', Boolean(ar.addFarm?.errors?.draftNotEditable));
  expect('43 no new migration this phase', !existsSync(join(root, 'packages/db/prisma/migrations/20260830170000_af11c')));
  expect('44 city still nullable in prisma', /city\s+String\?/.test(prismaSchema));
  expect('45 no partner KYC in wizard', !wizard.includes('become-owner') && !wizard.includes('partner-verification'));
}

console.log(`\nAF-1.1c QA: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
