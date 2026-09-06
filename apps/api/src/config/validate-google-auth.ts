import { isAppEnvProduction } from './app-env.js';
import { isGoogleAuthFlagEnabled, loadGoogleAuthConfig } from './google-auth-config.js';

export class GoogleAuthStartupError extends Error {
  readonly code = 'GOOGLE_AUTH_MISCONFIGURED';

  constructor(message: string) {
    super(message);
    this.name = 'GoogleAuthStartupError';
  }
}

function isLocalhostUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.hostname === 'localhost' || u.hostname === '127.0.0.1' || u.hostname === '::1';
  } catch {
    return false;
  }
}

/**
 * Production: if Google auth is explicitly enabled, require valid credentials + HTTPS redirect.
 * Local/dev: missing Google config is fine (routes return unavailable).
 */
export function validateGoogleAuthAtStartup(): void {
  if (!isGoogleAuthFlagEnabled()) {
    return;
  }

  const cfg = loadGoogleAuthConfig();
  if (!cfg) {
    if (isAppEnvProduction()) {
      throw new GoogleAuthStartupError(
        'GOOGLE_AUTH_ENABLED=true requires GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI',
      );
    }
    console.warn(
      '[api] google: GOOGLE_AUTH_ENABLED=true but credentials incomplete — Google auth unavailable until configured',
    );
    return;
  }

  if (isAppEnvProduction()) {
    let parsed: URL;
    try {
      parsed = new URL(cfg.redirectUri);
    } catch {
      throw new GoogleAuthStartupError('GOOGLE_REDIRECT_URI must be a valid absolute URL');
    }
    if (parsed.protocol !== 'https:') {
      throw new GoogleAuthStartupError('GOOGLE_REDIRECT_URI must use HTTPS in production');
    }
    if (isLocalhostUrl(cfg.redirectUri)) {
      throw new GoogleAuthStartupError('GOOGLE_REDIRECT_URI must not be localhost in production');
    }
  }
}
