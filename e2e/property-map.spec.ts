import { test, expect, type Page } from '@playwright/test';
import {
  CUSTOMER_EMAIL,
  CUSTOMER_PASSWORD,
  OWNER_EMAIL,
  OWNER_PASSWORD,
  PROPERTY_SLUG,
  getApiBase,
} from './constants.js';
import { applySessionToPage } from './helpers/session.js';
import {
  cancelBookingViaApi,
  createBookingViaApi,
  findAvailableSlot,
  loginViaApi,
} from './helpers/api.js';

const UNIQUE_LAT = '31.111111';
const UNIQUE_LNG = '35.222222';
const OWNER2_EMAIL = 'owner2@mazare3.jo';

type LocationSnapshot = {
  city: string;
  area: string;
  approximateAddress: string;
  exactAddress: string;
  latitudeApprox: number | null;
  longitudeApprox: number | null;
  latitudeExact: number | null;
  longitudeExact: number | null;
  arrivalInstructionsAr: string | null;
  arrivalInstructionsEn: string | null;
};

async function ownerPropertyId(cookie: string): Promise<string> {
  const res = await fetch(`${getApiBase()}/owner/properties`, { headers: { Cookie: cookie } });
  const body = (await res.json()) as { data?: Array<{ id: string; slug: string }> };
  const owned = body.data?.find((p) => p.slug === PROPERTY_SLUG);
  if (!owned?.id) throw new Error('owner1 does not own seeded emerald property');
  return owned.id;
}

async function fetchOwnerEdit(cookie: string, propertyId: string): Promise<LocationSnapshot> {
  const res = await fetch(`${getApiBase()}/owner/properties/${propertyId}/edit`, {
    headers: { Cookie: cookie },
  });
  const body = (await res.json()) as { data?: LocationSnapshot };
  if (!body.data) throw new Error('owner edit payload missing');
  return body.data;
}

async function patchLocation(cookie: string, propertyId: string, data: Partial<LocationSnapshot>) {
  const res = await fetch(`${getApiBase()}/owner/properties/${propertyId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`location patch failed (${res.status})`);
}

async function payFully(cookie: string, bookingId: string) {
  const base = getApiBase();
  for (const purpose of ['deposit', 'balance'] as const) {
    const intent = await fetch(`${base}/payments/create-intent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ bookingId, method: 'card', purpose }),
    });
    const body = (await intent.json()) as { data?: { id?: string } };
    const paymentId = body.data?.id;
    if (!paymentId) throw new Error(`intent failed for ${purpose}`);
    await fetch(`${base}/payments/${paymentId}/simulate-success`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
    });
  }
}

async function waitForLeaflet(page: Page, testId: string) {
  const map = page.getByTestId(testId);
  await expect(map).toBeVisible({ timeout: 20_000 });
  await map.scrollIntoViewIfNeeded();
  await expect(map.locator('.leaflet-container')).toBeVisible({ timeout: 30_000 });
  return map;
}

async function clickMap(page: Page, testId: string, xRatio = 0.34, yRatio = 0.42) {
  const map = await waitForLeaflet(page, testId);
  const box = await map.locator('.leaflet-container').boundingBox();
  if (!box) throw new Error('map bounding box missing');
  await page.mouse.click(box.x + box.width * xRatio, box.y + box.height * yRatio);
}

function assertNoHydrationError(page: Page) {
  return Promise.all([
    expect(page.getByText(/hydration/i)).toHaveCount(0),
    expect(page.locator('[data-nextjs-dialog]')).toHaveCount(0),
  ]);
}

