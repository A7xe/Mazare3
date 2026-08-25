import type { Express } from 'express';

export type UploadImageResult = {
  url: string;
  thumbnailUrl?: string | null;
  storageKey: string;
};

export type MediaUploadContext = {
  propertyId: string;
  uploadedByUserId: string;
};

export interface StorageProvider {
  uploadImage(file: Express.Multer.File, ctx: MediaUploadContext): Promise<UploadImageResult>;
  deleteImage(storageKey: string): Promise<void>;
}

