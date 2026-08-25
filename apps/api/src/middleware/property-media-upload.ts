import multer from 'multer';
import { loadMediaConfig } from '../config/media-config.js';

const cfg = loadMediaConfig();

export const propertyMediaUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: cfg.maxUploadBytes },
});

