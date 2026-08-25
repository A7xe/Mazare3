import multer from 'multer';
import { loadPartnerDocumentMaxBytes } from '../lib/partner-file-magic.js';

export const partnerDocumentUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: loadPartnerDocumentMaxBytes() },
});
