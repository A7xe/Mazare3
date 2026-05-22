import { Router } from 'express';
import { asyncHandler } from '../middleware/error-handler.js';
import {
  getPublishedPropertyBySlug,
  listPublishedProperties,
  listSimilarProperties,
} from '../services/property.service.js';

export const propertiesRouter = Router();

propertiesRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const data = await listPublishedProperties();
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
