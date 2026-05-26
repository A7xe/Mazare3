import { z } from 'zod';
import {
  DISPUTE_STATUSES,
  DISPUTE_TYPES,
  REFUND_REQUEST_STATUSES,
} from '../constants';

export const createRefundRequestSchema = z.object({
  reason: z.string().min(10).max(2000),
  requestedAmount: z.coerce.number().nonnegative().optional(),
});

export const createDisputeSchema = z.object({
  type: z.enum(DISPUTE_TYPES),
  description: z.string().min(10).max(3000),
});

export const patchAdminRefundRequestSchema = z.object({
  status: z.enum(REFUND_REQUEST_STATUSES),
  approvedAmount: z.coerce.number().nonnegative().optional(),
  adminNote: z.string().max(2000).optional(),
});

export const patchAdminDisputeSchema = z.object({
  status: z.enum(DISPUTE_STATUSES),
  adminNote: z.string().max(2000).optional(),
});

export const markAdminPayoutPaidSchema = z.object({
  manualReference: z.string().min(1).max(200),
  adminNote: z.string().max(2000).optional(),
});

export type CreateRefundRequestInput = z.infer<typeof createRefundRequestSchema>;
export type CreateDisputeInput = z.infer<typeof createDisputeSchema>;
export type PatchAdminRefundRequestInput = z.infer<typeof patchAdminRefundRequestSchema>;
export type PatchAdminDisputeInput = z.infer<typeof patchAdminDisputeSchema>;
export type MarkAdminPayoutPaidInput = z.infer<typeof markAdminPayoutPaidSchema>;
