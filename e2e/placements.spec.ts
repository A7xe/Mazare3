import { test, expect } from '@playwright/test';
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  OWNER_EMAIL,
  OWNER_PASSWORD,
  getApiBase,
} from './constants.js';
import { applySessionToPage } from './helpers/session.js';
import { loginViaApi } from './helpers/api.js';
import { nextQaFarmImages } from './helpers/farm-images.js';

async function api(cookie: string, method: string, path: string, body?: unknown) {
  const res = await fetch(`${getApiBase()}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

function allWeekRules() {
  const periods = [
    { period: 'morning', startTime: '09:00', endTime: '13:00', price: 175 },
    { period: 'evening', startTime: '16:00', endTime: '22:00', price: 240 },
  ];
  const rules = [];
  for (let weekday = 0; weekday <= 6; weekday++) {
    for (const p of periods) rules.push({ weekday, enabled: true, ...p });
  }
  return rules;
}

async function createListing(titleEn: string, basePrice: number, area: string) {
  const owner = await loginViaApi(OWNER_EMAIL, OWNER_PASSWORD);
  const created = await api(owner, 'POST', '/owner/properties', {
    type: 'farm',
    titleAr: `مزرعة ${titleEn}`,
    titleEn,
    descriptionAr: 'مزرعة اختبار للإعلان والمميز في نتائج البحث الموصى بها.',
    descriptionEn: 'Playwright placement farm for recommended vs price ranking.',
    city: 'amman',
    area,
    approximateAddress: 'عمان — اختبار الإعلان',
    exactAddress: 'عنوان مخفي',
    basePrice,
    capacity: 20,
    imageUrls: nextQaFarmImages(titleEn),
    amenityKeys: ['pool'],
    rules: [{ titleAr: 'اختبار', titleEn: 'Test' }],
  });
  if (created.status !== 201) {
    throw new Error(`create failed ${created.status} ${JSON.stringify(created.json)}`);
  }
  const id = created.json.data.id as string;
  const slug = created.json.data.slug as string;
  await api(owner, 'PUT', `/owner/properties/${id}/availability-rules`, { rules: allWeekRules() });
  await api(owner, 'POST', `/owner/properties/${id}/availability/generate`, {});
  await api(owner, 'POST', `/owner/properties/${id}/submit-review`);
  const admin = await loginViaApi(ADMIN_EMAIL, ADMIN_PASSWORD);
  const pub = await api(admin, 'PATCH', `/admin/properties/${id}/status`, { status: 'published' });
  if (pub.status !== 200) throw new Error(`publish failed ${pub.status}`);
  return { id, slug };
}

test.describe('Phase 10F.3A sponsored and featured placements', () => {
  test('Arabic recommended ranks sponsored then featured; price sort is pure', async ({ page }) => {
    test.setTimeout(150_000);
    const area = `e2e-place-${Date.now()}`;
    const sponsored = await createListing(`E2E Spon ${Date.now()}`, 1800, area);
    const featured = await createListing(`E2E Feat ${Date.now()}`, 900, area);
    await createListing(`E2E Org ${Date.now()}`, 400, area);

    await applySessionToPage(page, ADMIN_EMAIL, ADMIN_PASSWORD);

    await page.goto(`/ar/admin/properties/${sponsored.id}`);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByTestId('admin-placements')).toBeVisible({ timeout: 20_000 });
    await page.getByTestId('placement-type').selectOption('sponsored');
    await page.getByTestId('placement-create').click();
    await expect(page.getByTestId('placement-row-sponsored-active')).toBeVisible({ timeout: 15_000 });

    await page.goto(`/ar/admin/properties/${featured.id}`);
    await expect(page.getByTestId('admin-placements')).toBeVisible({ timeout: 20_000 });
    await page.getByTestId('placement-type').selectOption('featured');
    await page.getByTestId('placement-create').click();
    await expect(page.getByTestId('placement-row-featured-active')).toBeVisible({ timeout: 15_000 });

    await page.goto(`/ar/search?city=amman&area=${encodeURIComponent(area)}&sort=recommended`);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByTestId('search-results-grid')).toBeVisible({ timeout: 45_000 });

    const recCards = page.getByTestId('search-results-grid').getByTestId('property-card');
    await expect(recCards.first().getByTestId(`property-card-${sponsored.slug}`)).toBeVisible();
    const recSlugs = await recCards.locator('a[data-testid^="property-card-"]').evaluateAll((els) =>
      els.map((el) => el.getAttribute('data-testid') ?? ''),
    );
    const sIdx = recSlugs.findIndex((t) => t.includes(sponsored.slug));
    const fIdx = recSlugs.findIndex((t) => t.includes(featured.slug));
    expect(sIdx).toBeGreaterThanOrEqual(0);
    expect(fIdx).toBeGreaterThan(sIdx);

    await expect(
      page.getByTestId(`property-card-${sponsored.slug}`).getByTestId('placement-badge-sponsored'),
    ).toHaveText('إعلان');
    await expect(
      page.getByTestId(`property-card-${featured.slug}`).getByTestId('placement-badge-featured'),
    ).toHaveText('مميز');

    await page.getByTestId('search-sort').selectOption('price_asc');
    await page.getByTestId('apply-filters').click();
    await expect(page).toHaveURL(/sort=price_asc/);
    await expect(page.getByTestId('search-results-grid')).toBeVisible({ timeout: 45_000 });
    const priceCards = page.getByTestId('search-results-grid').locator('a[data-testid^="property-card-"]');
    const priceSlugs = await priceCards.evaluateAll((els) =>
      els.map((el) => el.getAttribute('data-testid') ?? ''),
    );
    const sPrice = priceSlugs.findIndex((t) => t.includes(sponsored.slug));
    const fPrice = priceSlugs.findIndex((t) => t.includes(featured.slug));
    expect(fPrice).toBeGreaterThanOrEqual(0);
    expect(sPrice).toBeGreaterThan(fPrice);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  });
});
