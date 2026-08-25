import { z } from 'zod';

export const addPropertyMediaUrlSchema = z.object({
  url: z.string().url().max(2000),
  altAr: z.string().max(300).optional().nullable(),
  altEn: z.string().max(300).optional().nullable(),
});

export const patchPropertyMediaSchema = z.object({
  altAr: z.string().max(300).optional().nullable(),
  altEn: z.string().max(300).optional().nullable(),
});

export const reorderPropertyMediaSchema = z.object({
  mediaIds: z.array(z.string().min(1)).min(1).max(12),
});

export type AddPropertyMediaUrlInput = z.infer<typeof addPropertyMediaUrlSchema>;
export type PatchPropertyMediaInput = z.infer<typeof patchPropertyMediaSchema>;
export type ReorderPropertyMediaInput = z.infer<typeof reorderPropertyMediaSchema>;
