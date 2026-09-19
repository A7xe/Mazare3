import { z } from 'zod';
import {
  DISPUTE_STATUSES,
  DISPUTE_TYPES,
  REFUND_REQUEST_STATUSES,
  SUPPORT_TICKET_CATEGORIES,
  SUPPORT_TICKET_SOURCES,
  SUPPORT_TICKET_STATUSES,
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

export const createBookingSupportTicketSchema = z.object({
  category: z.enum(SUPPORT_TICKET_CATEGORIES),
  subject: z.string().trim().min(4).max(200),
  message: z.string().trim().min(10).max(3000),
});

export const createGeneralSupportTicketSchema = z.object({
  category: z.enum(SUPPORT_TICKET_CATEGORIES).optional().default('other'),
  subject: z.string().trim().min(4).max(200),
  message: z.string().trim().min(10).max(3000),
  name: z.string().trim().min(2).max(100).optional(),
  email: z.string().trim().email().max(200).optional(),
});

export const patchAdminSupportTicketSchema = z
  .object({
    status: z.enum(SUPPORT_TICKET_STATUSES).optional(),
    adminResponse: z.string().trim().min(1).max(4000).optional(),
  })
  .refine((value) => value.status !== undefined || value.adminResponse !== undefined, {
    message: 'Provide a status and/or a customer-visible response',
  });

export const adminSupportTicketListQuerySchema = z.object({
  status: z.enum(SUPPORT_TICKET_STATUSES).optional(),
  source: z.enum(SUPPORT_TICKET_SOURCES).optional(),
});

export const markAdminPayoutPaidSchema = z.object({
  manualReference: z.string().min(1).max(200),
  adminNote: z.string().max(2000).optional(),
});

export const createOwnerSettlementSchema = z.object({
  through: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  adminNote: z.string().max(2000).optional(),
});

export const markOwnerSettlementPaidSchema = z.object({
  paymentReference: z.string().min(1).max(200),
  paidAt: z.string().datetime().optional(),
  adminNote: z.string().max(2000).optional(),
});

export type CreateRefundRequestInput = z.infer<typeof createRefundRequestSchema>;
export type CreateDisputeInput = z.infer<typeof createDisputeSchema>;
export type PatchAdminRefundRequestInput = z.infer<typeof patchAdminRefundRequestSchema>;
export type PatchAdminDisputeInput = z.infer<typeof patchAdminDisputeSchema>;
export type CreateBookingSupportTicketInput = z.infer<typeof createBookingSupportTicketSchema>;
export type CreateGeneralSupportTicketInput = z.infer<typeof createGeneralSupportTicketSchema>;
export type PatchAdminSupportTicketInput = z.infer<typeof patchAdminSupportTicketSchema>;
export type AdminSupportTicketListQuery = z.infer<typeof adminSupportTicketListQuerySchema>;
export type MarkAdminPayoutPaidInput = z.infer<typeof markAdminPayoutPaidSchema>;
export type CreateOwnerSettlementInput = z.infer<typeof createOwnerSettlementSchema>;
export type MarkOwnerSettlementPaidInput = z.infer<typeof markOwnerSettlementPaidSchema>;

export const ownerCancelBookingSchema = z.object({
  reasonCode: z.enum([
    'PROPERTY_UNAVAILABLE',
    'OWNER_EMERGENCY',
    'MAINTENANCE_FAILURE',
    'DOUBLE_BOOKING_OWNER_FAULT',
    'PROPERTY_DAMAGE',
    'ACCESS_PROBLEM',
    'FORCE_MAJEURE',
    'OTHER',
  ]),
  note: z.string().max(2000).optional(),
});

export const reportCustomerNoShowSchema = z.object({
  evidence: z.string().max(3000).optional(),
});

export const verifyCheckInSchema = z.object({
  pin: z.string().regex(/^\d{6}$/),
});

export const requestRescheduleSchema = z.object({
  toSlotId: z.string().min(1),
});

export const respondRescheduleSchema = z.object({
  accept: z.boolean(),
});

export const reportArrivalProblemSchema = z.object({
  type: z.enum(['owner_no_show_report', 'access_denied_report', 'property_unavailable_report']),
  description: z.string().min(10).max(3000),
});

export const adminIncidentActionSchema = z.object({
  adminNote: z.string().max(2000).optional(),
});

export const adminForceMajeureSchema = z.object({
  bookingId: z.string().min(1),
  incidentId: z.string().optional(),
  outcome: z.enum(['confirm_awaiting_customer', 'full_refund', 'approve_reschedule']),
  reason: z.string().min(10).max(2000),
  evidenceText: z.string().max(3000).optional(),
  /** Phase 3A — optional target slot for approve_reschedule. */
  toSlotId: z.string().min(1).optional(),
  /** Customer elects a more expensive FM upgrade (pays market delta). */
  voluntaryUpgrade: z.boolean().optional(),
});

export const customerForceMajeureChoiceSchema = z.object({
  choice: z.enum(['FULL_REFUND', 'EQUIVALENT_RESCHEDULE']),
  toSlotId: z.string().min(1).optional(),
  voluntaryUpgrade: z.boolean().optional(),
  source: z.string().max(120).optional(),
});

export const adminWaivePenaltySchema = z.object({
  reason: z.string().min(10).max(2000),
});

export type OwnerCancelBookingInput = z.infer<typeof ownerCancelBookingSchema>;
export type RequestRescheduleInput = z.infer<typeof requestRescheduleSchema>;
export type ReportArrivalProblemInput = z.infer<typeof reportArrivalProblemSchema>;
export type CustomerForceMajeureChoiceInput = z.infer<typeof customerForceMajeureChoiceSchema>;
