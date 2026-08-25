import { getAppEnv, type AppEnv } from './app-env.js';
import { ProviderNotConfiguredError } from '../services/payment/provider-not-configured.error.js';

const DEFAULT_JOR_BASE_URL = 'https://secure-jordan.paytabs.com';

/** Explicit TEST vs LIVE profile. Never inferred from Profile ID or Server Key. */
export const PAYTABS_PROFILE_MODES = ['test', 'live'] as const;
export type PaytabsProfileMode = (typeof PAYTABS_PROFILE_MODES)[number];

/**
 * Narrow operator override. Unset by default.
 * Allows PAYTABS_PROFILE_MODE=live when APP_ENV is not production.
 */
export const PAYTABS_ALLOW_LIVE_OUTSIDE_PRODUCTION_ENV =
  'PAYTABS_ALLOW_LIVE_OUTSIDE_PRODUCTION';

export class PaytabsSafetyError extends Error {
  readonly code = 'PAYTABS_PROFILE_UNSAFE';

  constructor(message: string) {
    super(message);
    this.name = 'PaytabsSafetyError';
  }
}

export type PaytabsConfig = {
  profileId: string;
  serverKey: string;
  region: string;
  currency: string;
  baseUrl: string;
  returnUrl: string;
  callbackUrl: string;
  profileMode: PaytabsProfileMode;
  profileModeValid: boolean;
  configured: boolean;
};

function isNonEmpty(value: string | undefined): boolean {
  return Boolean(value?.trim());
}

export function parsePaytabsProfileMode(
  raw: string | undefined = process.env.PAYTABS_PROFILE_MODE,
): { mode: PaytabsProfileMode; valid: boolean } {
  const value = (raw ?? 'test').trim().toLowerCase();
  if (value === '' || value === 'test') return { mode: 'test', valid: true };
  if (value === 'live') return { mode: 'live', valid: true };
  return { mode: 'test', valid: false };
}

export function isPaytabsLiveOutsideProductionAllowed(): boolean {
  return process.env[PAYTABS_ALLOW_LIVE_OUTSIDE_PRODUCTION_ENV]?.trim() === 'true';
}

export function isPaytabsConfigured(): boolean {
  return (
    isNonEmpty(process.env.PAYTABS_PROFILE_ID) &&
    isNonEmpty(process.env.PAYTABS_SERVER_KEY) &&
    isNonEmpty(process.env.PAYTABS_RETURN_URL) &&
    isNonEmpty(process.env.PAYTABS_CALLBACK_URL)
  );
}

export function loadPaytabsConfig(): PaytabsConfig {
  const profileId = process.env.PAYTABS_PROFILE_ID?.trim() ?? '';
  const serverKey = process.env.PAYTABS_SERVER_KEY?.trim() ?? '';
  const region = (process.env.PAYTABS_REGION?.trim() || 'JOR').toUpperCase();
  const currency = (process.env.PAYTABS_CURRENCY?.trim() || 'JOD').toUpperCase();
  const baseUrl = (process.env.PAYTABS_BASE_URL?.trim() || DEFAULT_JOR_BASE_URL).replace(
    /\/$/,
    '',
  );
  const returnUrl = process.env.PAYTABS_RETURN_URL?.trim() ?? '';
  const callbackUrl = process.env.PAYTABS_CALLBACK_URL?.trim() ?? '';
  const parsed = parsePaytabsProfileMode();

  return {
    profileId,
    serverKey,
    region,
    currency,
    baseUrl,
    returnUrl,
    callbackUrl,
    profileMode: parsed.mode,
    profileModeValid: parsed.valid,
    configured: isPaytabsConfigured(),
  };
}

export function maskPaytabsProfileId(profileId: string): string {
  const v = profileId.trim();
  if (!v) return '';
  if (v.length <= 4) return '****';
  return `${v.slice(0, 2)}…${v.slice(-2)}`;
}

export function paytabsUrlHost(raw: string): string | null {
  const parsed = parseHttpUrl(raw);
  return parsed?.hostname.toLowerCase() ?? null;
}

function parseHttpUrl(raw: string): URL | null {
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url;
  } catch {
    return null;
  }
}

function isLoopbackOrPrivateHostname(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host === '::1' || host === '0.0.0.0') {
    return true;
  }
  if (/^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host)) {
    return true;
  }
  const m = /^172\.(\d+)\./.exec(host);
  if (m) {
    const second = Number(m[1]);
    if (second >= 16 && second <= 31) return true;
  }
  if (host.includes(':')) {
    if (host === '::1' || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80:')) {
      return true;
    }
  }
  return false;
}

function isTemporaryDevHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === 'trycloudflare.com' || host.endsWith('.trycloudflare.com');
}

/**
 * LIVE callback/return URLs must be durable public HTTPS — not local or quick tunnels.
 * Does not hardcode a production domain.
 */
export function collectPaytabsLiveUrlErrors(raw: string, label: string): string[] {
  const errors: string[] = [];
  const trimmed = raw.trim();
  if (!trimmed) {
    errors.push(`${label} is required in live mode.`);
    return errors;
  }
  const url = parseHttpUrl(trimmed);
  if (!url) {
    errors.push(`${label} must be a valid http(s) URL.`);
    return errors;
  }
  const host = url.hostname.toLowerCase();
  if (url.protocol !== 'https:') {
    errors.push(`${label} must be HTTPS in live mode (host: ${host}).`);
  }
  if (isLoopbackOrPrivateHostname(host)) {
    errors.push(`${label} must not use localhost or a private IP in live mode (host: ${host}).`);
  }
  if (isTemporaryDevHostname(host)) {
    errors.push(`${label} must not use trycloudflare.com tunnels in live mode (host: ${host}).`);
  }
  return errors;
}

