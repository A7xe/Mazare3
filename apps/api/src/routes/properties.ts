import { Router } from 'express';
import { z } from 'zod';
import {
  availabilityQuerySchema,
  bookingQuoteSchema,
  discoveryQuerySchema,
  propertySearchQuerySchema,
  validatePropertyCouponSchema,
} from '@mazare3/shared';
import { asyncHandler } from '../middleware/error-handler.js';
import { AppError, formatZodErrors } from '../lib/errors.js';
import { listPropertyAvailability } from '../services/availability.service.js';
import { getMarketplaceDiscovery } from '../services/property-discovery.service.js';
import {
  getPublishedPropertyBySlug,
  listPublishedProperties,
  listSimilarProperties,
} from '../services/property.service.js';
import { listHomePublicTestimonials } from '../services/review.service.js';
import { listPropertyTitleSuggestions } from '../services/property-suggestions.service.js';
import {
  attachUser,
  optionalAuth,
  requireAuth,
  requireRole,
  type AuthenticatedRequest,
} from '../middleware/auth.js';
import { validateCouponForPublishedSlot } from '../services/coupon.service.js';
import { validatePlatformCouponForPublishedSlot } from '../services/platform-coupon.service.js';
import { getBookingQuote } from '../services/booking-quote.service.js';

export const propertiesRouter = Router();

const propertySuggestionsQuerySchema = z.object({
  q: z.string().trim().min(1).max(120),
  limit: z.coerce.number().int().min(1).max(12).optional().default(8),
});

propertiesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const parsed = propertySearchQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid search parameters', parsed.error.flatten());
    }
    const result = await listPublishedProperties(parsed.data);
    res.json({ data: result.data, meta: result.meta });
  }),
);

propertiesRouter.get(
  '/suggestions',
  asyncHandler(async (req, res) => {
    const parsed = propertySuggestionsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid suggestion parameters', parsed.error.flatten());
    }
    const data = await listPropertyTitleSuggestions({
      q: parsed.data.q,
      limit: parsed.data.limit,
    });
    res.json({ data });
  }),
);

propertiesRouter.get(
  '/discovery',
  asyncHandler(async (req, res) => {
    const parsed = discoveryQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid discovery parameters', parsed.error.flatten());
    }
    const data = await getMarketplaceDiscovery(parsed.data);
    res.json({ data });
  }),
);

propertiesRouter.get(
  '/testimonials',
  asyncHandler(async (_req, res) => {
    const data = await listHomePublicTestimonials();
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

propertiesRouter.post(
  '/:slug/booking-quote',
  optionalAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const slug = req.params.slug;
    if (!slug) {
      res.status(400).json({ error: 'Slug is required', code: 'VALIDATION_ERROR' });
      return;
    }
    const parsed = bookingQuoteSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid quote payload', formatZodErrors(parsed.error));
    }
    if (parsed.data.couponCode && !req.session?.userId) {
      throw new AppError(401, 'UNAUTHORIZED', 'Sign in to apply a coupon');
    }
    const data = await getBookingQuote(
      {
        propertySlug: slug,
        date: parsed.data.date,
        period: parsed.data.period,
        guestsCount: parsed.data.guestsCount,
        couponCode: parsed.data.couponCode,
      },
      req.session?.userId ?? null,
    );
    res.json({ data });
  }),
);

propertiesRouter.post(
  '/:slug/coupons/validate',
  requireAuth,
  attachUser,
  requireRole('customer'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const slug = req.params.slug;
    if (!slug) {
      res.status(400).json({ error: 'Slug is required', code: 'VALIDATION_ERROR' });
      return;
    }
    const parsed = validatePropertyCouponSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid coupon payload', formatZodErrors(parsed.error));
    }
    const data = await validateCouponForPublishedSlot({
      slug,
      userId: req.session!.userId,
      code: parsed.data.code,
      date: parsed.data.date,
      period: parsed.data.period,
    });
    res.json({ data });
  }),
);

propertiesRouter.post(
  '/:slug/platform-coupons/validate',
  requireAuth,
  attachUser,
  requireRole('customer'),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const slug = req.params.slug;
    if (!slug) {
      res.status(400).json({ error: 'Slug is required', code: 'VALIDATION_ERROR' });
      return;
    }
    const parsed = validatePropertyCouponSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid coupon payload', formatZodErrors(parsed.error));
    }
    const data = await validatePlatformCouponForPublishedSlot({
      slug,
      userId: req.session!.userId,
      code: parsed.data.code,
      date: parsed.data.date,
      period: parsed.data.period,
    });
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
