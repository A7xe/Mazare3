import { Router } from 'express';
import {
  createOwnerPropertySchema,
  ownerApplySchema,
  ownerAvailabilityQuerySchema,
  patchOwnerAvailabilitySchema,
  updateOwnerPropertySchema,
} from '@mazare3/shared';
import { asyncHandler } from '../middleware/error-handler.js';
import {
  attachUser,
  requireAuth,
  requireApprovedOwnerChain,
  requireCustomerOnly,
  type AuthenticatedRequest,
} from '../middleware/auth.js';
import { AppError, formatZodErrors } from '../lib/errors.js';
import {
  getOwnerSummary,
  getOwnerPropertyById,
  listOwnerAvailability,
  listOwnerBookings,
  listOwnerProperties,
  patchOwnerAvailabilitySlot,
} from '../services/owner.service.js';
import { listOwnerPayouts } from '../services/payout-operations.service.js';
import {
  getMyOwnerApplication,
  submitOwnerApplication,
} from '../services/owner-application.service.js';
import {
  createOwnerProperty,
  getOwnerPropertyForEdit,
  submitOwnerPropertyForReview,
  updateOwnerProperty,
} from '../services/owner-property.service.js';

export const ownerRouter = Router();

ownerRouter.post(
  '/apply',
  ...requireCustomerOnly,
  attachUser,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = ownerApplySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid body', formatZodErrors(parsed.error));
    }
    const data = await submitOwnerApplication(
      req.session!.userId,
      req.session!.role,
      parsed.data,
      req,
    );
    res.status(201).json({ data });
  }),
);

ownerRouter.get(
  '/application/me',
  requireAuth,
  attachUser,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const data = await getMyOwnerApplication(req.session!.userId);
    res.json({ data });
  }),
);

ownerRouter.use(...requireApprovedOwnerChain);

ownerRouter.get(
  '/summary',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const data = await getOwnerSummary(req.session!.userId, req.session!.role, req);
    res.json({ data });
  }),
);

ownerRouter.get(
  '/properties',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const data = await listOwnerProperties(req.session!.userId, req.session!.role);
    res.json({ data });
  }),
);

ownerRouter.post(
  '/properties',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = createOwnerPropertySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid body', formatZodErrors(parsed.error));
    }
    const data = await createOwnerProperty(
      req.session!.userId,
      req.session!.role,
      parsed.data,
      req,
    );
    res.status(201).json({ data });
  }),
);

ownerRouter.get(
  '/properties/:id',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = req.params.id;
    if (!id) {
      res.status(400).json({ error: 'Property id is required', code: 'VALIDATION_ERROR' });
      return;
    }
    const data = await getOwnerPropertyById(req.session!.userId, req.session!.role, id);
    if (!data) {
      res.status(404).json({ error: 'Property not found', code: 'NOT_FOUND' });
      return;
    }
    res.json({ data });
  }),
);

ownerRouter.get(
  '/properties/:id/edit',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = req.params.id;
    if (!id) {
      res.status(400).json({ error: 'Property id is required', code: 'VALIDATION_ERROR' });
      return;
    }
    const data = await getOwnerPropertyForEdit(req.session!.userId, req.session!.role, id);
    if (!data) {
      res.status(404).json({ error: 'Property not found', code: 'NOT_FOUND' });
      return;
    }
    res.json({ data });
  }),
);

ownerRouter.patch(
  '/properties/:id',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = req.params.id;
    if (!id) {
      res.status(400).json({ error: 'Property id is required', code: 'VALIDATION_ERROR' });
      return;
    }
    const parsed = updateOwnerPropertySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid body', formatZodErrors(parsed.error));
    }
    const data = await updateOwnerProperty(
      req.session!.userId,
      req.session!.role,
      id,
      parsed.data,
      req,
    );
    res.json({ data });
  }),
);

ownerRouter.post(
  '/properties/:id/submit-review',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = req.params.id;
    if (!id) {
      res.status(400).json({ error: 'Property id is required', code: 'VALIDATION_ERROR' });
      return;
    }
    const data = await submitOwnerPropertyForReview(
      req.session!.userId,
      req.session!.role,
      id,
      req,
    );
    res.json({ data });
  }),
);

ownerRouter.get(
  '/bookings',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const data = await listOwnerBookings(req.session!.userId, req.session!.role);
    res.json({ data });
  }),
);

ownerRouter.get(
  '/payouts',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const data = await listOwnerPayouts(req.session!.userId, req.session!.role);
    res.json({ data });
  }),
);

ownerRouter.get(
  '/availability',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = ownerAvailabilityQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid query', formatZodErrors(parsed.error));
    }
    const data = await listOwnerAvailability(
      req.session!.userId,
      req.session!.role,
      parsed.data,
    );
    res.json({ data });
  }),
);

ownerRouter.patch(
  '/availability/:slotId',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const slotId = req.params.slotId;
    if (!slotId) {
      res.status(400).json({ error: 'Slot id is required', code: 'VALIDATION_ERROR' });
      return;
    }
    const parsed = patchOwnerAvailabilitySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid body', formatZodErrors(parsed.error));
    }
    const data = await patchOwnerAvailabilitySlot(
      req.session!.userId,
      req.session!.role,
      slotId,
      parsed.data,
      req,
    );
    res.json({ data });
  }),
);
