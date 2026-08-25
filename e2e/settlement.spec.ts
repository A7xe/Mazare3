import { test, expect } from '@playwright/test';
import { ADMIN_EMAIL, ADMIN_PASSWORD, OWNER_EMAIL, OWNER_PASSWORD, getApiBase } from './constants.js';
import { applySessionToPage } from './helpers/session.js';
import { loginViaApi } from './helpers/api.js';

test.describe('Settlement statements (10D.1)', () => {
  test('admin settlement controls and owner statement section', async ({ page }) => {
    const cookie = await loginViaApi(ADMIN_EMAIL, ADMIN_PASSWORD);
    const partnersRes = await fetch(`${getApiBase()}/admin/partners?q=owner1`, {
      headers: { Cookie: cookie },
    });
    const list = (await partnersRes.json()) as { data?: { id: string; email: string }[] };
    const ownerId = list.data?.find((p) => p.email === 'owner1@mazare3.jo')?.id;
    expect(ownerId).toBeTruthy();

    await applySessionToPage(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.goto(`/ar/admin/owners/${ownerId}`);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByTestId('admin-settlements')).toBeVisible({ timeout: 30_000 });

    await applySessionToPage(page, OWNER_EMAIL, OWNER_PASSWORD);
    await page.goto('/ar/owner/payouts');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByTestId('owner-settlements')).toBeVisible({ timeout: 30_000 });
  });
});
