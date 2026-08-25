import { isAppEnvProduction } from './app-env.js';

export type PartnerDocumentStorageProvider = 'local_private' | 's3_private' | 'cloudflare_r2_private';

export type PartnerObjectStorageSettings = {
  endpoint?: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
};

export type PartnerDocumentStorageConfig = {
  provider: PartnerDocumentStorageProvider;
  s3: PartnerObjectStorageSettings | null;
};

export class PartnerDocumentStorageConfigError extends Error {
  readonly code = 'PARTNER_DOCUMENT_STORAGE_MISCONFIGURED';
  constructor(message: string) {
    super(message);
    this.name = 'PartnerDocumentStorageConfigError';
  }
}

export function cloudflareR2S3Endpoint(accountId: string): string {
  return `https://${accountId}.r2.cloudflarestorage.com`;
}

function readProvider(): PartnerDocumentStorageProvider {
  const raw = (process.env.PARTNER_DOCUMENT_STORAGE_PROVIDER ?? 'local_private').trim().toLowerCase();
  if (!raw) {
    if (isAppEnvProduction()) {
      throw new PartnerDocumentStorageConfigError(
        'PARTNER_DOCUMENT_STORAGE_PROVIDER is required in production and must be cloudflare_r2_private.',
      );
    }
    return 'local_private';
  }
  if (raw === 's3_private' || raw === 'local_private' || raw === 'cloudflare_r2_private') return raw;
  throw new PartnerDocumentStorageConfigError(
    'Unknown PARTNER_DOCUMENT_STORAGE_PROVIDER. Use local_private, s3_private, or cloudflare_r2_private.',
  );
}

function readS3Config(): PartnerObjectStorageSettings {
  const endpoint = (process.env.PARTNER_DOCUMENT_S3_ENDPOINT ?? '').trim() || undefined;
  const region = (process.env.PARTNER_DOCUMENT_S3_REGION ?? '').trim();
  const bucket = (process.env.PARTNER_DOCUMENT_S3_BUCKET ?? '').trim();
  const accessKeyId = (process.env.PARTNER_DOCUMENT_S3_ACCESS_KEY_ID ?? '').trim();
  const secretAccessKey = (process.env.PARTNER_DOCUMENT_S3_SECRET_ACCESS_KEY ?? '').trim();
  const forcePathStyle = (process.env.PARTNER_DOCUMENT_S3_FORCE_PATH_STYLE ?? 'true').toLowerCase() === 'true';
  const missing = [
    !region && 'PARTNER_DOCUMENT_S3_REGION',
    !bucket && 'PARTNER_DOCUMENT_S3_BUCKET',
    !accessKeyId && 'PARTNER_DOCUMENT_S3_ACCESS_KEY_ID',
    !secretAccessKey && 'PARTNER_DOCUMENT_S3_SECRET_ACCESS_KEY',
  ].filter(Boolean) as string[];
  if (missing.length) {
    throw new PartnerDocumentStorageConfigError(
      `s3_private storage is incomplete. Missing: ${missing.join(', ')}. Values are not printed.`,
    );
  }
  return { endpoint, region, bucket, accessKeyId, secretAccessKey, forcePathStyle };
}

function readCloudflareR2Config(): PartnerObjectStorageSettings {
  const accountId = (process.env.CLOUDFLARE_R2_ACCOUNT_ID ?? '').trim();
  const bucket = (process.env.CLOUDFLARE_R2_BUCKET ?? '').trim();
  const accessKeyId = (process.env.CLOUDFLARE_R2_ACCESS_KEY_ID ?? '').trim();
  const secretAccessKey = (process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY ?? '').trim();
  const endpointOverride = (process.env.CLOUDFLARE_R2_S3_ENDPOINT ?? '').trim();
  const region = (process.env.CLOUDFLARE_R2_REGION ?? 'auto').trim() || 'auto';
  const missing = [
    !accountId && 'CLOUDFLARE_R2_ACCOUNT_ID',
    !bucket && 'CLOUDFLARE_R2_BUCKET',
    !accessKeyId && 'CLOUDFLARE_R2_ACCESS_KEY_ID',
    !secretAccessKey && 'CLOUDFLARE_R2_SECRET_ACCESS_KEY',
  ].filter(Boolean) as string[];
  if (missing.length) {
    throw new PartnerDocumentStorageConfigError(
      `cloudflare_r2_private storage is incomplete. Missing: ${missing.join(', ')}. Values are not printed.`,
    );
  }
  return {
    endpoint: endpointOverride || cloudflareR2S3Endpoint(accountId),
    region,
    bucket,
    accessKeyId,
    secretAccessKey,
    forcePathStyle: true,
  };
}

export function loadPartnerDocumentStorageConfig(): PartnerDocumentStorageConfig {
  const provider = readProvider();
  if (isAppEnvProduction() && provider === 'local_private') {
    throw new PartnerDocumentStorageConfigError(
      'PARTNER_DOCUMENT_STORAGE_PROVIDER=local_private is not allowed when APP_ENV=production. Configure cloudflare_r2_private.',
    );
  }
  if (provider === 'cloudflare_r2_private') {
    return { provider, s3: readCloudflareR2Config() };
  }
  if (provider === 's3_private') {
    return { provider, s3: readS3Config() };
  }
  return { provider: 'local_private', s3: null };
}

export function validatePartnerDocumentStorageAtStartup(): void {
  loadPartnerDocumentStorageConfig();
}
