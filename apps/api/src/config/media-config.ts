import { AppError } from '../lib/errors.js';

export type MediaProvider = 'local' | 'cloudinary' | 's3';

function parseNumber(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

export type MediaConfig = {
  provider: MediaProvider;
  maxUploadBytes: number;
  allowedImageMimes: string[];
  apiUrl: string;
};

export type CloudinaryEnvConfig = {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
};

export function loadMediaConfig(): MediaConfig {
  const providerRaw = (process.env.MEDIA_PROVIDER ?? 'local').trim().toLowerCase();
  const provider: MediaProvider =
    providerRaw === 'cloudinary' ? 'cloudinary' : providerRaw === 's3' ? 's3' : 'local';

  const maxMb = parseNumber(process.env.MAX_UPLOAD_SIZE_MB, 8);
  const maxUploadBytes = Math.max(1, Math.floor(maxMb * 1024 * 1024));

  const allowedImageMimes = (process.env.ALLOWED_IMAGE_TYPES ??
    'image/jpeg,image/png,image/webp')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)
    .filter((m) => m !== 'image/svg+xml');

  const apiUrl = (process.env.API_URL ?? '').trim();

  return { provider, maxUploadBytes, allowedImageMimes, apiUrl };
}

export function loadCloudinaryEnvConfig(): CloudinaryEnvConfig | null {
  const cloudName = (process.env.CLOUDINARY_CLOUD_NAME ?? '').trim();
  const apiKey = (process.env.CLOUDINARY_API_KEY ?? '').trim();
  const apiSecret = (process.env.CLOUDINARY_API_SECRET ?? '').trim();
  if (!cloudName || !apiKey || !apiSecret) {
    return null;
  }
  return { cloudName, apiKey, apiSecret };
}

export function isCloudinaryConfigured(): boolean {
  return loadCloudinaryEnvConfig() !== null;
}

export function assertCloudinaryConfigured(): CloudinaryEnvConfig {
  const cfg = loadCloudinaryEnvConfig();
  if (!cfg) {
    throw new AppError(
      503,
      'CLOUDINARY_NOT_CONFIGURED',
      'Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.',
    );
  }
  return cfg;
}

export function isAllowedImageMime(mime: string, allowed: string[]): boolean {
  if (mime === 'image/svg+xml') return false;
  return allowed.includes(mime);
}

export function requireApiUrlForMedia(): string {
  const { apiUrl } = loadMediaConfig();
  if (!apiUrl) {
    throw new Error(
      'API_URL is required for MEDIA uploads (to build public media URLs).',
    );
  }
  return apiUrl;
}
