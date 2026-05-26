import { Router } from 'express';
import {
  adminAvailabilityQuerySchema,
  patchAdminAvailabilitySchema,
  patchAdminOwnerStatusSchema,
  patchAdminPropertyStatusSchema,
  patchAdminUserStatusSchema,
} from '@mazare3/shared';
import { asyncHandler } from '../middleware/error-handler.js';
import { requireAdmin, type AuthenticatedRequest } from '../middleware/auth.js';
import { AppError, formatZodErrors } from '../lib/errors.js';
import {
  getAdminSummary,
  getAdminPropertyById,
  getAdminUserById,
  listAdminAuditLogs,
  listAdminAvailability,
  listAdminBookings,
  listAdminOwners,
  patchAdminOwnerStatus,
  listAdminProperties,
  listAdminUsers,
  patchAdminAvailabilitySlot,
  patchAdminPropertyStatus,
  patchAdminUserStatus,
} from '../services/admin.service.js';
import { listAdminPayments } from '../services/payment.service.js';
import {
  listAdminRefundRequests,
  patchAdminRefundRequest,
} from '../services/refund-request.service.js';
import { listAdminDisputes, patchAdminDispute } from '../services/dispute.service.js';
import {
  listAdminPayouts,
  markAdminPayoutPaid,
} from '../services/payout-operations.service.js';
import {
  patchAdminRefundRequestSchema,
  patchAdminDisputeSchema,
  markAdminPayoutPaidSchema,
} from '@mazare3/shared';

export const adminRouter = Router();

adminRouter.use(...requireAdmin);

adminRouter.get(
  '/summary',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const data = await getAdminSummary(req.session!.userId, req);
    res.json({ data });
  }),
);

adminRouter.get(
  '/users',
  asyncHandler(async (_req: AuthenticatedRequest, res) => {
    const data = await listAdminUsers();
    res.json({ data });
  }),
);

adminRouter.get(
  '/users/:id',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = req.params.id;
    if (!id) {
      res.status(400).json({ error: 'User id is required', code: 'VALIDATION_ERROR' });
      return;
    }
    const data = await getAdminUserById(id);
    if (!data) {
      res.status(404).json({ error: 'User not found', code: 'NOT_FOUND' });
      return;
    }
    res.json({ data });
  }),
);

adminRouter.patch(
  '/users/:id/status',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = req.params.id;
    if (!id) {
      res.status(400).json({ error: 'User id is required', code: 'VALIDATION_ERROR' });
      return;
    }
    const parsed = patchAdminUserStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid body', formatZodErrors(parsed.error));
    }
    const data = await patchAdminUserStatus(
      req.session!.userId,
      id,
      parsed.data,
      req,
    );
    res.json({ data });
  }),
);

adminRouter.get(
  '/owners',
  asyncHandler(async (_req: AuthenticatedRequest, res) => {
    const data = await listAdminOwners();
    res.json({ data });
  }),
);

adminRouter.patch(
  '/owners/:id/status',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = req.params.id;
    if (!id) {
      res.status(400).json({ error: 'Owner id is required', code: 'VALIDATION_ERROR' });
      return;
    }
    const parsed = patchAdminOwnerStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid body', formatZodErrors(parsed.error));
    }
    const data = await patchAdminOwnerStatus(
      req.session!.userId,
      id,
      parsed.data,
      req,
    );
    res.json({ data });
  }),
);

adminRouter.get(
  '/properties',
  asyncHandler(async (_req: AuthenticatedRequest, res) => {
    const data = await listAdminProperties();
    res.json({ data });
  }),
);

adminRouter.get(
  '/properties/:id',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = req.params.id;
    if (!id) {
      res.status(400).json({ error: 'Property id is required', code: 'VALIDATION_ERROR' });
      return;
    }
    const data = await getAdminPropertyById(id);
    if (!data) {
      res.status(404).json({ error: 'Property not found', code: 'NOT_FOUND' });
      return;
    }
    res.json({ data });
  }),
);

