'use client';

import { getApiBaseUrl } from './api';

export interface AuthUser {
  id: string;
  email: string | null;
  name: string | null;
  role: string;
  locale: string;
  status?: string;
  createdAt?: string;
  ownerProfileStatus?: string | null;
  ownerRejectionReason?: string | null;
}

export type AuthCapabilities = {
  phone: { available: boolean };
  google: { available: boolean };
  emailPassword: { available: true };
};

export type AuthIdentitiesStatus = {
  phone: { linked: boolean; masked: string | null };
  google: { linked: boolean };
  password: { linked: boolean };
};

export class AuthApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly data?: unknown;
  readonly retryAfterSeconds?: number;

  constructor(
    message: string,
    code: string,
    status: number,
    data?: unknown,
    retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = 'AuthApiError';
    this.code = code;
    this.status = status;
    this.data = data;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

async function authFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    credentials: 'include',
  });
  const body = (await res.json().catch(() => ({}))) as {
    error?: string;
    code?: string;
    data?: unknown;
  };
  if (!res.ok) {
    const retryRaw = res.headers.get('Retry-After');
    const retryAfterSeconds =
      retryRaw && /^\d+$/.test(retryRaw) ? Number(retryRaw) : undefined;
    throw new AuthApiError(
      body.error ?? 'Request failed',
      body.code ?? 'REQUEST_FAILED',
      res.status,
      body.data,
      retryAfterSeconds,
    );
  }
  return body as T;
}

export async function signup(data: {
  name?: string;
  email: string;
  password: string;
  locale?: string;
}) {
  return authFetch<{ data: { user: AuthUser } }>('/auth/signup', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function login(data: { email: string; password: string }) {
  return authFetch<{ data: { user: AuthUser } }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function logout() {
  return authFetch<{ data: { success: boolean } }>('/auth/logout', { method: 'POST' });
}

export async function forgotPassword(data: { email: string }) {
  return authFetch<{ data: { message: string; devResetLink?: string } }>('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function resetPassword(data: { token: string; password: string }) {
  return authFetch<{ data: { success: boolean; message: string } }>('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/** In-flight dedupe for StrictMode / overlapping session refreshes. */
let meInflight: Promise<{ data: { user: AuthUser } }> | null = null;

export async function getMe() {
  if (meInflight) return meInflight;
  meInflight = authFetch<{ data: { user: AuthUser } }>('/auth/me').finally(() => {
    meInflight = null;
  });
  return meInflight;
}

export async function refreshSession() {
  return authFetch<{ data: { user: AuthUser } }>('/auth/refresh-session', { method: 'POST' });
}

/** Short-lived cache + in-flight dedupe for auth method chooser (StrictMode / multi-mount). */
const CAPABILITIES_TTL_MS = 30_000;
let capabilitiesCache: { at: number; data: AuthCapabilities } | null = null;
let capabilitiesInflight: Promise<{ data: AuthCapabilities }> | null = null;

export async function fetchAuthCapabilities() {
  const now = Date.now();
  if (capabilitiesCache && now - capabilitiesCache.at < CAPABILITIES_TTL_MS) {
    return { data: capabilitiesCache.data };
  }
  if (capabilitiesInflight) return capabilitiesInflight;

  capabilitiesInflight = (async () => {
    try {
      const res = await authFetch<{ data: AuthCapabilities }>('/auth/capabilities', {
        cache: 'no-store',
      });
      capabilitiesCache = { at: Date.now(), data: res.data };
      return res;
    } catch (err) {
      if (
        err instanceof AuthApiError &&
        (err.status === 429 || err.code === 'RATE_LIMITED' || err.code === 'AUTH_RATE_LIMITED')
      ) {
        const waitMs = Math.min(15_000, Math.max(1_000, (err.retryAfterSeconds ?? 2) * 1000));
        await new Promise((r) => setTimeout(r, waitMs));
        const retry = await authFetch<{ data: AuthCapabilities }>('/auth/capabilities', {
          cache: 'no-store',
        });
        capabilitiesCache = { at: Date.now(), data: retry.data };
        return retry;
      }
      throw err;
    } finally {
      capabilitiesInflight = null;
    }
  })();

  return capabilitiesInflight;
}

export async function fetchAuthIdentities() {
  return authFetch<{ data: AuthIdentitiesStatus }>('/auth/identities', { cache: 'no-store' });
}

export async function startPhoneOtp(data: { phone: string; returnUrl?: string | null }) {
  return authFetch<{
    data: {
      challengeId: string;
      expiresInSeconds: number;
      resendAfterSeconds: number;
      maskedPhone?: string;
    };
  }>('/auth/phone/start', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function verifyPhoneOtp(data: {
  phone: string;
  code: string;
  challengeId?: string;
  returnUrl?: string | null;
}) {
  return authFetch<{
    data: {
      outcome: 'authenticated' | 'profile_required';
      user?: AuthUser;
      continueToken?: string;
      expiresInSeconds?: number;
    };
  }>('/auth/phone/verify', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function completePhoneProfile(data: {
  continueToken: string;
  phone: string;
  name: string;
  locale?: 'ar' | 'en';
}) {
  return authFetch<{ data: { outcome: 'authenticated'; user: AuthUser } }>('/auth/phone/complete', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function completeIdentityLink(data?: { linkToken?: string }) {
  return authFetch<{
    data: {
      outcome: string;
      provider: string;
      user: AuthUser;
      returnUrl: string | null;
    };
  }>('/auth/identities/link/complete', {
    method: 'POST',
    body: JSON.stringify(data ?? {}),
  });
}

export async function startPhoneLinkOtp(data: { phone: string }) {
  return authFetch<{
    data: { challengeId: string; expiresInSeconds: number; resendAfterSeconds: number };
  }>('/auth/identities/phone/start', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function verifyPhoneLinkOtp(data: { phone: string; code: string; challengeId?: string }) {
  return authFetch<{ data: { outcome: string; provider: string; user: AuthUser } }>(
    '/auth/identities/phone/verify',
    {
      method: 'POST',
      body: JSON.stringify(data),
    },
  );
}

/** Browser navigates to API Google start (redirect). */
export function googleAuthStartUrl(returnUrl?: string | null): string {
  const q = new URLSearchParams();
  if (returnUrl) q.set('returnUrl', returnUrl);
  const qs = q.toString();
  return `${getApiBaseUrl()}/auth/google/start${qs ? `?${qs}` : ''}`;
}

export function googleLinkStartUrl(returnUrl?: string | null): string {
  const q = new URLSearchParams();
  if (returnUrl) q.set('returnUrl', returnUrl);
  const qs = q.toString();
  return `${getApiBaseUrl()}/auth/identities/google/start${qs ? `?${qs}` : ''}`;
}
