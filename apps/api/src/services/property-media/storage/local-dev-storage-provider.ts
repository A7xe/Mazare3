import { mkdir, writeFile, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import { join, resolve, extname } from 'path';
import { randomUUID } from 'crypto';
import type { StorageProvider, UploadImageResult, MediaUploadContext } from './storage-provider.interface.js';
import { requireApiUrlForMedia } from '../../../config/media-config.js';
import type { Express } from 'express';

function extFromMime(mime: string, original: string): string {
  if (mime === 'image/jpeg') return '.jpg';
  if (mime === 'image/png') return '.png';
  if (mime === 'image/webp') return '.webp';
  const ext = extname(original).toLowerCase();
  return ext || '';
}

export class LocalDevStorageProvider implements StorageProvider {
  private baseDir: string;

  constructor() {
    this.baseDir = resolve(process.cwd(), 'uploads', 'property-media');
  }

  private async ensureBaseDir(): Promise<void> {
    if (existsSync(this.baseDir)) return;
    await mkdir(this.baseDir, { recursive: true });
  }

  private resolveSafePath(storageKey: string): string {
    const normalized = storageKey.replace(/\\/g, '/');
    if (
      !normalized ||
      normalized.includes('..') ||
      normalized.startsWith('/') ||
      normalized.includes('\0')
    ) {
      throw new Error('INVALID_STORAGE_KEY');
    }
    const absolutePath = resolve(this.baseDir, normalized);
    if (absolutePath !== this.baseDir && !absolutePath.startsWith(`${this.baseDir}\\`) && !absolutePath.startsWith(`${this.baseDir}/`)) {
      throw new Error('INVALID_STORAGE_KEY');
    }
    return absolutePath;
  }

  async uploadImage(
    file: Express.Multer.File,
    ctx: MediaUploadContext,
  ): Promise<UploadImageResult> {
    await this.ensureBaseDir();

    const ext = extFromMime(file.mimetype, file.originalname);
    const storageKey = join(ctx.propertyId, `${randomUUID()}${ext}`).replaceAll('\\', '/');
    const absolutePath = this.resolveSafePath(storageKey);

    await mkdir(resolve(absolutePath, '..'), { recursive: true });
    await writeFile(absolutePath, file.buffer);

    const apiUrl = requireApiUrlForMedia();
    const url = `${apiUrl}/uploads/property-media/${storageKey}`;

    return { url, storageKey };
  }

  async deleteImage(storageKey: string): Promise<void> {
    await this.ensureBaseDir();
    try {
      await unlink(this.resolveSafePath(storageKey));
    } catch {
      // ignore missing files / invalid keys
    }
  }
}

