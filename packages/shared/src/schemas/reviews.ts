import { z } from 'zod';

export const createReviewSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(500).optional(),
});

export const hideReviewSchema = z.object({
  reason: z.string().trim().min(3).max(500),
});

export type CreateReviewInput = z.infer<typeof createReviewSchema>;
export type HideReviewInput = z.infer<typeof hideReviewSchema>;
