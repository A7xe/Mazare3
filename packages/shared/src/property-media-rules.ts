/** Minimum photos required before admin can publish a property. */
export const MIN_MEDIA_FOR_PUBLISH = 3;

/** Minimum photos required before owner can submit for review. */
export const MIN_MEDIA_FOR_SUBMIT_REVIEW = 1;

export type PropertyMediaSortable = {
  sortOrder: number;
};

export type PropertyMediaAssessment = {
  count: number;
  hasCover: boolean;
  canSubmitReview: boolean;
  canPublish: boolean;
  belowPublishMinimum: boolean;
};

export function hasCoverImage(media: PropertyMediaSortable[]): boolean {
  return media.some((m) => m.sortOrder === 0);
}

export function assessPropertyMedia(media: PropertyMediaSortable[]): PropertyMediaAssessment {
  const count = media.length;
  const hasCover = hasCoverImage(media);
  const canSubmitReview = count >= MIN_MEDIA_FOR_SUBMIT_REVIEW;
  const canPublish = count >= MIN_MEDIA_FOR_PUBLISH && hasCover;
  const belowPublishMinimum = count > 0 && count < MIN_MEDIA_FOR_PUBLISH;

  return {
    count,
    hasCover,
    canSubmitReview,
    canPublish,
    belowPublishMinimum,
  };
}

export function publishMediaRequirementMessage(
  assessment: PropertyMediaAssessment,
  locale: 'ar' | 'en' = 'en',
): string {
  if (assessment.count === 0) {
    return locale === 'ar'
      ? 'يجب إضافة صور للعقار قبل النشر.'
      : 'Add property photos before publishing.';
  }
  if (!assessment.hasCover) {
    return locale === 'ar'
      ? 'يجب تحديد صورة غلاف (الترتيب 0) قبل النشر.'
      : 'Set a cover image (sort order 0) before publishing.';
  }
  if (assessment.belowPublishMinimum) {
    return locale === 'ar'
      ? `يلزم ${MIN_MEDIA_FOR_PUBLISH} صور على الأقل للنشر (الحالي: ${assessment.count}).`
      : `At least ${MIN_MEDIA_FOR_PUBLISH} photos are required to publish (current: ${assessment.count}).`;
  }
  return locale === 'ar' ? 'صور العقار غير كافية للنشر.' : 'Property photos do not meet publish requirements.';
}
