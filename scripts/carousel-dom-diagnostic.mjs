/**
 * One-off DOM diagnostic for homepage carousels (no code changes).
 * Usage: node scripts/carousel-dom-diagnostic.mjs [url]
 */
import { chromium } from '@playwright/test';

const URL = process.argv[2] ?? 'http://localhost:3000/ar';
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

const SECTIONS = [
  {
    name: 'City Destinations',
    sectionTestId: 'home-city-destinations',
    cardSelector: '[data-testid^="city-destination-"]',
    sourceKey: 'cities',
  },
  {
    name: 'Ads / Sponsored',
    sectionTestId: 'discovery-rail-sponsored',
    cardSelector: '[data-testid^="property-card-"]',
    sourceKey: 'sponsored',
  },
  {
    name: 'Recently Added',
    sectionTestId: 'discovery-rail-recentlyAdded',
    cardSelector: '[data-testid^="property-card-"]',
    sourceKey: 'recentlyAdded',
  },
];

function summarizeRect(r) {
  if (!r) return null;
  return {
    x: Math.round(r.x ?? r.left),
    y: Math.round(r.y ?? r.top),
    width: Math.round(r.width),
    height: Math.round(r.height),
    top: Math.round(r.top),
    left: Math.round(r.left),
    right: Math.round(r.right),
    bottom: Math.round(r.bottom),
  };
}

async function fetchDiscoveryCounts() {
  try {
    const res = await fetch(`${API_URL}/properties/discovery`, { cache: 'no-store' });
    if (!res.ok) return { error: `discovery API ${res.status}` };
    const data = await res.json();
    const sections = {};
    for (const s of data.sections ?? []) {
      sections[s.id] = s.properties?.length ?? 0;
    }
    return { sections, mode: data.mode };
  } catch (e) {
    return { error: String(e) };
  }
}

async function diagnoseSection(page, config, sourceItemsLength, actualVisibleExpected) {
  return page.evaluate(
    ({ sectionTestId, cardSelector, sourceItemsLength, actualVisibleExpected }) => {
      const section = document.querySelector(`[data-testid="${sectionTestId}"]`);
      if (!section) {
        return { error: `Section [data-testid="${sectionTestId}"] not found` };
      }

      const viewport = section.querySelector('.overflow-hidden');
      const track = viewport?.firstElementChild ?? null;
      const cards = Array.from(section.querySelectorAll(cardSelector));
      const trackFirstChild = track?.firstElementChild ?? null;
      const firstCard = trackFirstChild ?? cards[0] ?? null;

      const uniqueCardKeys = new Set(
        cards.map((el) => el.getAttribute('data-testid') ?? el.textContent?.slice(0, 20)),
      );

      const viewportRect = viewport?.getBoundingClientRect() ?? null;
      const trackRect = track?.getBoundingClientRect() ?? null;
      const firstCardRect = firstCard?.getBoundingClientRect() ?? null;

      const trackStyle = track ? getComputedStyle(track) : null;
      const cardStyle = firstCard ? getComputedStyle(firstCard) : null;

      const gap = trackStyle ? trackStyle.gap || trackStyle.columnGap : null;

      const intersects =
        viewportRect &&
        firstCardRect &&
        firstCardRect.width > 0 &&
        firstCardRect.height > 0 &&
        firstCardRect.left < viewportRect.right &&
        firstCardRect.right > viewportRect.left &&
        firstCardRect.top < viewportRect.bottom &&
        firstCardRect.bottom > viewportRect.top;

      return {
        sourceItemsLength,
        actualVisible: actualVisibleExpected,
        renderedCardDomNodes: cards.length,
        uniqueCardDomNodes: uniqueCardKeys.size,
        viewportRect: viewportRect
          ? {
              x: viewportRect.x,
              y: viewportRect.y,
              width: viewportRect.width,
              height: viewportRect.height,
              top: viewportRect.top,
              left: viewportRect.left,
              right: viewportRect.right,
              bottom: viewportRect.bottom,
            }
          : null,
        trackRect: trackRect
          ? {
              x: trackRect.x,
              y: trackRect.y,
              width: trackRect.width,
              height: trackRect.height,
              top: trackRect.top,
              left: trackRect.left,
              right: trackRect.right,
              bottom: trackRect.bottom,
            }
          : null,
        firstCardRect: firstCardRect
          ? {
              x: firstCardRect.x,
              y: firstCardRect.y,
              width: firstCardRect.width,
              height: firstCardRect.height,
              top: firstCardRect.top,
              left: firstCardRect.left,
              right: firstCardRect.right,
              bottom: firstCardRect.bottom,
            }
          : null,
        transform: trackStyle?.transform ?? null,
        transition: trackStyle?.transition ?? null,
        trackWidth: trackStyle?.width ?? null,
        cardWidth: cardStyle?.width ?? null,
        cardMinWidth: cardStyle?.minWidth ?? null,
        cardVisibility: cardStyle?.visibility ?? null,
        gap,
        firstCardIntersectsViewport: Boolean(intersects),
        trackInlineStyle: track?.getAttribute('style') ?? null,
        firstCardInlineStyle: firstCard?.getAttribute('style') ?? null,
      };
    },
    {
      sectionTestId: config.sectionTestId,
      cardSelector: config.cardSelector,
      sourceItemsLength,
      actualVisibleExpected,
    },
  );
}

function actualVisibleForWidth(sourceCount, width, kind) {
  let responsive;
  if (kind === 'cities') {
    if (width >= 1024) responsive = 4;
    else if (width >= 768) responsive = 2;
    else responsive = 1;
  } else {
    if (width >= 1280) responsive = 5;
    else if (width >= 1024) responsive = 4;
    else if (width >= 768) responsive = 2;
    else responsive = 1;
  }
  return Math.min(sourceCount, Math.max(1, responsive));
}

async function main() {
  const discovery = await fetchDiscoveryCounts();
  console.log(`\n=== Carousel DOM diagnostic: ${URL} ===`);
  console.log(`Discovery API (${API_URL}):`, JSON.stringify(discovery, null, 2));

  const browser = await chromium.launch({ headless: true });
  const viewportWidth = 1440;
  const viewportHeight = 900;
  const page = await browser.newPage({ viewport: { width: viewportWidth, height: viewportHeight } });

  await page.goto(URL, { waitUntil: 'networkidle', timeout: 120_000 });
  await page.waitForTimeout(2000);

  for (const section of SECTIONS) {
    let sourceItemsLength;
    if (section.sourceKey === 'cities') {
      const cityCount = await page.evaluate(() => {
        const sectionEl = document.querySelector('[data-testid="home-city-destinations"]');
        if (!sectionEl) return 0;
        const keys = new Set(
          Array.from(sectionEl.querySelectorAll('[data-testid^="city-destination-"]')).map((el) =>
            el.getAttribute('data-testid'),
          ),
        );
        return keys.size;
      });
      sourceItemsLength = cityCount;
    } else {
      sourceItemsLength = discovery.sections?.[section.sourceKey] ?? null;
    }

    const kind = section.sourceKey === 'cities' ? 'cities' : 'properties';
    const actualVisible = sourceItemsLength
      ? actualVisibleForWidth(sourceItemsLength, viewportWidth, kind)
      : null;

    const dom = await diagnoseSection(page, section, sourceItemsLength, actualVisible);

    const report = {
      ...dom,
      viewportRect: summarizeRect(dom.viewportRect),
      trackRect: summarizeRect(dom.trackRect),
      firstCardRect: summarizeRect(dom.firstCardRect),
    };

    console.log(`\n--- ${section.name} ---`);
    console.log(JSON.stringify(report, null, 2));
  }

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
