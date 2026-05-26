import { test, expect } from '@playwright/test';
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  CUSTOMER_EMAIL,
  CUSTOMER_PASSWORD,
} from './constants.js';
import { applySessionToPage } from './helpers/session.js';

test.describe('Owner onboarding E2E', () => {
  test('customer submits application on become-owner', async ({ page }) => {
    await applySessionToPage(page, CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    await page.goto('/ar/become-owner');
    await expect(page.getByTestId('become-owner-page')).toBeVisible({ timeout: 20_000 });

    const status = page.getByTestId('owner-application-status');
    const alreadyPending = page.getByText(/طلب قيد المراجعة|already have a pending/i);
    if (
      (await status.isVisible().catch(() => false)) ||
      (await alreadyPending.isVisible().catch(() => false))
    ) {
      return;
    }

    await page.getByTestId('owner-apply-displayName').fill('زبون تجريبي مالك');
    await page.getByTestId('owner-apply-phone').fill('0790000099');
    await page.getByTestId('owner-apply-city').fill('عمان');
    await page.getByTestId('owner-apply-area').fill('العبدلي');
    await page.getByTestId('owner-apply-bio').fill(
      'أريد إضافة مزرعة عائلية على المنصة مع إدارة حجوزات واضحة ودعم من الفريق.',
    );
    await page.getByTestId('owner-apply-terms').check();
    await page.getByTestId('owner-apply-submit').click();
    await expect(page.getByTestId('owner-application-status')).toBeVisible({
      timeout: 15_000,
    });
  });

  test('admin sees owners page with review actions', async ({ page }) => {
    await applySessionToPage(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.goto('/ar/admin/owners');
    await expect(page.getByTestId('admin-owners')).toBeVisible({ timeout: 30_000 });
  });
});

test.describe('Onboarding guards', () => {
  test('customer without approval does not see owner dashboard link', async ({ page }) => {
    await applySessionToPage(page, CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    await page.goto('/ar');
    await expect(page.getByTestId('nav-owner-dashboard')).toHaveCount(0);
  });
});
