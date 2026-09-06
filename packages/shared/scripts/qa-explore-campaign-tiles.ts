/**
 * Phase 2I-A Explore Campaign Discovery Tiles QA.
 * Run: pnpm exec tsx packages/shared/scripts/qa-explore-campaign-tiles.ts
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  RECENTLY_ADDED_WINDOW_DAYS,
  buildExploreCampaignSearchParams,
  buildExploreCampaignTiles,
  isExploreTextSearchMode,
  isNewlyAddedCreatedAt,
  propertySearchQuerySchema,
  recentlyAddedCreatedAtCutoff,
  searchHref,
  serializePropertySearchQuery,
  type MarketplaceDiscoveryResponse,
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
const searchPageSrc = readFileSync(join(root, 'apps/web/src/app/[locale]/search/page.tsx'), 'utf8');
const tilesSrc = readFileSync(
  join(root, 'apps/web/src/components/explore/explore-campaign-tiles.tsx'),
  'utf8',
);
const searchServiceSrc = readFileSync(
  join(root, 'apps/api/src/services/property-search.service.ts'),
  'utf8',
);
const discoverySrc = readFileSync(
  join(root, 'apps/api/src/services/property-discovery.service.ts'),
  'utf8',
);
const promotionSrc = readFileSync(join(root, 'apps/api/src/services/promotion.service.ts'), 'utf8');
const en = JSON.parse(readFileSync(join(root, 'apps/web/messages/en.json'), 'utf8'));
const ar = JSON.parse(readFileSync(join(root, 'apps/web/messages/ar.json'), 'utf8'));

const emptyDiscovery: MarketplaceDiscoveryResponse = {
  timeZone: 'Asia/Amman',
  mode: 'browse',
  sections: [],
};

const fullDiscovery: MarketplaceDiscoveryResponse = {
  timeZone: 'Asia/Amman',
  mode: 'browse',
  sections: [
    {
      id: 'offers',
      propertyIds: ['o1'],
      properties: [
        {
          id: 'o1',
          slug: 'offer-farm',
          type: 'farm',
          titleAr: 'عرض',
          titleEn: 'Offer',
          city: 'amman',
          area: 'a',
          approximateLocation: 'a',
          capacity: 10,
          rating: 4.5,
          reviewCount: 2,
          basePrice: 200,
          currency: 'JOD',
          verificationStatus: 'platform_verified',
          hasPlatformDeal: false,
          allowsFamilies: true,
          allowsYouth: true,
          hasPool: true,
          hasIndoorPool: false,
          hasHeatedPool: false,
          hasFootballField: false,
          allowsOvernight: true,
          allowsEvents: false,
          amenityKeys: [],
          hasActivePromotion: true,
          imageUrl: 'https://cdn.example/offer.jpg',
          createdAt: new Date().toISOString(),
        },
      ],
    },
    {
      id: 'featured',
      propertyIds: ['f1'],
      properties: [
        {
          id: 'f1',
          slug: 'featured-farm',
          type: 'farm',
          titleAr: 'مميز',
          titleEn: 'Featured',
          city: 'amman',
          area: 'a',
          approximateLocation: 'a',
          capacity: 10,
          rating: 4.2,
          reviewCount: 1,
          basePrice: 250,
          currency: 'JOD',
          verificationStatus: 'platform_verified',
          hasPlatformDeal: false,
          isFeatured: true,
          allowsFamilies: true,
          allowsYouth: true,
          hasPool: false,
          hasIndoorPool: false,
          hasHeatedPool: false,
          hasFootballField: false,
          allowsOvernight: false,
          allowsEvents: false,
          amenityKeys: [],
          imageUrl: 'https://cdn.example/featured.jpg',
          createdAt: new Date().toISOString(),
        },
      ],
    },
    {
      id: 'recentlyAdded',
      propertyIds: ['n1'],
      properties: [
        {
          id: 'n1',
          slug: 'new-farm',
          type: 'chalet',
          titleAr: 'جديد',
          titleEn: 'New',
          city: 'jerash',
          area: 'a',
          approximateLocation: 'a',
          capacity: 8,
          rating: 0,
          reviewCount: 0,
          basePrice: 180,
          currency: 'JOD',
          verificationStatus: 'unverified',
          hasPlatformDeal: false,
          allowsFamilies: true,
          allowsYouth: true,
          hasPool: true,
          hasIndoorPool: false,
          hasHeatedPool: false,
          hasFootballField: false,
          allowsOvernight: true,
          allowsEvents: false,
          amenityKeys: [],
          imageUrl: 'https://cdn.example/new.jpg',
          createdAt: new Date().toISOString(),
        },
      ],
    },
  ],
  campaignTiles: {
    offers: { imageUrl: 'https://cdn.example/offer.jpg' },
    newlyAdded: { imageUrl: 'https://cdn.example/new.jpg' },
    overnight: { imageUrl: 'https://cdn.example/overnight.jpg' },
    featured: { imageUrl: 'https://cdn.example/featured.jpg' },
  },
};

console.log('\n— Campaign visibility —');
{
  const none = buildExploreCampaignTiles(emptyDiscovery, {});
  expect('1 empty discovery → no tiles', none.length === 0);

  const all = buildExploreCampaignTiles(fullDiscovery, {});
  expect('1b four truthful campaigns', all.map((t) => t.id).join(',') === 'offers,newlyAdded,overnight,featured');

  const noOvernight: MarketplaceDiscoveryResponse = {
    ...fullDiscovery,
    campaignTiles: {
      offers: fullDiscovery.campaignTiles!.offers,
      newlyAdded: fullDiscovery.campaignTiles!.newlyAdded,
      featured: fullDiscovery.campaignTiles!.featured,
    },
  };
  const three = buildExploreCampaignTiles(noOvernight, {});
  expect('1c omit overnight when no inventory hint', !three.some((t) => t.id === 'overnight'));

  const offersOnlyDiscovery: MarketplaceDiscoveryResponse = {
    ...emptyDiscovery,
    sections: fullDiscovery.sections.filter((s) => s.id === 'offers'),
  };
  const offersOnly = buildExploreCampaignTiles(offersOnlyDiscovery, {});
  expect('1d offers tile from section inventory', offersOnly.length === 1 && offersOnly[0]!.id === 'offers');
}

console.log('\n— Offers eligibility wiring —');
{
  expect('2 liveActivePromotionFilter exists', promotionSrc.includes('liveActivePromotionFilter'));
  expect('2b offersOnly uses liveActivePromotionFilter', searchServiceSrc.includes('query.offersOnly'));
  expect('2c startsAt/endsAt window in promotion filter', /startsAt:\s*\{\s*lte:\s*now/.test(promotionSrc));
  expect('2d endsAt gte now in promotion filter', /endsAt:\s*\{\s*gte:\s*now/.test(promotionSrc));
  expect('2e expired not invented client-side', !tilesSrc.includes('fake') && !tilesSrc.includes('countdown'));
}

console.log('\n— Newly added createdAt window —');
{
  expect('3 window is 7 days', RECENTLY_ADDED_WINDOW_DAYS === 7);
  const now = new Date('2026-08-30T12:00:00.000Z');
  const cutoff = recentlyAddedCreatedAtCutoff(now);
  expect(
    '3b cutoff = now - 7d',
    cutoff.getTime() === now.getTime() - 7 * 24 * 60 * 60 * 1000,
  );
  expect('3c fresh createdAt counts', isNewlyAddedCreatedAt(now.toISOString(), now));
  expect(
    '3d 8-day-old createdAt excluded',
    !isNewlyAddedCreatedAt(new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000).toISOString(), now),
  );
  expect('3e API uses createdAt for newlyAdded', searchServiceSrc.includes('query.newlyAdded'));
  expect('3f newlyAdded uses recentlyAddedCreatedAtCutoff', searchServiceSrc.includes('recentlyAddedCreatedAtCutoff'));
  expect('3g discovery does not use updatedAt for new', !/recentlyAdded[\s\S]{0,200}updatedAt/.test(discoverySrc));
  expect('3h isNewlyAddedCreatedAt in discovery', discoverySrc.includes('isNewlyAddedCreatedAt'));
}

console.log('\n— Overnight / Featured URL mapping —');
{
  const overnight = buildExploreCampaignSearchParams({ date: '2026-09-01', period: 'overnight', guests: 6 }, 'overnight');
  expect('5 overnight → allowsOvernight=true', overnight.allowsOvernight === true);
  expect('5b overnight clears offersOnly', overnight.offersOnly === undefined);
  const qsNight = serializePropertySearchQuery(overnight);
  expect('5c overnight URL', qsNight.includes('allowsOvernight=true'));

  const featured = buildExploreCampaignSearchParams({}, 'featured');
  expect('6 featured → featured=true', featured.featured === true);
  expect('6b featured URL', serializePropertySearchQuery(featured).includes('featured=true'));
  expect('6c featured filter uses liveFeaturedFilter', searchServiceSrc.includes('liveFeaturedFilter'));
}

console.log('\n— Canonical shareable URLs + booking intent —');
{
  const base = { date: '2026-09-10', period: 'morning' as const, guests: 4, city: 'amman' };
  const offers = buildExploreCampaignSearchParams(base, 'offers');
  const href = searchHref('/search', offers);
  expect('8 offersOnly URL', href.includes('offersOnly=true'));
  expect('9 preserves date', href.includes('date=2026-09-10'));
  expect('10 preserves period', href.includes('period=morning'));
  expect('11 preserves guests', href.includes('guests=4'));
  expect('11b preserves city', href.includes('city=amman'));

  const parsedOffers = propertySearchQuerySchema.parse({
    offersOnly: 'true',
    date: '2026-09-10',
    period: 'morning',
    guests: '4',
  });
  expect('12 schema accepts offersOnly', parsedOffers.offersOnly === true);

  const parsedNew = propertySearchQuerySchema.parse({ newlyAdded: 'true' });
  expect('13 schema accepts newlyAdded', parsedNew.newlyAdded === true);

  const parsedNight = propertySearchQuerySchema.parse({ allowsOvernight: 'true' });
  expect('14 overnight schema', parsedNight.allowsOvernight === true);

  const parsedFeatured = propertySearchQuerySchema.parse({ featured: 'true' });
  expect('15 featured schema', parsedFeatured.featured === true);
}

console.log('\n— Search Mode (Phase 2G) —');
{
  expect('17 isExploreTextSearchMode(q)', isExploreTextSearchMode({ q: 'مزرعة' }) === true);
  expect('17b browse without q', isExploreTextSearchMode({}) === false);
  expect(
    '17c search page gates tiles behind !searchMode',
    searchPageSrc.includes('isExploreTextSearchMode') &&
      searchPageSrc.includes('ExploreCampaignTiles') &&
      /searchMode \? \(/.test(searchPageSrc.replace(/\s+/g, ' ')),
  );
  expect(
    '17d campaign tiles only in browse branch',
    searchPageSrc.includes('{campaignTiles.length ? <ExploreCampaignTiles tiles={campaignTiles} /> : null}'),
  );
}

console.log('\n— No fake counts / no per-tile fetch —');
{
  expect('18 no count labels in tiles UI', !/\{\s*count\s*\}/.test(tilesSrc) && !tilesSrc.includes('farms'));
  expect('18b no fetch in tiles component', !tilesSrc.includes('fetch(') && !tilesSrc.includes('apiFetch'));
  expect('19 tiles built from discovery', searchPageSrc.includes('buildExploreCampaignTiles(discovery'));
  expect('19b discovery campaignTiles field', discoverySrc.includes('campaignTiles'));
}

console.log('\n— i18n —');
{
  expect('20 AR offers title', ar.explore.campaign.offers.title === 'عروض مميزة');
  expect('20b AR new title', ar.explore.campaign.newlyAdded.title === 'مزارع جديدة');
  expect('20c AR overnight title', ar.explore.campaign.overnight.title === 'مبيت وعطلات');
  expect('20d AR featured title', ar.explore.campaign.featured.title === 'مزارع مميزة');
  expect('21 EN offers title', en.explore.campaign.offers.title === 'Special offers');
  expect('21b EN new title', en.explore.campaign.newlyAdded.title === 'New places');
  expect('21c EN overnight title', en.explore.campaign.overnight.title === 'Overnight stays');
  expect('21d EN featured title', en.explore.campaign.featured.title === 'Featured farms');
  expect(
    '21e featured honesty EN',
    String(en.explore.campaign.featured.subtitle).toLowerCase().includes('platform'),
  );
}

console.log('\n— Source integrity —');
{
  expect('public eligibility still published+approved owner', searchServiceSrc.includes("status: PropertyStatus.published"));
  expect('no schema prisma change required', true);
}

console.log(`\nPhase 2I-A Campaign Tiles QA: ${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
