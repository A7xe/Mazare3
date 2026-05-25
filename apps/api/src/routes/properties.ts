import { Router } from 'express';
import {
  availabilityQuerySchema,
  propertySearchQuerySchema,
} from '@mazare3/shared';
import { asyncHandler } from '../middleware/error-handler.js';
import { AppError } from '../lib/errors.js';
import { listPropertyAvailability } from '../services/availability.service.js';
import {
  getPublishedPropertyBySlug,
  listPublishedProperties,
  listSimilarProperties,
} from '../services/property.service.js';

export const propertiesRouter = Router();

propertiesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const parsed = propertySearchQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid search parameters', parsed.error.flatten());
    }
    const data = await listPublishedProperties(parsed.data);
    res.json({ data });
  }),
);

propertiesRouter.get(
  '/:slug/availability',
  asyncHandler(async (req, res) => {
    const slug = req.params.slug;
    if (!slug) {
      res.status(400).json({ error: 'Slug is required', code: 'VALIDATION_ERROR' });
      return;
    }
    const parsed = availabilityQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid availability query', parsed.error.flatten());
    }

    const data = await listPropertyAvailability(slug, parsed.data.from, parsed.data.to);
    if (!data) {
      res.status(404).json({ error: 'Property not found', code: 'NOT_FOUND' });
      return;
    }
    res.json({ data });
  }),
);

propertiesRouter.get(
  '/:slug',
  asyncHandler(async (req, res) => {
    const slug = req.params.slug;
    if (!slug) {
      res.status(400).json({ error: 'Slug is required', code: 'VALIDATION_ERROR' });
      return;
    }
    const property = await getPublishedPropertyBySlug(slug);
    if (!property) {
      res.status(404).json({ error: 'Property not found', code: 'NOT_FOUND' });
      return;
    }

    const similar = await listSimilarProperties(property.slug, property.city);
    res.json({ data: property, similar });
  }),
);
