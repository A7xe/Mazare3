import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { AppError } from '../../lib/errors.js';
import type { PartnerDocumentStorageConfig } from '../../config/partner-document-storage.config.js';
import type { PartnerDocumentObject, PartnerDocumentStorage } from './storage-provider.interface.js';

function assertKey(storageKey: string): string {
  const normalized = storageKey.replace(/\\/g, '/');
  if (!normalized || normalized.includes('..') || normalized.startsWith('/') || normalized.includes('\0')) {
    throw new AppError(400, 'INVALID_STORAGE_KEY', 'Invalid document key');
  }
  return normalized;
}

export class S3PrivateDocumentStorage implements PartnerDocumentStorage {
  readonly providerName: 's3_private' | 'cloudflare_r2_private';
  private readonly bucket: string;
  private readonly client: S3Client;

  constructor(
    cfg: NonNullable<PartnerDocumentStorageConfig['s3']>,
    client?: { send: (command: unknown) => Promise<unknown> },
    providerName: 's3_private' | 'cloudflare_r2_private' = 's3_private',
  ) {
    this.providerName = providerName;
    this.bucket = cfg.bucket;
    this.client =
      (client as S3Client | undefined) ??
      new S3Client({
        region: cfg.region,
        endpoint: cfg.endpoint,
        forcePathStyle: cfg.forcePathStyle,
        credentials: {
          accessKeyId: cfg.accessKeyId,
          secretAccessKey: cfg.secretAccessKey,
        },
      });
  }

  async put(object: PartnerDocumentObject): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: assertKey(object.storageKey),
        Body: object.body,
        ContentType: object.mimeType,
      }),
    );
  }

  async get(storageKey: string): Promise<Buffer> {
    const res = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: assertKey(storageKey),
      }),
    );
    const bytes = await res.Body?.transformToByteArray();
    if (!bytes) {
      throw new AppError(404, 'NOT_FOUND', 'Document file not found');
    }
    return Buffer.from(bytes);
  }

  async delete(storageKey: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: assertKey(storageKey),
      }),
    );
  }
}
