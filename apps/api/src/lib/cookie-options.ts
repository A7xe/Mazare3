import { getAppEnv, isAppEnvLocal, isAppEnvProduction, isAppEnvStaging } from '../config/app-env.js';

export type CookieSameSite = 'lax' | 'strict' | 'none';

function parseSameSite(raw: string | undefined): CookieSameSite {
  const value = (raw ?? 'lax').trim().toLowerCase();
  if (value === 'strict' || value === 'none') return value;
  return 'lax';
}

function resolveCookieSecure(): boolean {
  const raw = process.env.COOKIE_SECURE?.trim().toLowerCase();
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  // Defaults: HTTPS staging + production → secure; local HTTP → not secure
  if (isAppEnvProduction() || isAppEnvStaging()) return true;
  if (isAppEnvLocal()) return false;
  return false;
}

export function getSessionCookieOptions(): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: CookieSameSite;
  maxAge: number;
  path: string;
  domain?: string;
} {
  const sameSite = parseSameSite(process.env.COOKIE_SAME_SITE);
  const secure = resolveCookieSecure();

  if (sameSite === 'none' && !secure) {
    throw new Error(
      'COOKIE_SAME_SITE=none requires COOKIE_SECURE=true (browser requirement)',
    );
  }

  const domain = process.env.COOKIE_DOMAIN?.trim() || undefined;

  return {
    httpOnly: true,
    secure,
    sameSite,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
    ...(domain ? { domain } : {}),
  };
}

/** Log-friendly label at startup */
export function describeCookiePolicy(): string {
  const opts = getSessionCookieOptions();
  const env = getAppEnv();
  return `APP_ENV=${env} cookie secure=${opts.secure} sameSite=${opts.sameSite}${opts.domain ? ` domain=${opts.domain}` : ''}`;
}
