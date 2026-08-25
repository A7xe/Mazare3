import type { StorageProvider, UploadImageResult } from './storage-provider.interface.js';

export class S3StorageProvider implements StorageProvider {
  async uploadImage(): Promise<UploadImageResult> {
    throw new Error('S3_STORAGE_NOT_CONFIGURED');
  }

  async deleteImage(): Promise<void> {
    throw new Error('S3_STORAGE_NOT_CONFIGURED');
  }
}

