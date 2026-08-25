import { randomUUID } from 'crypto';
import { loadPartnerDocumentStorageConfig } from '../../config/partner-document-storage.config.js';
import type { PartnerDocumentStorage } from './storage-provider.interface.js';
import { LocalPrivateDocumentStorage } from './local-private-storage.js';
import { S3PrivateDocumentStorage } from './s3-private-storage.js';

let cached: PartnerDocumentStorage | null = null;

export function getPartnerDocumentStorage(): PartnerDocumentStorage {
  if (cached) return cached;
  const cfg = loadPartnerDocumentStorageConfig();
  if ((cfg.provider === 's3_private' || cfg.provider === 'cloudflare_r2_private') && cfg.s3) {
    cached = new S3PrivateDocumentStorage(cfg.s3, undefined, cfg.provider);
    return cached;
  }
  cached = new LocalPrivateDocumentStorage();
  return cached;
}

/** Test-only: replace the process-wide storage instance. */
export function setPartnerDocumentStorageForTests(storage: PartnerDocumentStorage | null): void {
  cached = storage;
}

function extFromMime(mime: string): string {
  if (mime === 'application/pdf') return '.pdf';
  if (mime === 'image/jpeg') return '.jpg';
  if (mime === 'image/png') return '.png';
  return '.webp';
}

export function allocatePartnerDocumentKey(ownerProfileId: string, mime: string): string {
  return `${ownerProfileId}/${randomUUID()}${extFromMime(mime)}`.replaceAll('\\', '/');
}

export async function writePartnerDocumentFile(params: {
  ownerProfileId: string;
  mime: string;
  buffer: Buffer;
}): Promise<string> {
  const storageKey = allocatePartnerDocumentKey(params.ownerProfileId, params.mime);
  await getPartnerDocumentStorage().put({
    storageKey,
    mimeType: params.mime,
    body: params.buffer,
  });
  return storageKey;
}

export async function readPartnerDocumentFile(storageKey: string): Promise<Buffer> {
  return getPartnerDocumentStorage().get(storageKey);
}

export async function deletePartnerDocumentFile(storageKey: string): Promise<void> {
  await getPartnerDocumentStorage().delete(storageKey);
}
