/**
 * UA-3 — Google OIDC configuration.
 * Owner does NOT need to configure Google for local development.
 * Default: disabled / unavailable when unset.
 */

function truthy(raw: string | undefined): boolean {
  const v = (raw ?? '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

export const GOOGLE_OIDC_ISSUER = 'https://accounts.google.com';
export const GOOGLE_OIDC_SCOPES = 'openid email profile';
export const GOOGLE_OAUTH_TX_TTL_MS = 10 * 60 * 1000;
export const GOOGLE_LINK_CONTINUE_TTL_MS = 15 * 60 * 1000;
export const GOOGLE_OAUTH_COOKIE_NAME = 'mazare3_google_oauth';

export type GoogleAuthConfig = {
  enabled: boolean;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

export function isGoogleAuthFlagEnabled(): boolean {
  return truthy(process.env.GOOGLE_AUTH_ENABLED);
}

export function loadGoogleAuthConfig(): GoogleAuthConfig | null {
  if (!isGoogleAuthFlagEnabled()) return null;
  const clientId = (process.env.GOOGLE_CLIENT_ID ?? '').trim();
  const clientSecret = (process.env.GOOGLE_CLIENT_SECRET ?? '').trim();
  const redirectUri = (process.env.GOOGLE_REDIRECT_URI ?? '').trim();
  if (!clientId || !clientSecret || !redirectUri) return null;
  return { enabled: true, clientId, clientSecret, redirectUri };
}

/** True when Google auth can actually run (flag + complete credentials). */
export function isGoogleAuthConfigured(): boolean {
  return loadGoogleAuthConfig() !== null;
}

export function getFrontendOrigin(): string {
  return (process.env.FRONTEND_URL ?? process.env.CORS_ORIGIN ?? 'http://localhost:3000')
    .split(',')[0]!
    .trim()
    .replace(/\/$/, '');
}
