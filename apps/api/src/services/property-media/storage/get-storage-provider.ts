import { AppError } from '../../../lib/errors.js';
import { isCloudinaryConfigured, loadMediaConfig } from '../../../config/media-config.js';
import {
  loadPropertyMediaStorageProvider,
  loadPublicR2MediaSettings,
  isPublicR2MediaKey,
  isLocalDevMediaKey,
  PropertyMediaStorageConfigError,
} from '../../../config/property-media-storage.config.js';
import type { StorageProvider } from './storage-provider.interface.js';
import { CloudinaryStorageProvider } from './cloudinary-storage-provider.js';
import { LocalDevStorageProvider } from './local-dev-storage-provider.js';
import { S3StorageProvider } from './s3-storage-provider.js';
import { CloudflareR2PublicStorageProvider } from './r2-public-storage-provider.js';

let cached: StorageProvider | null = null;
let cachedR2: CloudflareR2PublicStorageProvider | null = null;

export function resetActiveStorageProviderCache(): void {
  cached = null;
  cachedR2 = null;
}

function toMediaConfigError(err: unknown): AppError {
  if (err instanceof PropertyMediaStorageConfigError) {
    return new AppError(503, err.code, err.message);
  }
  if (err instanceof AppError) return err;
  return new AppError(
    503,
    'PROPERTY_MEDIA_STORAGE_MISCONFIGURED',
    'Public property media storage is not configured.',
  );
}

/** Validates provider env without instantiating storage (for QA / startup checks). */
export function assertMediaProviderReady(): void {
  try {
    const provider = loadPropertyMediaStorageProvider();
    if (provider === 'cloudinary' && !isCloudinaryConfigured()) {
      throw new AppError(
        503,
        'CLOUDINARY_NOT_CONFIGURED',
        'Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.',
      );
    }
    if (provider === 'cloudflare_r2_public') {
      loadPublicR2MediaSettings();
    }
  } catch (err) {
    throw toMediaConfigError(err);
  }
}

export function getActiveStorageProvider(): StorageProvider {
  if (cached) return cached;
  try {
    const provider = loadPropertyMediaStorageProvider();

    switch (provider) {
      case 'cloudflare_r2_public':
        cached = getPublicR2StorageProvider();
        return cached;
      case 'cloudinary':
        if (!isCloudinaryConfigured()) {
          throw new AppError(
            503,
            'CLOUDINARY_NOT_CONFIGURED',
            'Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.',
          );
        }
        cached = new CloudinaryStorageProvider();
        return cached;
      case 's3':
        cached = new S3StorageProvider();
        return cached;
      case 'local':
      default:
        cached = new LocalDevStorageProvider();
        return cached;
    }
  } catch (err) {
    throw toMediaConfigError(err);
  }
}

export function getPublicR2StorageProvider(): CloudflareR2PublicStorageProvider {
  if (cachedR2) return cachedR2;
  cachedR2 = new CloudflareR2PublicStorageProvider();
  return cachedR2;
}

export function tryGetPublicR2StorageProvider(): CloudflareR2PublicStorageProvider | null {
  try {
    return getPublicR2StorageProvider();
  } catch {
    return null;
  }
}

/** Delete by stored key shape so switching providers does not target the wrong backend. */
export async function deleteStoredPropertyMedia(storageKey: string): Promise<void> {
  if (isPublicR2MediaKey(storageKey)) {
    const r2 = tryGetPublicR2StorageProvider();
    if (r2) await r2.deleteImage(storageKey);
    return;
  }
  if (isLocalDevMediaKey(storageKey)) {
    await new LocalDevStorageProvider().deleteImage(storageKey);
    return;
  }
  if (isCloudinaryConfigured() || loadMediaConfig().provider === 'cloudinary') {
    await new CloudinaryStorageProvider().deleteImage(storageKey);
  }
}
