import { isAppEnvProduction } from './app-env.js';
import { cloudflareR2S3Endpoint } from './partner-document-storage.config.js';
import { loadMediaConfig, type MediaProvider } from './media-config.js';

export type PropertyMediaStorageProvider = MediaProvider | 'cloudflare_r2_public';

export type PublicR2CredentialSource = 'dedicated_media' | 'shared_fallback';

export type PublicR2MediaSettings = {
  endpoint: string;
  region: string;
  bucket: string;
  publicBaseUrl: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
  credentialSource: PublicR2CredentialSource;
};

export type PublicPropertyMediaSafeDiagnostics = {
  mediaCredentialsConfigured: boolean;
  mediaBucket: string;
  publicUrlHost: string;
  credentialSource: PublicR2CredentialSource | null;
};

export class PropertyMediaStorageConfigError extends Error {
  readonly code = 'PROPERTY_MEDIA_STORAGE_MISCONFIGURED';
  constructor(message: string) {
    super(message);
    this.name = 'PropertyMediaStorageConfigError';
  }
}

const PUBLIC_R2_KEY_RE =
  /^properties\/[a-zA-Z0-9_-]{8,64}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$/i;

const LOCAL_DEV_KEY_RE =
  /^[a-zA-Z0-9_-]+\/[a-zA-Z0-9._-]+\.(jpg|jpeg|png|webp)$/i;

export function loadPropertyMediaStorageProvider(): PropertyMediaStorageProvider {
  const dedicated = (process.env.PROPERTY_MEDIA_STORAGE_PROVIDER ?? '').trim().toLowerCase();
  if (!dedicated) {
    return loadMediaConfig().provider;
  }
  if (
    dedicated === 'cloudflare_r2_public' ||
    dedicated === 'local' ||
    dedicated === 'cloudinary' ||
    dedicated === 's3'
  ) {
    return dedicated;
  }
  throw new PropertyMediaStorageConfigError(
    'Unknown PROPERTY_MEDIA_STORAGE_PROVIDER. Use local, cloudinary, s3, or cloudflare_r2_public.',
  );
}

export function normalizePublicMediaBaseUrl(raw: string): string {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new PropertyMediaStorageConfigError(
      'CLOUDFLARE_R2_MEDIA_PUBLIC_URL is not a valid URL.',
    );
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new PropertyMediaStorageConfigError(
      'CLOUDFLARE_R2_MEDIA_PUBLIC_URL must be http or https.',
    );
  }
  if (parsed.username || parsed.password) {
    throw new PropertyMediaStorageConfigError(
      'CLOUDFLARE_R2_MEDIA_PUBLIC_URL must not include credentials.',
    );
  }
  const path = parsed.pathname.replace(/\/+$/, '');
  return `${parsed.origin}${path === '/' ? '' : path}`;
}

export function peekPublicMediaBaseUrl(): string | null {
  const raw = (process.env.CLOUDFLARE_R2_MEDIA_PUBLIC_URL ?? '').trim();
  if (!raw) return null;
  try {
    return normalizePublicMediaBaseUrl(raw);
  } catch {
    return null;
  }
}

export function isPublicR2MediaKey(storageKey: string): boolean {
  const key = storageKey.replace(/\\/g, '/');
  if (key.includes('..') || key.startsWith('/') || key.includes('\0')) return false;
  return PUBLIC_R2_KEY_RE.test(key);
}

export function isLocalDevMediaKey(storageKey: string): boolean {
  const key = storageKey.replace(/\\/g, '/');
  if (key.includes('..') || key.startsWith('/') || key.includes('\0')) return false;
  if (key.startsWith('properties/')) return false;
  return LOCAL_DEV_KEY_RE.test(key) && key.split('/').length === 2;
}

export function assertSafePropertyIdForMediaKey(propertyId: string): string {
  if (!/^[a-zA-Z0-9_-]{8,64}$/.test(propertyId)) {
    throw new PropertyMediaStorageConfigError('Invalid property id for media object key.');
  }
  return propertyId;
}

export function buildPublicPropertyMediaUrl(publicBaseUrl: string, storageKey: string): string {
  const base = publicBaseUrl.replace(/\/+$/, '');
  const key = storageKey.replace(/^\/+/, '').replace(/\\/g, '/');
  return `${base}/${key}`;
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return '[invalid-url]';
  }
}

/**
 * Public-media R2 credentials.
 * Precedence:
 * 1. CLOUDFLARE_R2_MEDIA_ACCESS_KEY_ID + CLOUDFLARE_R2_MEDIA_SECRET_ACCESS_KEY (dedicated)
 * 2. CLOUDFLARE_R2_ACCESS_KEY_ID + CLOUDFLARE_R2_SECRET_ACCESS_KEY (dev fallback only)
 * Dedicated pair, if either value is present, must be complete and wins over shared KYC keys.
 */