export type PaytabsSafetyContext = {
  appEnv?: AppEnv;
  paytabsSelected?: boolean;
  simulateEnabled?: boolean;
};

export function collectPaytabsSafetyErrors(
  config: PaytabsConfig = loadPaytabsConfig(),
  ctx: PaytabsSafetyContext = {},
): string[] {
  const errors: string[] = [];
  const appEnv = ctx.appEnv ?? getAppEnv();
  const paytabsSelected = ctx.paytabsSelected ?? true;
  const simulateEnabled =
    ctx.simulateEnabled ?? process.env.PAYMENT_SIMULATE_ENABLED === 'true';

  if (!config.profileModeValid) {
    errors.push('PAYTABS_PROFILE_MODE must be test or live (default test). Do not infer mode from keys.');
  }

  if (!paytabsSelected) {
    return errors;
  }

  if (!config.configured) {
    errors.push(
      'PAYMENT_GATEWAY_PROVIDER=paytabs requires PAYTABS_PROFILE_ID, PAYTABS_SERVER_KEY, PAYTABS_RETURN_URL, and PAYTABS_CALLBACK_URL.',
    );
  }

  if (config.region !== 'JOR') {
    errors.push('PAYTABS_REGION must be JOR for Mazare3 Jordan.');
  }
  if (config.currency !== 'JOD') {
    errors.push('PAYTABS_CURRENCY must be JOD.');
  }

  if (appEnv === 'production') {
    if (config.profileMode !== 'live' || !config.profileModeValid) {
      errors.push('APP_ENV=production requires PAYTABS_PROFILE_MODE=live when PayTabs is selected.');
    }
    if (simulateEnabled) {
      errors.push('PAYMENT_SIMULATE_ENABLED must not be true when APP_ENV=production.');
    }
  }

  if (config.profileMode === 'live' && config.profileModeValid) {
    if (!isNonEmpty(config.profileId)) {
      errors.push('PAYTABS_PROFILE_ID is required in live mode.');
    }
    if (!isNonEmpty(config.serverKey)) {
      errors.push('PAYTABS_SERVER_KEY is required in live mode.');
    }
    errors.push(...collectPaytabsLiveUrlErrors(config.callbackUrl, 'PAYTABS_CALLBACK_URL'));
    errors.push(...collectPaytabsLiveUrlErrors(config.returnUrl, 'PAYTABS_RETURN_URL'));

    if (appEnv !== 'production' && !isPaytabsLiveOutsideProductionAllowed()) {
      errors.push(
        `PAYTABS_PROFILE_MODE=live is blocked when APP_ENV=${appEnv}. Use TEST locally, or set ${PAYTABS_ALLOW_LIVE_OUTSIDE_PRODUCTION_ENV}=true only as a narrow operator override.`,
      );
    }
  }

  return errors;
}

export function assertPaytabsConfigured(config: PaytabsConfig = loadPaytabsConfig()): void {
  if (!config.configured) {
    throw new ProviderNotConfiguredError('paytabs');
  }
  if (config.region !== 'JOR') {
    throw new Error('PAYTABS_REGION must be JOR for Mazare3 Jordan');
  }
  if (config.currency !== 'JOD') {
    throw new Error('PAYTABS_CURRENCY must be JOD');
  }
}

/** Fail closed before any PayTabs sale/query/refund network call. */
export function assertPaytabsRuntimeSafety(config: PaytabsConfig = loadPaytabsConfig()): void {
  assertPaytabsConfigured(config);
  const errors = collectPaytabsSafetyErrors(config, { paytabsSelected: true });
  if (errors.length > 0) {
    throw new PaytabsSafetyError(errors.join(' '));
  }
}

export function redactPaytabsSecrets(text: string, serverKey?: string): string {
  let out = text;
  const key = serverKey?.trim();
  if (key) out = out.split(key).join('[redacted]');
  out = out.replace(/authorization\s*[:=]\s*["']?[^"'\s]+/gi, 'Authorization:[redacted]');
  out = out.replace(/\b\d{13,19}\b/g, '[redacted]');
  return out;
}

/** Operator-safe diagnostics — never includes server key, auth headers, or full secret env values. */
export function getPaytabsSafeDiagnostics(config: PaytabsConfig = loadPaytabsConfig()): {
  provider: 'paytabs';
  profileMode: PaytabsProfileMode | 'invalid';
  region: string;
  currency: string;
  profileIdMasked: string;
  callbackHost: string | null;
  returnHost: string | null;
  configured: boolean;
} {
  return {
    provider: 'paytabs',
    profileMode: config.profileModeValid ? config.profileMode : 'invalid',
    region: config.region,
    currency: config.currency,
    profileIdMasked: maskPaytabsProfileId(config.profileId),
    callbackHost: paytabsUrlHost(config.callbackUrl),
    returnHost: paytabsUrlHost(config.returnUrl),
    configured: config.configured,
  };
}

/** @deprecated Prefer getPaytabsSafeDiagnostics — kept for existing imports. */
export function getPaytabsPublicDiagnostics(): {
  configured: boolean;
  region: string;
  currency: string;
  baseUrl: string;
} {
  const c = loadPaytabsConfig();
  return {
    configured: c.configured,
    region: c.region,
    currency: c.currency,
    baseUrl: c.baseUrl,
  };
}