adminRouter.patch(
  '/properties/:id/status',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = req.params.id;
    if (!id) {
      res.status(400).json({ error: 'Property id is required', code: 'VALIDATION_ERROR' });
      return;
    }
    const parsed = patchAdminPropertyStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid body', formatZodErrors(parsed.error));
    }
    const data = await patchAdminPropertyStatus(
      req.session!.userId,
      id,
      parsed.data,
      req,
    );
    res.json({ data });
  }),
);

adminRouter.get(
  '/bookings',
  asyncHandler(async (_req: AuthenticatedRequest, res) => {
    const data = await listAdminBookings();
    res.json({ data });
  }),
);

adminRouter.get(
  '/availability',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = adminAvailabilityQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid query', formatZodErrors(parsed.error));
    }
    const data = await listAdminAvailability(parsed.data);
    res.json({ data });
  }),
);

adminRouter.patch(
  '/availability/:slotId',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const slotId = req.params.slotId;
    if (!slotId) {
      res.status(400).json({ error: 'Slot id is required', code: 'VALIDATION_ERROR' });
      return;
    }
    const parsed = patchAdminAvailabilitySchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid body', formatZodErrors(parsed.error));
    }
    const data = await patchAdminAvailabilitySlot(
      req.session!.userId,
      slotId,
      parsed.data,
      req,
    );
    res.json({ data });
  }),
);

adminRouter.get(
  '/payments',
  asyncHandler(async (_req: AuthenticatedRequest, res) => {
    const data = await listAdminPayments();
    res.json({ data });
  }),
);

adminRouter.get(
  '/refund-requests',
  asyncHandler(async (_req: AuthenticatedRequest, res) => {
    const data = await listAdminRefundRequests();
    res.json({ data });
  }),
);

adminRouter.patch(
  '/refund-requests/:id/status',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = req.params.id;
    if (!id) {
      res.status(400).json({ error: 'Refund request id is required', code: 'VALIDATION_ERROR' });
      return;
    }
    const parsed = patchAdminRefundRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid body', formatZodErrors(parsed.error));
    }
    const data = await patchAdminRefundRequest(
      req.session!.userId,
      id,
      parsed.data,
      req,
    );
    res.json({ data });
  }),
);

adminRouter.get(
  '/disputes',
  asyncHandler(async (_req: AuthenticatedRequest, res) => {
    const data = await listAdminDisputes();
    res.json({ data });
  }),
);

adminRouter.patch(
  '/disputes/:id/status',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = req.params.id;
    if (!id) {
      res.status(400).json({ error: 'Dispute id is required', code: 'VALIDATION_ERROR' });
      return;
    }
    const parsed = patchAdminDisputeSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid body', formatZodErrors(parsed.error));
    }
    const data = await patchAdminDispute(req.session!.userId, id, parsed.data, req);
    res.json({ data });
  }),
);

adminRouter.get(
  '/payouts',
  asyncHandler(async (_req: AuthenticatedRequest, res) => {
    const data = await listAdminPayouts();
    res.json({ data });
  }),
);

adminRouter.post(
  '/payouts/:paymentId/mark-paid',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const paymentId = req.params.paymentId;
    if (!paymentId) {
      res.status(400).json({ error: 'Payment id is required', code: 'VALIDATION_ERROR' });
      return;
    }
    const parsed = markAdminPayoutPaidSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid body', formatZodErrors(parsed.error));
    }
    const data = await markAdminPayoutPaid(
      req.session!.userId,
      paymentId,
      parsed.data,
      req,
    );
    res.json({ data });
  }),
);

adminRouter.get(
  '/audit-logs',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const limit = Math.min(Number(req.query.limit) || 100, 200);
    const data = await listAdminAuditLogs(limit);
    res.json({ data });
  }),
);
