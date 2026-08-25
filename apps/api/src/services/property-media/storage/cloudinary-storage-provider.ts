import { v2 as cloudinary } from 'cloudinary';
import type { Express } from 'express';
import { assertCloudinaryConfigured } from '../../../config/media-config.js';
import type {
  MediaUploadContext,
  StorageProvider,
  UploadImageResult,
} from './storage-provider.interface.js';

function ensureCloudinaryConfigured() {
  const cfg = assertCloudinaryConfigured();
  cloudinary.config({
    cloud_name: cfg.cloudName,
    api_key: cfg.apiKey,
    api_secret: cfg.apiSecret,
    secure: true,
  });
}

function uploadBuffer(
  buffer: Buffer,
  options: { folder: string; publicId?: string },
): Promise<{ secure_url: string; public_id: string }> {
  return new Promise((resolve, reject) => {
    const upload = cloudinary.uploader.upload_stream(
      {
        folder: options.folder,
        public_id: options.publicId,
        resource_type: 'image',
        overwrite: false,
      },
      (error, result) => {
        if (error || !result) {
          reject(error ?? new Error('Cloudinary upload failed'));
          return;
        }
        resolve({
          secure_url: result.secure_url,
          public_id: result.public_id,
        });
      },
    );
    upload.end(buffer);
  });
}

export class CloudinaryStorageProvider implements StorageProvider {
  async uploadImage(
    file: Express.Multer.File,
    ctx: MediaUploadContext,
  ): Promise<UploadImageResult> {
    ensureCloudinaryConfigured();

    if (file.mimetype === 'image/svg+xml') {
      throw new Error('SVG uploads are not allowed');
    }

    const folder = `mazare3/properties/${ctx.propertyId}`;
    const result = await uploadBuffer(file.buffer, { folder });

    return {
      url: result.secure_url,
      storageKey: result.public_id,
      thumbnailUrl: null,
    };
  }

  async deleteImage(storageKey: string): Promise<void> {
    ensureCloudinaryConfigured();
    try {
      await cloudinary.uploader.destroy(storageKey, { resource_type: 'image' });
    } catch (err) {
      // Best-effort: missing assets or API hiccups should not block DB cleanup.
      console.error('[cloudinary] delete failed', {
        publicId: storageKey,
        message: err instanceof Error ? err.message : 'unknown',
      });
    }
  }
}
