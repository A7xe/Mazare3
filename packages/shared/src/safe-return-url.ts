/**
 * Safe internal return-path validation for post-login / post-signup redirects.
 * Rejects open redirects (absolute URLs, protocol-relative, backslash tricks).
 */

const BLOCKED_PREFIXES = [
  '//',
  '/\\',
  '/login',
  '/signup',
  '/auth',
] as const;

/**
 * Returns a safe same-app path starting with `/`, or null if unsafe/empty.
 */
export function sanitizeReturnUrl(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  let value = String(raw).trim();
  if (!value) return null;

  // Decode once to catch encoded tricks like %2F%2Fevil.com
  try {
    value = decodeURIComponent(value);
  } catch {
    return null;
  }
  value = value.trim();

  if (!value.startsWith('/')) return null;
  if (value.startsWith('//') || value.startsWith('/\\')) return null;
  if (/^\/[a-z][a-z0-9+.-]*:/i.test(value)) return null; // /https:…
  if (value.includes('\\')) return null;
  if (value.includes('://')) return null;

  for (const prefix of BLOCKED_PREFIXES) {
    if (prefix === '//' || prefix === '/\\') continue;
    if (value === prefix || value.startsWith(`${prefix}/`) || value.startsWith(`${prefix}?`)) {
      return null;
    }
  }

  // Locale-prefixed auth entry paths (next-intl) — same destinations as above.
  if (/^\/(ar|en)\/(auth|login|signup)(\/|\?|$)/i.test(value)) {
    return null;
  }

  // Strip control characters
  if (/[\u0000-\u001F\u007F]/.test(value)) return null;

  return value;
}

/** Resolve a safe destination with fallback (default `/`). */
export function resolveSafeReturnUrl(
  raw: string | null | undefined,
  fallback = '/',
): string {
  return sanitizeReturnUrl(raw) ?? fallback;
}

export type AuthEntryPath = '/auth' | '/login' | '/signup';

/** Build auth entry href preserving a safe returnUrl query. */
export function authHrefWithReturn(
  path: AuthEntryPath,
  returnUrl: string | null | undefined,
  extra?: Record<string, string | undefined>,
): string {
  const q = new URLSearchParams();
  const safe = sanitizeReturnUrl(returnUrl);
  if (safe) q.set('returnUrl', safe);
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      if (v) q.set(k, v);
    }
  }
  const qs = q.toString();
  return qs ? `${path}?${qs}` : path;
}

/** Canonical marketplace auth entry (UA-6). */
export function authEntryHref(opts?: {
  returnUrl?: string | null;
  mode?: 'chooser' | 'phone' | 'email' | 'link';
  emailMode?: 'login' | 'signup';
}): string {
  return authHrefWithReturn('/auth', opts?.returnUrl, {
    mode: opts?.mode && opts.mode !== 'chooser' ? opts.mode : undefined,
    emailMode: opts?.emailMode,
  });
}
