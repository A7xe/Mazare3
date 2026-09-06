import type { APIRequestContext, Page } from '@playwright/test';
import { getApiBase } from '../constants.js';

export function ua6aEmail(tag: string): string {
  const stamp = `${Date.now()}.${Math.floor(Math.random() * 1e6)}`;
  return `ua6a.${tag}.${stamp}@example.com`;
}

/** Reserved QA mobiles: +962799xxxxxx */
export function ua6aPhone(): string {
  const n = Math.floor(100000 + Math.random() * 900000);
  return `+962799${n}`;
}

export async function mockCapabilities(
  page: Page,
  caps: { phone: boolean; google: boolean; email?: boolean },
) {
  await page.route('**/api/v1/auth/capabilities', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          phone: { available: caps.phone },
          google: { available: caps.google },
          emailPassword: { available: caps.email !== false },
        },
      }),
    });
  });
}

async function internalJson<T>(
  request: APIRequestContext,
  method: 'GET' | 'POST',
  path: string,
  body?: unknown,
): Promise<T> {
  const url = `${getApiBase()}/internal${path}`;
  const res = await request.fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    data: body,
  });
  if (!res.ok()) {
    const text = await res.text();
    throw new Error(`Internal ${method} ${path} failed (${res.status()}): ${text}`);
  }
  return (await res.json()) as T;
}

export async function createPasswordFixture(
  request: APIRequestContext,
  opts: {
    email: string;
    password: string;
    name?: string;
    phone?: string | null;
    attachPasswordIdentity?: boolean;
  },
) {
  return internalJson<{
    data: { id: string; email: string; phone: string | null; role: string };
  }>(request, 'POST', '/qa/users/create-password', opts);
}

export async function attachPhoneIdentity(
  request: APIRequestContext,
  email: string,
  phone: string,
) {
  return internalJson(request, 'POST', '/qa/users/attach-phone-identity', { email, phone });
}

export async function attachGoogleIdentity(
  request: APIRequestContext,
  email: string,
  sub: string,
) {
  return internalJson(request, 'POST', '/qa/users/attach-google-identity', { email, sub });
}

export async function cleanupUa6aFixtures(
  request: APIRequestContext,
  opts: { emails?: string[]; phones?: string[] },
) {
  if (!opts.emails?.length && !opts.phones?.length) return;
  await internalJson(request, 'POST', '/qa/users/cleanup', {
    emails: opts.emails ?? [],
    phones: opts.phones ?? [],
  }).catch(() => undefined);
}

export async function setGoogleOidcMock(
  request: APIRequestContext,
  identity: {
    sub: string;
    email: string | null;
    emailVerified?: boolean;
    name?: string | null;
  },
) {
  return internalJson(request, 'POST', '/qa/google-oidc-mock', { identity });
}

export async function resetGoogleOidcMock(request: APIRequestContext) {
  return internalJson(request, 'POST', '/qa/google-oidc-mock', { reset: true }).catch(
    () => undefined,
  );
}

export async function latestSmsOtp(request: APIRequestContext, phone: string) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const res = await request.get(
      `${getApiBase()}/internal/sms-otp-outbox/latest?phone=${encodeURIComponent(phone)}`,
    );
    if (res.ok()) {
      const body = (await res.json()) as { data: { code: string; toE164: string } };
      return body.data;
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`OTP outbox miss for ${phone}`);
}

export async function googleIdTokenAuth(
  request: APIRequestContext,
  opts?: { locale?: 'ar' | 'en' },
) {
  const res = await request.post(`${getApiBase()}/auth/google/id-token`, {
    data: { idToken: 'ua6a-mock-id-token-xxxxxxxx', locale: opts?.locale ?? 'ar' },
  });
  const body = (await res.json().catch(() => ({}))) as {
    data?: unknown;
    code?: string;
    error?: string;
  };
  return { status: res.status(), body, headers: res.headers() };
}

export async function fillOtpDigits(page: Page, code: string) {
  const digits = code.replace(/\D/g, '').slice(0, 6).split('');
  for (let i = 0; i < digits.length; i++) {
    await page.getByTestId(`auth-otp-digit-${i}`).fill(digits[i]!);
  }
}

export async function storageHasSensitive(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const hits: string[] = [];
    const scan = (store: Storage, label: string) => {
      for (let i = 0; i < store.length; i++) {
        const key = store.key(i) ?? '';
        const val = store.getItem(key) ?? '';
        const blob = `${key}=${val}`.toLowerCase();
        if (
          /otp|id_token|access_token|refresh_token|pkce|code_verifier|identity_link|provider_subject|google_sub/.test(
            blob,
          )
        ) {
          hits.push(`${label}:${key}`);
        }
      }
    };
    scan(localStorage, 'local');
    scan(sessionStorage, 'session');
    return hits;
  });
}