function readPublicR2Credentials(): {
  accessKeyId: string;
  secretAccessKey: string;
  credentialSource: PublicR2CredentialSource;
} {
  const mediaAccessKeyId = (process.env.CLOUDFLARE_R2_MEDIA_ACCESS_KEY_ID ?? '').trim();
  const mediaSecretAccessKey = (process.env.CLOUDFLARE_R2_MEDIA_SECRET_ACCESS_KEY ?? '').trim();
  const sharedAccessKeyId = (process.env.CLOUDFLARE_R2_ACCESS_KEY_ID ?? '').trim();
  const sharedSecretAccessKey = (process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY ?? '').trim();

  if (mediaAccessKeyId || mediaSecretAccessKey) {
    const missing = [
      !mediaAccessKeyId && 'CLOUDFLARE_R2_MEDIA_ACCESS_KEY_ID',
      !mediaSecretAccessKey && 'CLOUDFLARE_R2_MEDIA_SECRET_ACCESS_KEY',
    ].filter(Boolean) as string[];
    if (missing.length) {
      throw new PropertyMediaStorageConfigError(
        `cloudflare_r2_public dedicated media credentials are incomplete. Missing: ${missing.join(', ')}. Values are not printed.`,
      );
    }
    return {
      accessKeyId: mediaAccessKeyId,
      secretAccessKey: mediaSecretAccessKey,
      credentialSource: 'dedicated_media',
    };
  }

  if (sharedAccessKeyId && sharedSecretAccessKey) {
    return {
      accessKeyId: sharedAccessKeyId,
      secretAccessKey: sharedSecretAccessKey,
      credentialSource: 'shared_fallback',
    };
  }

  throw new PropertyMediaStorageConfigError(
    'cloudflare_r2_public storage is incomplete. Missing: CLOUDFLARE_R2_MEDIA_ACCESS_KEY_ID, CLOUDFLARE_R2_MEDIA_SECRET_ACCESS_KEY. Shared CLOUDFLARE_R2_ACCESS_KEY_ID / CLOUDFLARE_R2_SECRET_ACCESS_KEY fallback is also unset. Values are not printed.',
  );
}

function readPublicR2Settings(): PublicR2MediaSettings {
  const accountId = (process.env.CLOUDFLARE_R2_ACCOUNT_ID ?? '').trim();
  const bucket = (process.env.CLOUDFLARE_R2_MEDIA_BUCKET ?? '').trim();
  const endpointOverride = (process.env.CLOUDFLARE_R2_S3_ENDPOINT ?? '').trim();
  const region = (process.env.CLOUDFLARE_R2_REGION ?? 'auto').trim() || 'auto';
  const publicUrlRaw = (process.env.CLOUDFLARE_R2_MEDIA_PUBLIC_URL ?? '').trim();
  const kycBucket = (process.env.CLOUDFLARE_R2_BUCKET ?? '').trim();

  const missing = [
    !accountId && 'CLOUDFLARE_R2_ACCOUNT_ID',
    !bucket && 'CLOUDFLARE_R2_MEDIA_BUCKET',
    !publicUrlRaw && 'CLOUDFLARE_R2_MEDIA_PUBLIC_URL',
  ].filter(Boolean) as string[];

  if (missing.length) {
    throw new PropertyMediaStorageConfigError(
      `cloudflare_r2_public storage is incomplete. Missing: ${missing.join(', ')}. Values are not printed.`,
    );
  }

  if (kycBucket && bucket === kycBucket) {
    throw new PropertyMediaStorageConfigError(
      'CLOUDFLARE_R2_MEDIA_BUCKET must be a dedicated public-media bucket and must not equal CLOUDFLARE_R2_BUCKET (private KYC).',
    );
  }

  const publicBaseUrl = normalizePublicMediaBaseUrl(publicUrlRaw);
  if (isAppEnvProduction() && !publicBaseUrl.startsWith('https://')) {
    throw new PropertyMediaStorageConfigError(
      'CLOUDFLARE_R2_MEDIA_PUBLIC_URL must use https in production.',
    );
  }

  const credentials = readPublicR2Credentials();

  return {
    endpoint: endpointOverride || cloudflareR2S3Endpoint(accountId),
    region,
    bucket,
    publicBaseUrl,
    accessKeyId: credentials.accessKeyId,
    secretAccessKey: credentials.secretAccessKey,
    forcePathStyle: true,
    credentialSource: credentials.credentialSource,
  };
}

export function loadPublicR2MediaSettings(): PublicR2MediaSettings {
  return readPublicR2Settings();
}

export function getPublicPropertyMediaSafeDiagnostics(): PublicPropertyMediaSafeDiagnostics {
  const provider = loadPropertyMediaStorageProvider();
  if (provider !== 'cloudflare_r2_public') {
    return {
      mediaCredentialsConfigured: false,
      mediaBucket: '',
      publicUrlHost: '',
      credentialSource: null,
    };
  }
  const r2 = readPublicR2Settings();
  return {
    mediaCredentialsConfigured: true,
    mediaBucket: r2.bucket,
    publicUrlHost: hostOf(r2.publicBaseUrl),
    credentialSource: r2.credentialSource,
  };
}

export function loadPropertyMediaStorageConfig(): {
  provider: PropertyMediaStorageProvider;
  r2: PublicR2MediaSettings | null;
} {
  const provider = loadPropertyMediaStorageProvider();
  if (provider === 'cloudflare_r2_public') {
    return { provider, r2: readPublicR2Settings() };
  }
  return { provider, r2: null };
}

export function validatePropertyMediaStorageAtStartup(): void {
  const cfg = loadPropertyMediaStorageConfig();
  if (cfg.provider === 'cloudflare_r2_public' && !cfg.r2) {
    throw new PropertyMediaStorageConfigError(
      'cloudflare_r2_public storage is incomplete. Values are not printed.',
    );
  }
}
