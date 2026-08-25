import { z } from 'zod';

const placementFields = z.object({
  placementType: z.enum(['featured', 'sponsored']),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  adminNote: z.string().trim().max(500).nullable().optional(),
});

export const createPropertyPlacementSchema = placementFields.superRefine((val, ctx) => {
  if (!(val.endsAt.getTime() > val.startsAt.getTime())) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['endsAt'],
      message: 'End must be after start',
    });
  }
});

export type CreatePropertyPlacementInput = z.infer<typeof createPropertyPlacementSchema>;
