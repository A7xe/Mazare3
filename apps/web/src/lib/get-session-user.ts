import { cookies } from 'next/headers';
import { getApiBaseUrl } from './api';
import type { AuthUser } from './api-auth';

export async function getSessionUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const header = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');
  if (!header) return null;
  try {
    const res = await fetch(`${getApiBaseUrl()}/auth/me`, {
      headers: { Cookie: header },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { data?: { user?: AuthUser } };
    return body.data?.user ?? null;
  } catch {
    return null;
  }
}
