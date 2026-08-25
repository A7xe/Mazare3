import { mkdir, writeFile, unlink, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { resolve, sep } from 'path';
import { AppError } from '../../lib/errors.js';
import type { PartnerDocumentObject, PartnerDocumentStorage } from './storage-provider.interface.js';

const BASE_DIR = resolve(process.cwd(), 'uploads', 'partner-documents');

function assertSafeKey(storageKey: string): string {
  const normalized = storageKey.replace(/\\/g, '/');
  if (normalized.includes('..') || normalized.startsWith('/') || normalized.includes('\0')) {
    throw new AppError(400, 'INVALID_STORAGE_KEY', 'Invalid document key');
  }
  const absolute = resolve(BASE_DIR, ...normalized.split('/'));
  if (!absolute.startsWith(BASE_DIR + sep) && absolute !== BASE_DIR) {
    throw new AppError(400, 'INVALID_STORAGE_KEY', 'Invalid document key');
  }
  return absolute;
}

export class LocalPrivateDocumentStorage implements PartnerDocumentStorage {
  readonly providerName = 'local_private' as const;

  async put(object: PartnerDocumentObject): Promise<void> {
    await mkdir(BASE_DIR, { recursive: true });
    const absolute = assertSafeKey(object.storageKey);
    await mkdir(resolve(absolute, '..'), { recursive: true });
    await writeFile(absolute, object.body);
  }

  async get(storageKey: string): Promise<Buffer> {
    const absolute = assertSafeKey(storageKey);
    if (!existsSync(absolute)) {
      throw new AppError(404, 'NOT_FOUND', 'Document file not found');
    }
    return readFile(absolute);
  }

  async delete(storageKey: string): Promise<void> {
    const absolute = assertSafeKey(storageKey);
    if (!existsSync(absolute)) return;
    await unlink(absolute);
  }
}
