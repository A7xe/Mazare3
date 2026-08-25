import { randomUUID } from 'crypto';
import { PutObjectCommand, DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { Express } from 'express';
import { AppError } from '../../../lib/errors.js';
import {
  assertSafePropertyIdForMediaKey,
  buildPublicPropertyMediaUrl,
  isPublicR2MediaKey,
  loadPublicR2MediaSettings,
  type PublicR2MediaSettings,
} from '../../../config/property-media-storage.config.js';
import { extForPropertyImageMime, type PropertyImageMime } from '../../../lib/property-media-file-magic.js';
import type {
  MediaUploadContext,
  StorageProvider,
  UploadImageResult,
} from './storage-provider.interface.js';

type SendableClient = { send: (command: unknown) => Promise<unknown> };

function assertPublicR2ObjectKey(storageKey: string): string {
  const key = storageKey.replace(/\\/g, '/');
  if (!isPublicR2MediaKey(key)) {
    throw new AppError(400, 'INVALID_STORAGE_KEY', 'Invalid public media object key');
  }
  return key;
}

export function buildPublicR2ObjectKey(propertyId: string, mime: PropertyImageMime): string {
  const safeId = assertSafePropertyIdForMediaKey(propertyId);
  return `properties/${safeId}/${randomUUID()}${extForPropertyImageMime(mime)}`;
}

function mapPublicR2StorageError(err: unknown): never {
  if (err instanceof AppError) throw err;
  const raw = err as { name?: string; Code?: string; $metadata?: { httpStatusCode?: number } };
  const code = (raw.Code ?? raw.name ?? '').toString();
  const status = raw.$metadata?.httpStatusCode;
  if (code === 'AccessDenied' || status === 403) {
    throw new AppError(
      503,
      'PROPERTY_MEDIA_STORAGE_DENIED',
      'Public media storage denied this request.',
    );
  }
  throw new AppError(
    503,
    'PROPERTY_MEDIA_STORAGE_FAILED',
    'Public media storage is temporarily unavailable.',
  );
}

export class CloudflareR2PublicStorageProvider implements StorageProvider {
  private readonly bucket: string;
  private readonly publicBaseUrl: string;
  private readonly client: S3Client;

  constructor(cfg?: PublicR2MediaSettings, client?: SendableClient) {
    const settings = cfg ?? loadPublicR2MediaSettings();
    this.bucket = settings.bucket;
    this.publicBaseUrl = settings.publicBaseUrl;
    this.client =
      (client as S3Client | undefined) ??
      new S3Client({
        region: settings.region,
        endpoint: settings.endpoint,
        forcePathStyle: settings.forcePathStyle,
        credentials: {
          accessKeyId: settings.accessKeyId,
          secretAccessKey: settings.secretAccessKey,
        },
      });
  }

  async uploadImage(
    file: Express.Multer.File,
    ctx: MediaUploadContext,
  ): Promise<UploadImageResult> {
    const mime = file.mimetype as PropertyImageMime;
    const storageKey = buildPublicR2ObjectKey(ctx.propertyId, mime);
    const key = assertPublicR2ObjectKey(storageKey);

    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: file.buffer,
          ContentType: mime,
          CacheControl: 'public, max-age=31536000, immutable',
        }),
      );
    } catch (err) {
      mapPublicR2StorageError(err);
    }

    return {
      url: buildPublicPropertyMediaUrl(this.publicBaseUrl, key),
      storageKey: key,
      thumbnailUrl: null,
    };
  }

  async deleteImage(storageKey: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: assertPublicR2ObjectKey(storageKey),
        }),
      );
    } catch (err) {
      mapPublicR2StorageError(err);
    }
  }
}
