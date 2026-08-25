const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiFetch<T>(
  path: string,
  options?: RequestInit & { next?: { revalidate?: number } },
): Promise<T> {
  const { next, signal, ...init } = options ?? {};
  const url = `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;

  const res = await fetch(url, {
    ...init,
    signal,
    headers: {
      'Content-Type': 'application/json',
      ...init.headers,
    },
    credentials: init.credentials ?? 'same-origin',
    // Next.js forbids combining cache: 'no-store' with next.revalidate.
    ...(next !== undefined
      ? { next }
      : init.cache === 'no-store'
        ? {}
        : { next: { revalidate: 60 } }),
  });

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(
      (body as { error?: string }).error ?? 'Request failed',
      res.status,
      (body as { code?: string }).code,
      (body as { details?: unknown }).details,
    );
  }

  return body as T;
}

export function getApiBaseUrl(): string {
  return API_BASE;
}
