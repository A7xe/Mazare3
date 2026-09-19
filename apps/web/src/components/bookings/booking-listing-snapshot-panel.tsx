'use client';

/**
 * Phase 3C.4D.6 — Booking-time listing evidence panel.
 * Shows immutable snapshot facts; never treats live Property as historical source.
 */
import { useLocale, useTranslations } from 'next-intl';

export type ListingSnapshotApiResult = {
  status: 'available' | 'LEGACY_SNAPSHOT_UNAVAILABLE';
  snapshot: {
    id: string;
    schemaVersion: string;
    capturedAt: string;
    property: {
      titleAr: string;
      titleEn: string | null;
      slug: string;
      type: string;
      descriptionAr: string;
      descriptionEn: string | null;
    };
    capacity: {
      capacity: number;
      bedrooms: number;
      bathrooms: number;
      allowsOvernight: boolean;
      allowsFamilies: boolean;
      allowsYouth: boolean;
      allowsEvents: boolean;
    };
    amenities: Array<{ key: string; labelAr: string; labelEn: string }>;
    rules: Array<{ titleAr: string; titleEn: string | null }>;
    activities: Array<{ activityCode: string; otherDescription: string | null }>;
    pool: {
      poolsCount: number;
      hasIndoorPool: boolean;
      hasHeatedPool: boolean;
      attestationVersion: string | null;
      attestedAt: string | null;
      profile: Record<string, unknown> | null;
    };
    safetyDisclosures: Array<{
      category: string;
      descriptionAr: string;
      descriptionEn: string | null;
    }>;
    media: Array<{ mediaId: string; sortOrder: number; isPrimary: boolean; url: string }>;
    platformVerification: { status: string };
    policyVersionRefs?: {
      bookingTermsVersionId: string | null;
      cancellationPolicyVersionId: string | null;
      termsVersionId: string | null;
    };
    gates?: {
      regulatoryReadiness?: string | null;
      authorityReviewStatus?: string | null;
      evaluatedAt?: string | null;
    };
    label: string;
  } | null;
};

type Props = {
  data: ListingSnapshotApiResult | 'loading' | 'error' | undefined;
  /** Admin comparison: optional current listing summary */
  currentListing?: {
    property?: { titleAr: string; titleEn: string | null };
    amenities?: Array<{ key: string }>;
    capacity?: { capacity: number };
  } | null;
  testId?: string;
};

export function BookingListingSnapshotPanel({ data, currentListing, testId }: Props) {
  const t = useTranslations('bookingListingSnapshot');
  const locale = useLocale() as 'ar' | 'en';

  if (data === undefined || data === 'loading') {
    return (
      <div
        className="rounded-xl border border-[#E4EAF3] bg-[#F8FAFD] p-3 text-xs"
        data-testid={testId}
      >
        <p className="font-medium text-navy">{t('title')}</p>
        <p className="mt-1 text-muted">{t('loading')}</p>
      </div>
    );
  }

  if (data === 'error') {
    return (
      <div
        className="rounded-xl border border-[#E4EAF3] bg-[#F8FAFD] p-3 text-xs"
        data-testid={testId}
      >
        <p className="font-medium text-navy">{t('title')}</p>
        <p className="mt-1 text-muted">{t('unavailable')}</p>
      </div>
    );
  }

  if (data.status === 'LEGACY_SNAPSHOT_UNAVAILABLE' || !data.snapshot) {
    return (
      <div
        className="rounded-xl border border-[#E4EAF3] bg-[#F8FAFD] p-3 text-xs"
        data-testid={testId}
      >
        <p className="font-medium text-navy">{t('title')}</p>
        <p className="mt-1 text-muted">{t('legacy')}</p>
      </div>
    );
  }

  const s = data.snapshot;
  const title = locale === 'ar' ? s.property.titleAr : s.property.titleEn ?? s.property.titleAr;
  const amenityLabels = s.amenities
    .map((a) => (locale === 'ar' ? a.labelAr : a.labelEn))
    .join(locale === 'ar' ? '، ' : ', ');

  return (
    <div
      className="rounded-xl border border-[#E4EAF3] bg-[#F8FAFD] p-3 text-xs"
      data-testid={testId}
    >
      <p className="font-medium text-navy">{t('title')}</p>
      <p className="mt-0.5 text-muted">{t('atTimeOfBooking')}</p>
      <ul className="mt-2 space-y-1 text-[#53637A]">
        <li>
          <span className="font-medium text-navy">{t('property')}</span> {title} ({s.property.slug})
        </li>
        <li>
          <span className="font-medium text-navy">{t('capacity')}</span> {s.capacity.capacity} ·{' '}
          {s.capacity.bedrooms}/{s.capacity.bathrooms}
        </li>
        {amenityLabels ? (
          <li>
            <span className="font-medium text-navy">{t('amenities')}</span> {amenityLabels}
          </li>
        ) : null}
        {s.activities.length > 0 ? (
          <li>
            <span className="font-medium text-navy">{t('activities')}</span>{' '}
            {s.activities.map((a) => a.activityCode).join(', ')}
          </li>
        ) : null}
        {s.rules.length > 0 ? (
          <li>
            <span className="font-medium text-navy">{t('rules')}</span>{' '}
            {s.rules
              .map((r) => (locale === 'ar' ? r.titleAr : r.titleEn ?? r.titleAr))
              .join(locale === 'ar' ? '، ' : ', ')}
          </li>
        ) : null}
        {s.pool.poolsCount > 0 || s.pool.profile ? (
          <li>
            <span className="font-medium text-navy">{t('pool')}</span> {s.pool.poolsCount}
            {s.pool.attestationVersion
              ? ` · ${t('attestation')} ${s.pool.attestationVersion}`
              : ''}
          </li>
        ) : null}
        {s.safetyDisclosures.length > 0 ? (
          <li>
            <span className="font-medium text-navy">{t('safety')}</span>{' '}
            {s.safetyDisclosures.map((d) => d.category).join(', ')}
          </li>
        ) : null}
        <li>
          <span className="font-medium text-navy">{t('media')}</span> {s.media.length}
        </li>
        <li>
          <span className="font-medium text-navy">{t('platformVerification')}</span>{' '}
          {s.platformVerification.status}
        </li>
        {s.gates?.regulatoryReadiness ? (
          <li>
            <span className="font-medium text-navy">{t('regulatory')}</span>{' '}
            {s.gates.regulatoryReadiness}
            {s.gates.authorityReviewStatus ? ` · ${s.gates.authorityReviewStatus}` : ''}
          </li>
        ) : null}
        <li className="text-muted">
          {t('schema')}: {s.schemaVersion} · {new Date(s.capturedAt).toLocaleString(
            locale === 'ar' ? 'ar-JO' : 'en-GB',
          )}
        </li>
      </ul>

      {currentListing ? (
        <div className="mt-3 border-t border-[#E4EAF3] pt-2">
          <p className="font-medium text-navy">{t('currentListing')}</p>
          <p className="mt-1 text-[#53637A]">
            {locale === 'ar'
              ? currentListing.property?.titleAr
              : currentListing.property?.titleEn ?? currentListing.property?.titleAr}{' '}
            · {t('capacity')} {currentListing.capacity?.capacity ?? '—'} · {t('amenities')}{' '}
            {currentListing.amenities?.length ?? 0}
          </p>
        </div>
      ) : null}
    </div>
  );
}