test.describe('Interactive property maps (10H.2B)', () => {
  test.describe.configure({ mode: 'serial', retries: 0 });

  let propertyId = '';
  let snapshot: LocationSnapshot | null = null;

  test.beforeAll(async () => {
    const cookie = await loginViaApi(OWNER_EMAIL, OWNER_PASSWORD);
    propertyId = await ownerPropertyId(cookie);
    snapshot = await fetchOwnerEdit(cookie, propertyId);
  });

  test.afterAll(async () => {
    if (!propertyId || !snapshot) return;
    const cookie = await loginViaApi(OWNER_EMAIL, OWNER_PASSWORD);
    await patchLocation(cookie, propertyId, {
      city: snapshot.city,
      area: snapshot.area,
      approximateAddress: snapshot.approximateAddress,
      exactAddress: snapshot.exactAddress,
      latitudeApprox: snapshot.latitudeApprox,
      longitudeApprox: snapshot.longitudeApprox,
      latitudeExact: snapshot.latitudeExact,
      longitudeExact: snapshot.longitudeExact,
      arrivalInstructionsAr: snapshot.arrivalInstructionsAr,
      arrivalInstructionsEn: snapshot.arrivalInstructionsEn,
    });
  });

  test('owner map click, drag, manual coords, generate approx, Arabic RTL', async ({ page }) => {
    test.setTimeout(120_000);
    await applySessionToPage(page, OWNER_EMAIL, OWNER_PASSWORD);
    await page.goto(`/ar/owner/properties/${propertyId}/edit`);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByTestId('owner-location-section')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('الموقع الدقيق للعقار').first()).toBeVisible();
    await expect(page.getByText(/محمية ولا تُعرض للعامة/)).toBeVisible();

    await waitForLeaflet(page, 'owner-location-map');
    await page.getByTestId('owner-map-pick-exact').click();

    const latInput = page.getByTestId('owner-latitude-exact');
    const lngInput = page.getByTestId('owner-longitude-exact');
    const beforeLat = await latInput.inputValue();
    await clickMap(page, 'owner-location-map');
    await expect.poll(async () => latInput.inputValue()).not.toBe(beforeLat);
    await expect(latInput).not.toHaveValue('');
    await expect(lngInput).not.toHaveValue('');

    const afterClickLat = await latInput.inputValue();
    const afterClickLng = await lngInput.inputValue();
    const mapContainer = page.getByTestId('owner-location-map').locator('.leaflet-container');
    const exactPin = page.getByTestId('map-pin-exact');
    await expect(exactPin).toBeVisible();
    const pinBox = await exactPin.boundingBox();
    const mapBox = await mapContainer.boundingBox();
    if (!pinBox || !mapBox) throw new Error('exact pin or map box missing');
    await exactPin.hover();
    await page.mouse.down();
    await page.mouse.move(mapBox.x + mapBox.width * 0.62, mapBox.y + mapBox.height * 0.58, {
      steps: 16,
    });
    await page.mouse.up();
    await expect
      .poll(async () => `${await latInput.inputValue()},${await lngInput.inputValue()}`)
      .not.toBe(`${afterClickLat},${afterClickLng}`);

    await latInput.fill(UNIQUE_LAT);
    await lngInput.fill(UNIQUE_LNG);
    await expect(page.getByTestId('owner-location-map')).toHaveAttribute('data-exact-lat', UNIQUE_LAT);
    await expect(page.getByTestId('owner-location-map')).toHaveAttribute('data-exact-lng', UNIQUE_LNG);

    await page.getByTestId('owner-generate-approx').click();
    const approxLat = await page.getByTestId('owner-latitude-approx').inputValue();
    const approxLng = await page.getByTestId('owner-longitude-approx').inputValue();
    expect(approxLat).not.toBe('');
    expect(approxLng).not.toBe('');
    expect(approxLat).not.toBe(UNIQUE_LAT);
    expect(approxLng).not.toBe(UNIQUE_LNG);
    await expect(page.getByTestId('owner-location-map')).toHaveAttribute('data-approx-lat', approxLat);
    await expect(page.getByTestId('owner-location-map')).not.toHaveAttribute('data-approx-lat', UNIQUE_LAT);

    await page.getByTestId('owner-save-location').click();
    await expect(page.getByText('تم حفظ الموقع.')).toBeVisible();
    await assertNoHydrationError(page);
  });

  test('public page uses approximate map only and never embeds exact coords', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(`/ar/properties/${PROPERTY_SLUG}`);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByTestId('property-location-section')).toBeVisible();
    await expect(page.getByText('موقع تقريبي').first()).toBeVisible();
    const publicMap = await waitForLeaflet(page, 'public-approx-map');
    await expect(publicMap).not.toHaveAttribute('data-exact-lat');
    await expect(publicMap).not.toHaveAttribute('data-exact-lng');
    await expect(publicMap).toHaveAttribute('data-approx-lat', /.+/);
    const approxLat = await publicMap.getAttribute('data-approx-lat');
    expect(approxLat).not.toBe(UNIQUE_LAT);

    const html = await page.content();
    expect(html).not.toContain(UNIQUE_LAT);
    expect(html).not.toContain(UNIQUE_LNG);
    expect(html).not.toMatch(/data-exact-lat=/);
    expect(html).not.toMatch(/data-exact-lng=/);
    await assertNoHydrationError(page);

    const publicApi = await fetch(`${getApiBase()}/properties/${PROPERTY_SLUG}`);
    const publicJson = await publicApi.json();
    expect(JSON.stringify(publicJson)).not.toContain('latitudeExact');
    expect(JSON.stringify(publicJson)).not.toContain('longitudeExact');
    expect(JSON.stringify(publicJson)).not.toContain('exactAddress');
    expect(JSON.stringify(publicJson)).not.toContain(UNIQUE_LAT);
    expect(JSON.stringify(publicJson)).not.toContain(UNIQUE_LNG);

    await page.goto(`/en/properties/${PROPERTY_SLUG}`);
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.getByText('Approximate location').first()).toBeVisible();
    await waitForLeaflet(page, 'public-approx-map');

    const cookie = await loginViaApi(OWNER_EMAIL, OWNER_PASSWORD);
    const current = await fetchOwnerEdit(cookie, propertyId);
    await patchLocation(cookie, propertyId, {
      city: current.city,
      area: current.area,
      approximateAddress: current.approximateAddress,
      exactAddress: current.exactAddress,
      latitudeApprox: null,
      longitudeApprox: null,
      latitudeExact: current.latitudeExact,
      longitudeExact: current.longitudeExact,
      arrivalInstructionsAr: current.arrivalInstructionsAr,
      arrivalInstructionsEn: current.arrivalInstructionsEn,
    });

    await page.goto(`/ar/properties/${PROPERTY_SLUG}`);
    await expect(page.getByTestId('public-location-text-only')).toBeVisible();
    await expect(page.getByTestId('public-approx-map')).toHaveCount(0);
    const htmlMissing = await page.content();
    expect(htmlMissing).not.toContain(UNIQUE_LAT);
    expect(htmlMissing).not.toContain(UNIQUE_LNG);
    expect(htmlMissing).not.toMatch(/data-exact-lat=/);

    await applySessionToPage(page, OWNER_EMAIL, OWNER_PASSWORD);
    await page.goto(`/ar/owner/properties/${propertyId}/edit`);
    await expect(page.getByTestId('owner-location-section')).toBeVisible({ timeout: 30_000 });
    await page.getByTestId('owner-latitude-exact').fill(UNIQUE_LAT);
    await page.getByTestId('owner-longitude-exact').fill(UNIQUE_LNG);
    await page.getByTestId('owner-generate-approx').click();
    await page.getByTestId('owner-save-location').click();
    await expect(page.getByText('تم حفظ الموقع.')).toBeVisible();
  });

  test('eligible confirmed booking shows exact map; pending/cancelled/expired do not', async ({
    page,
  }) => {
    test.setTimeout(150_000);
    const cookie = await loginViaApi(CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    const pendingSlot = await findAvailableSlot();
    const pending = await createBookingViaApi(cookie, pendingSlot, 2);
    expect(pending.bookingId).toBeTruthy();
    const pendingId = pending.bookingId!;

    await applySessionToPage(page, CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    await page.goto('/ar/account/bookings');
    await expect(page.getByTestId('booking-card').first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId(`booking-arrival-${pendingId}`)).toHaveCount(0);
    await expect(page.getByTestId(`booking-exact-map-${pendingId}`)).toHaveCount(0);

    const confirmedSlot = await findAvailableSlot();
    const confirmed = await createBookingViaApi(cookie, confirmedSlot, 2);
    expect(confirmed.bookingId).toBeTruthy();
    const confirmedId = confirmed.bookingId!;
    await payFully(cookie, confirmedId);

    await page.goto('/ar/account/bookings');
    await expect(page.getByTestId(`booking-arrival-${confirmedId}`)).toBeVisible({ timeout: 30_000 });
    await waitForLeaflet(page, `booking-exact-map-${confirmedId}`);
    const exactMap = page.getByTestId(`booking-exact-map-${confirmedId}`);
    await expect(exactMap).toHaveAttribute('data-exact-lat', UNIQUE_LAT);
    await expect(exactMap).toHaveAttribute('data-exact-lng', UNIQUE_LNG);
    const mapsLink = page.getByTestId(`booking-maps-link-${confirmedId}`);
    await expect(mapsLink).toBeVisible();
    await expect(mapsLink).toHaveAttribute(
      'href',
      `https://www.google.com/maps/dir/?api=1&destination=${UNIQUE_LAT},${UNIQUE_LNG}`,
    );

    const cancelSlot = await findAvailableSlot();
    const toCancel = await createBookingViaApi(cookie, cancelSlot, 2);
    expect(toCancel.bookingId).toBeTruthy();
    const cancelId = toCancel.bookingId!;
    expect(await cancelBookingViaApi(cookie, cancelId)).toBeLessThan(300);
    await page.goto('/ar/account/bookings');
    await expect(page.getByTestId(`booking-arrival-${cancelId}`)).toHaveCount(0);
    await expect(page.getByTestId(`booking-exact-map-${cancelId}`)).toHaveCount(0);

    await fetch(`${getApiBase()}/internal/bookings/${pendingId}/backdate-hold`, { method: 'POST' });
    await fetch(`${getApiBase()}/internal/payments/expire-stale`, { method: 'POST' });
    await page.goto('/ar/account/bookings');
    await expect(page.getByTestId(`booking-arrival-${pendingId}`)).toHaveCount(0);
    await expect(page.getByTestId(`booking-exact-map-${pendingId}`)).toHaveCount(0);
  });

  test('mobile map is usable and owner B cannot edit owner A', async ({ page }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await applySessionToPage(page, OWNER_EMAIL, OWNER_PASSWORD);
    await page.goto(`/ar/owner/properties/${propertyId}/edit`);
    await expect(page.getByTestId('owner-location-section')).toBeVisible({ timeout: 30_000 });
    const map = await waitForLeaflet(page, 'owner-location-map');
    const box = await map.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThan(240);
    expect(box?.width ?? 0).toBeLessThanOrEqual(390);
    await expect(map.locator('.leaflet-control-zoom')).toBeVisible();
    const before = await page.getByTestId('owner-latitude-exact').inputValue();
    await clickMap(page, 'owner-location-map', 0.3, 0.55);
    await expect.poll(async () => page.getByTestId('owner-latitude-exact').inputValue()).not.toBe(before);
    await assertNoHydrationError(page);

    await applySessionToPage(page, OWNER2_EMAIL, OWNER_PASSWORD);
    await page.goto(`/ar/owner/properties/${propertyId}/edit`);
    await expect(page.getByText(/Property not found|العقار غير موجود|تعذّر/)).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByTestId('owner-location-section')).toHaveCount(0);
    await expect(page.getByTestId('owner-location-map')).toHaveCount(0);
  });
});
