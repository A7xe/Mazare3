import { Router } from 'express';
import { LegalDocumentType } from '@mazare3/db';
import { LEGAL_DOCUMENT_TYPES, legalLanguageSchema } from '@mazare3/shared';
import { asyncHandler } from '../middleware/error-handler.js';
import { optionalAuth, type AuthenticatedRequest } from '../middleware/auth.js';
import { AppError } from '../lib/errors.js';
import {
  getActiveVersion,
  getVersionById,
  listVersions,
} from '../services/legal/legal-document.service.js';
import { getCustomerBookingLegalSetPublic } from '../services/legal/customer-booking-legal.service.js';

export const legalRouter = Router();

const TYPE_SET = new Set<string>(LEGAL_DOCUMENT_TYPES);

function parseType(raw: string): LegalDocumentType {
  if (!TYPE_SET.has(raw)) {
    throw new AppError(400, 'INVALID_DOCUMENT_TYPE', `Unknown legal document type: ${raw}`);
  }
  return raw as LegalDocumentType;
}

/**
 * GET /legal/customer-booking-set?lang=ar|en
 * Phase 3C.4E.4A — ACTIVE Customer Booking legal corpus (never DRAFT).
 */
legalRouter.get(
  '/customer-booking-set',
  asyncHandler(async (req, res) => {
    const langParsed = legalLanguageSchema.safeParse(req.query.lang ?? 'ar');
    if (!langParsed.success) {
      throw new AppError(400, 'INVALID_LANG', 'lang must be ar or en');
    }
    const data = await getCustomerBookingLegalSetPublic(langParsed.data);
    res.json({ data });
  }),
);

/** GET /legal/documents/:type?lang=ar|en — current active */
legalRouter.get(
  '/documents/:type',
  asyncHandler(async (req, res) => {
    const documentType = parseType(String(req.params.type ?? ''));
    const langParsed = legalLanguageSchema.safeParse(req.query.lang ?? 'ar');
    if (!langParsed.success) {
      throw new AppError(400, 'INVALID_LANG', 'lang must be ar or en');
    }
    const doc = await getActiveVersion(documentType, langParsed.data);
    if (!doc) {
      throw new AppError(404, 'NOT_FOUND', 'No active legal document for that type/language');
    }
    res.json({ data: doc });
  }),
);

/**
 * GET /legal/documents/:type/versions?lang=
 * Public metadata list: active + superseded only (never draft in production responses).
 */
legalRouter.get(
  '/documents/:type/versions',
  asyncHandler(async (req, res) => {
    const documentType = parseType(String(req.params.type ?? ''));
    const langParsed = legalLanguageSchema.safeParse(req.query.lang ?? 'ar');
    if (!langParsed.success) {
      throw new AppError(400, 'INVALID_LANG', 'lang must be ar or en');
    }
    const appEnv = (process.env.APP_ENV ?? '').trim().toLowerCase();
    const nodeEnv = (process.env.NODE_ENV ?? '').trim().toLowerCase();
    const isProduction = appEnv === 'production' || nodeEnv === 'production';

    const versions = await listVersions({
      documentType,
      language: langParsed.data,
    });
    const data = versions
      .filter((v) => {
        if (v.status === 'active' || v.status === 'superseded') return true;
        // Local/dev only: allow draft launch-candidate metadata preview.
        if (!isProduction && v.status === 'draft') return true;
        return false;
      })
      .map((v) => ({
        id: v.id,
        documentType: v.documentType,
        version: v.version,
        language: v.language,
        title: v.title,
        status: v.status,
        publishedAt: v.publishedAt,
        effectiveAt: v.effectiveAt,
        supersededAt: v.supersededAt,
        // No content / contentHash on list endpoint.
      }));
    res.json({ data });
  }),
);

/**
 * GET /legal/documents/:type/versions/:versionId
 * Public for active; authenticated for superseded (optional related).
 */
legalRouter.get(
  '/documents/:type/versions/:versionId',
  optionalAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const documentType = parseType(String(req.params.type ?? ''));
    const version = await getVersionById(String(req.params.versionId ?? ''));
    if (!version || version.documentType !== documentType) {
      throw new AppError(404, 'NOT_FOUND', 'Legal document version not found');
    }
    if (version.status === 'active') {
      res.json({ data: version });
      return;
    }
    if (version.status === 'superseded') {
      if (!req.session?.userId) {
        throw new AppError(401, 'UNAUTHORIZED', 'Sign in to view superseded legal versions');
      }
      res.json({ data: version });
      return;
    }
    throw new AppError(404, 'NOT_FOUND', 'Legal document version not publicly available');
  }),
);
