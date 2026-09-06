/**
 * UA-3 — Google OIDC protocol client (authorization code + PKCE + ID token).
 * Separated from Mazare3 account resolution so Web callback and Flutter ID-token
 * paths share one identity resolver.
 */
import * as oidc from 'openid-client';
import * as jose from 'jose';
import {
  GOOGLE_OIDC_ISSUER,
  GOOGLE_OIDC_SCOPES,
  loadGoogleAuthConfig,
  type GoogleAuthConfig,
} from '../../config/google-auth-config.js';
import { isAppEnvProduction } from '../../config/app-env.js';
import { AppError } from '../../lib/errors.js';
import {
  generateOAuthNonce,
  generateOAuthState,
  generatePkceVerifier,
  pkceS256Challenge,
} from '../../lib/google-oauth-transaction.js';

export type VerifiedGoogleIdentity = {
  sub: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
};

type IdTokenVerifier = (
  idToken: string,
  opts?: { expectedNonce?: string },
) => Promise<VerifiedGoogleIdentity>;

type CodeExchanger = (input: {
  callbackUrl: URL;
  codeVerifier: string;
  expectedState: string;
  expectedNonce: string;
}) => Promise<VerifiedGoogleIdentity>;

let cachedConfig: oidc.Configuration | null = null;
let cachedKey: string | null = null;
let googleJwks: jose.JWTVerifyGetKey | null = null;

let idTokenVerifierOverride: IdTokenVerifier | null = null;
let codeExchangerOverride: CodeExchanger | null = null;

function assertQaOverrideAllowed(): void {
  if (isAppEnvProduction()) {
    throw new Error('Google OIDC QA overrides are forbidden in production');
  }
}

/** Test-only seam — never expose as a public route. */
export function setGoogleOidcMocksForQa(mocks: {
  verifyIdToken?: IdTokenVerifier;
  exchangeCode?: CodeExchanger;
}): void {
  assertQaOverrideAllowed();
  if (mocks.verifyIdToken) idTokenVerifierOverride = mocks.verifyIdToken;
  if (mocks.exchangeCode) codeExchangerOverride = mocks.exchangeCode;
}

export function resetGoogleOidcMocksForQa(): void {
  idTokenVerifierOverride = null;
  codeExchangerOverride = null;
}

function requireConfig(): GoogleAuthConfig {
  const cfg = loadGoogleAuthConfig();
  if (!cfg) {
    throw new AppError(503, 'GOOGLE_AUTH_UNAVAILABLE', 'Google sign-in is not available');
  }
  return cfg;
}

async function getOidcConfiguration(): Promise<{
  cfg: GoogleAuthConfig;
  oidcCfg: oidc.Configuration;
}> {
  const cfg = requireConfig();
  const key = `${cfg.clientId}:${cfg.redirectUri}`;
  if (cachedConfig && cachedKey === key) {
    return { cfg, oidcCfg: cachedConfig };
  }
  const oidcCfg = await oidc.discovery(
    new URL(GOOGLE_OIDC_ISSUER),
    cfg.clientId,
    cfg.clientSecret,
  );
  cachedConfig = oidcCfg;
  cachedKey = key;
  return { cfg, oidcCfg };
}

/** Clear discovery cache (tests). */
export function resetGoogleOidcDiscoveryCacheForQa(): void {
  cachedConfig = null;
  cachedKey = null;
  googleJwks = null;
}

export type GoogleAuthorizationStart = {
  authorizationUrl: string;
  state: string;
  nonce: string;
  codeVerifier: string;
};

export async function buildGoogleAuthorizationRequest(): Promise<GoogleAuthorizationStart> {
  const { cfg, oidcCfg } = await getOidcConfiguration();
  const state = generateOAuthState();
  const nonce = generateOAuthNonce();
  const codeVerifier = generatePkceVerifier();
  const codeChallenge = pkceS256Challenge(codeVerifier);

  const redirectTo = oidc.buildAuthorizationUrl(oidcCfg, {
    redirect_uri: cfg.redirectUri,
    scope: GOOGLE_OIDC_SCOPES,
    state,
    nonce,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  return {
    authorizationUrl: redirectTo.href,
    state,
    nonce,
    codeVerifier,
  };
}

function claimsToIdentity(claims: Record<string, unknown>): VerifiedGoogleIdentity {
  const sub = typeof claims.sub === 'string' ? claims.sub : '';
  if (!sub) {
    throw new AppError(401, 'GOOGLE_AUTH_FAILED', 'Google sign-in failed');
  }
  const email = typeof claims.email === 'string' ? claims.email : null;
  const emailVerified = claims.email_verified === true || claims.email_verified === 'true';
  const name = typeof claims.name === 'string' ? claims.name : null;
  return { sub, email, emailVerified, name };
}

export async function exchangeGoogleAuthorizationCode(input: {
  callbackUrl: URL;
  codeVerifier: string;
  expectedState: string;
  expectedNonce: string;
}): Promise<VerifiedGoogleIdentity> {
  if (codeExchangerOverride) {
    return codeExchangerOverride(input);
  }

  const { oidcCfg } = await getOidcConfiguration();
  try {
    const tokens = await oidc.authorizationCodeGrant(oidcCfg, input.callbackUrl, {
      pkceCodeVerifier: input.codeVerifier,
      expectedState: input.expectedState,
      expectedNonce: input.expectedNonce,
    });
    const claims = tokens.claims();
    if (!claims) {
      throw new AppError(401, 'GOOGLE_AUTH_FAILED', 'Google sign-in failed');
    }
    return claimsToIdentity(claims as unknown as Record<string, unknown>);
  } catch (err) {
    if (err instanceof AppError) throw err;
    console.warn('[api] google: authorization code exchange failed', {
      provider: 'google',
      category: 'token_exchange',
    });
    throw new AppError(401, 'GOOGLE_AUTH_FAILED', 'Google sign-in failed');
  }
}

function getGoogleJwks(): jose.JWTVerifyGetKey {
  if (!googleJwks) {
    googleJwks = jose.createRemoteJWKSet(
      new URL('https://www.googleapis.com/oauth2/v3/certs'),
    );
  }
  return googleJwks;
}

/**
 * Future Flutter path: verify a Google ID token (audience = client id).
 * Uses the same VerifiedGoogleIdentity shape as the Web code flow.
 */
export async function verifyGoogleIdToken(
  idToken: string,
  opts?: { expectedNonce?: string },
): Promise<VerifiedGoogleIdentity> {
  if (idTokenVerifierOverride) {
    return idTokenVerifierOverride(idToken, opts);
  }

  const cfg = requireConfig();
  try {
    const { payload } = await jose.jwtVerify(idToken, getGoogleJwks(), {
      issuer: [GOOGLE_OIDC_ISSUER, 'accounts.google.com'],
      audience: cfg.clientId,
    });
    if (opts?.expectedNonce) {
      if (typeof payload.nonce !== 'string' || payload.nonce !== opts.expectedNonce) {
        throw new AppError(401, 'GOOGLE_AUTH_FAILED', 'Google sign-in failed');
      }
    }
    return claimsToIdentity(payload as unknown as Record<string, unknown>);
  } catch (err) {
    if (err instanceof AppError) throw err;
    console.warn('[api] google: id token verification failed', {
      provider: 'google',
      category: 'id_token',
    });
    throw new AppError(401, 'GOOGLE_AUTH_FAILED', 'Google sign-in failed');
  }
}
