import { test, expect } from '@playwright/test';
import { getApiBase } from './constants.js';
import { applySessionToPage } from './helpers/session.js';

const MEDIA_QA_EMAIL = 'owner.media.qa@mazare3.local';
const MEDIA_QA_PASSWORD = 'Mazare3-QA-2026!';
const MEDIA_QA_PROPERTY_ID = 'cmsx7kp140008uv80ylwkhyzv';

/** Minimal valid 1×1 PNG (magic bytes accepted by property-media upload). */
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

async function assertThumbsVisible(page: import('@playwright/test').Page, minCount = 1) {
  const thumbs = page.getByTestId('owner-media-thumb');
  await expect(thumbs.first()).toBeVisible({ timeout: 20_000 });
  const count = await thumbs.count();
  expect(count).toBeGreaterThanOrEqual(minCount);
  for (let i = 0; i < count; i++) {
    const box = await thumbs.nth(i).boundingBox();
    expect(box?.height ?? 0, `thumbnail ${i} should have layout height`).toBeGreaterThan(80);
    const img = thumbs.nth(i).locator('img').first();
    await expect(img).toBeVisible();
    await expect
      .poll(async () => img.evaluate((el) => (el as HTMLImageElement).naturalWidth), {
        timeout: 20_000,
      })
      .toBeGreaterThan(0);
  }
}

test.describe('Owner property media editor', () => {
  test.describe.configure({ retries: 0 });

  test('existing R2 images render, upload/cover/reorder/delete, Arabic + English + mobile', async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await applySessionToPage(page, MEDIA_QA_EMAIL, MEDIA_QA_PASSWORD);
    await page.goto(`/ar/owner/properties/${MEDIA_QA_PROPERTY_ID}/edit`);
    await expect(page.getByTestId('owner-media-editor')).toBeVisible({ timeout: 30_000 });

    const editor = page.getByTestId('owner-media-editor');
    const visibleText = await editor.innerText();
    expect(visibleText).not.toMatch(/Choose Files/i);
    expect(visibleText).not.toMatch(/selected \d/i);
    expect(visibleText).toContain('اختر الصور');
    expect(visibleText).toContain('صورة الغلاف');

    await assertThumbsVisible(page, 1);
    await expect(page.getByTestId('owner-media-cover-badge').first()).toBeVisible();

    const cards = page.getByTestId('owner-media-card');
    const beforeCount = await cards.count();
    expect(beforeCount).toBeGreaterThanOrEqual(1);

    await page.locator('#owner-media-file-input').setInputFiles({
      name: 'qa-owner-media.png',
      mimeType: 'image/png',
      buffer: TINY_PNG,
    });
    await expect(page.getByText(/تم اختيار 1 ملف/)).toBeVisible();
    await page.getByTestId('owner-media-upload-cta').click();
    await expect(page.getByText(/تم رفع 1 صورة/)).toBeVisible({ timeout: 45_000 });
    await expect(cards).toHaveCount(beforeCount + 1, { timeout: 20_000 });
    await assertThumbsVisible(page, beforeCount + 1);

    await page.reload();
    await expect(page.getByTestId('owner-media-editor')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('owner-media-card')).toHaveCount(beforeCount + 1);
    await assertThumbsVisible(page, beforeCount + 1);

    const uploadedSrc = await page
      .getByTestId('owner-media-card')
      .last()
      .locator('img')
      .first()
      .evaluate((el) => (el as HTMLImageElement).currentSrc);

    await page.getByTestId('owner-media-card').last().getByTestId('owner-media-set-cover').click();
    await expect(page.getByText(/تم تحديث صورة الغلاف/)).toBeVisible({ timeout: 20_000 });
    const coverCard = page.getByTestId('owner-media-card').first();
    await expect(coverCard.getByTestId('owner-media-cover-badge')).toBeVisible();
    const coverSrc = await coverCard.locator('img').first().evaluate((el) => (el as HTMLImageElement).currentSrc);
    expect(coverSrc).toBe(uploadedSrc);

    await coverCard.getByTestId('owner-media-move-down').click();
    await expect(page.getByText(/تم تحديث ترتيب الصور/)).toBeVisible({ timeout: 20_000 });
    const reorderedSrc = await page
      .getByTestId('owner-media-card')
      .nth(1)
      .locator('img')
      .first()
      .evaluate((el) => (el as HTMLImageElement).currentSrc);
    expect(reorderedSrc).toBe(uploadedSrc);

    await page.getByTestId('owner-media-card').nth(1).getByTestId('owner-media-delete').click();
    await expect(page.getByText(/تم حذف الصورة/)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('owner-media-card')).toHaveCount(beforeCount);

    const cookies = page.context().cookies();
    const cookieHeader = (await cookies)
      .filter((c) => c.name === 'mazare3_session')
      .map((c) => `${c.name}=${c.value}`)
      .join('; ');
    const editRes = await fetch(`${getApiBase()}/owner/properties/${MEDIA_QA_PROPERTY_ID}/edit`, {
      headers: { Cookie: cookieHeader },
    });
    const editBody = (await editRes.json()) as { data?: { media?: Array<{ url: string }> } };
    expect(editBody.data?.media?.length).toBe(beforeCount);

    await page.goto(`/en/owner/properties/${MEDIA_QA_PROPERTY_ID}/edit`);
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    const enEditor = page.getByTestId('owner-media-editor');
    await expect(enEditor).toBeVisible({ timeout: 30_000 });
    await expect(enEditor).toContainText('Choose photos');
    await expect(enEditor).toContainText('Cover photo');
    const enText = await enEditor.innerText();
    expect(enText).not.toMatch(/Choose Files/i);
    expect(enText).not.toMatch(/selected \d/i);
    await assertThumbsVisible(page, 1);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/ar/owner/properties/${MEDIA_QA_PROPERTY_ID}/edit`);
    await expect(page.getByTestId('owner-media-editor')).toBeVisible({ timeout: 30_000 });
    await assertThumbsVisible(page, 1);
    const galleryBox = await page.getByTestId('owner-media-gallery').boundingBox();
    expect(galleryBox?.width ?? 0).toBeLessThanOrEqual(390);
    const cardBox = await page.getByTestId('owner-media-card').first().boundingBox();
    expect(cardBox?.width ?? 0).toBeGreaterThan(200);
    await expect(page.getByTestId('owner-media-choose')).toBeVisible();
  });
});
