import { AppError } from '../../lib/errors.js';
import type { PartnerDocumentObject, PartnerDocumentStorage } from './storage-provider.interface.js';

/** In-memory adapter for QA of atomicity and S3-shaped put/get/delete without live credentials. */
export class MemoryPrivateDocumentStorage implements PartnerDocumentStorage {
  readonly providerName = 'memory' as const;
  readonly objects = new Map<string, Buffer>();
  failNextPut = false;

  async put(object: PartnerDocumentObject): Promise<void> {
    if (this.failNextPut) {
      this.failNextPut = false;
      throw new Error('storage_put_failed');
    }
    this.objects.set(object.storageKey, Buffer.from(object.body));
  }

  async get(storageKey: string): Promise<Buffer> {
    const found = this.objects.get(storageKey);
    if (!found) throw new AppError(404, 'NOT_FOUND', 'Document file not found');
    return Buffer.from(found);
  }

  async delete(storageKey: string): Promise<void> {
    this.objects.delete(storageKey);
  }
}
