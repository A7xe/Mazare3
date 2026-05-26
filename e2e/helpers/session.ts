import type { BrowserContext, Page } from '@playwright/test';
import { loginViaApi } from './api.js';

function parseSessionValue(cookieHeader: string): string {
  const part = cookieHeader
    .split(';')
    .map((s) => s.trim())
    .find((s) => s.startsWith('mazare3_session='));
  if (!part) throw new Error('Session cookie missing from API login');
  return part.substring('mazare3_session='.length);
}

export async function applySessionCookie(
  context: BrowserContext,
  email: string,
  password: string,
) {
  const cookieHeader = await loginViaApi(email, password);
  const value = parseSessionValue(cookieHeader);
  await context.addCookies([
    {
      name: 'mazare3_session',
      value,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
    },
  ]);
}

export async function applySessionToPage(page: Page, email: string, password: string) {
  await page.goto('/ar');
  await applySessionCookie(page.context(), email, password);
}
