import { test, expect } from '@playwright/test';
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  CUSTOMER_EMAIL,
  CUSTOMER_PASSWORD,
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

function plusDays(n: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

async function createSearchProperty(titleEn: string) {
  const owner = await loginViaApi(OWNER_EMAIL, OWNER_PASSWORD);
  const created = await api(owner, 'POST', '/owner/properties', {
    type: 'farm',
    titleAr: `مزرعة ${titleEn}`,
    titleEn,
    descriptionAr: 'وصف تجريبي لمزرعة اختبار تجربة البحث والحجز من الصفحة الرئيسية.',
    descriptionEn: 'Playwright discovery farm for availability search and checkout handoff.',
    city: 'amman',
    area: 'e2e-discovery',
    approximateAddress: 'عمان — اختبار الاكتشاف',
    exactAddress: 'عنوان مخفي',
    basePrice: 900,
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
  return { id, slug, owner };
}

test.describe.configure({ mode: 'serial' });

test.describe('Phase 10B.2 Arabic mobile marketplace', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test('hero search preserves intent through property and checkout', async ({ page }) => {
    test.setTimeout(120_000);
    const title = `E2E Disc ${Date.now()}`;
    const prop = await createSearchProperty(title);
    const date = plusDays(18);

    await page.goto('/ar');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByTestId('marketplace-search-form')).toBeVisible();

    await page.getByTestId('search-city').selectOption('amman');
    await page.getByTestId('search-date').fill(date);
    await page.getByTestId('search-period').selectOption('morning');
    await page.getByTestId('search-guests').fill('6');
    await page.getByTestId('search-submit').click();

    await expect(page).toHaveURL(new RegExp(`date=${date}`));
    await expect(page).toHaveURL(/period=morning/);
    await expect(page).toHaveURL(/city=amman/);
    await expect(page).toHaveURL(/guests=6/);

    await expect(page.getByTestId('search-result-count')).toBeVisible({ timeout: 45_000 });
    const card = page.getByTestId(`property-card-${prop.slug}`);
    await expect(card).toBeVisible();
    await expect(card.getByTestId('exact-slot-price')).toBeVisible();
    await expect(card.locator('text=900')).toHaveCount(0);
    await expect(page.locator('[aria-label="Favorite"]')).toHaveCount(0);

    await page.getByTestId('open-mobile-filters').click();
    await expect(page.getByTestId('search-filters-sheet')).toBeVisible();
    await page.getByTestId('search-filters-sheet').locator('input[name="allowsOvernight"]').check();
    await page.getByTestId('search-filters-sheet').getByTestId('apply-filters').click();
    await expect(page).toHaveURL(/allowsOvernight=true/);
    await expect(page.getByTestId(`property-card-${prop.slug}`)).toBeVisible({ timeout: 45_000 });

    await page.getByTestId(`property-card-${prop.slug}`).click();
    await expect(page).toHaveURL(new RegExp(`/properties/${prop.slug}`));
    await expect(page).toHaveURL(new RegExp(`date=${date}`));
    await expect(page.getByTestId('booking-date')).toHaveValue(date);
    await expect(page.getByTestId('booking-period-morning')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('booking-guests')).toHaveValue('6');
    await expect(page.getByTestId('booking-summary-times')).toBeVisible();
    await expect(page.getByTestId('booking-summary-deposit')).toBeVisible();
    await expect(page.getByTestId('booking-summary-remaining')).toBeVisible();

    await applySessionToPage(page, CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    await page.goto(`/ar/properties/${prop.slug}?date=${date}&period=morning&guests=6`);
    await expect(page.getByTestId('booking-submit')).toBeEnabled({ timeout: 30_000 });
    await page.getByTestId('booking-submit').click();
    await expect(page).toHaveURL(/\/checkout\//, { timeout: 45_000 });
    await expect(page.getByTestId('booking-date')).toHaveCount(0);
  });
});

test.describe('Phase 10B.2 desktop search recovery', () => {
  test('empty results recover, sort, and back keeps state', async ({ page }) => {
    const title = `E2E Desk ${Date.now()}`;
    const prop = await createSearchProperty(title);
    const date = plusDays(19);

    await page.goto(
      `/en/search?city=amman&area=e2e-discovery&date=${date}&period=overnight`,
    );
    await expect(page.getByTestId('search-empty')).toBeVisible({ timeout: 45_000 });
    await page.getByRole('link', { name: /morning|any period/i }).first().click();
    await expect(page.getByTestId(`property-card-${prop.slug}`)).toBeVisible({ timeout: 45_000 });
    await page.getByTestId('search-sort').selectOption('price_asc');
    await page.getByTestId('apply-filters').click();
    await expect(page).toHaveURL(/sort=price_asc/);

    await page.getByTestId(`property-card-${prop.slug}`).click();
    await expect(page).toHaveURL(new RegExp(`/properties/${prop.slug}`));
    await page.goBack();
    await expect(page).toHaveURL(/date=/);
    await expect(page).toHaveURL(/sort=price_asc/);
    await expect(page.getByTestId(`property-card-${prop.slug}`)).toBeVisible();
  });
});
