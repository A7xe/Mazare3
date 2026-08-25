import { prisma } from '@mazare3/db';
import {
  assessPropertyMedia,
  MIN_MEDIA_FOR_PUBLISH,
  MIN_MEDIA_FOR_SUBMIT_REVIEW,
  publishMediaRequirementMessage,
} from '@mazare3/shared';
import { AppError } from './errors.js';

export async function loadPropertyMediaSortOrders(propertyId: string) {
  return prisma.propertyMedia.findMany({
    where: { propertyId },
    orderBy: { sortOrder: 'asc' },
    select: { sortOrder: true },
  });
}

export function assertMediaForSubmitReview(media: { sortOrder: number }[]): void {
  if (media.length < MIN_MEDIA_FOR_SUBMIT_REVIEW) {
    throw new AppError(
      400,
      'PROPERTY_MEDIA_REQUIRED',
      'Add at least one property photo before submitting for review',
    );
  }
}

export async function assertMediaForPublish(propertyId: string): Promise<void> {
  const media = await loadPropertyMediaSortOrders(propertyId);
  const assessment = assessPropertyMedia(media);

  if (!assessment.canPublish) {
    throw new AppError(
      400,
      'PROPERTY_MIN_MEDIA_REQUIRED',
      publishMediaRequirementMessage(assessment, 'en'),
    );
  }
}

export { MIN_MEDIA_FOR_PUBLISH, MIN_MEDIA_FOR_SUBMIT_REVIEW };
