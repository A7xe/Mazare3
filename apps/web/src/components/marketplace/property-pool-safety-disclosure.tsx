'use client';

import { useTranslations, useLocale } from 'next-intl';
import type { PublicPropertyDetail } from '@mazare3/shared';

/** Customer-facing Owner-provided pool/safety facts — never regulatory badges. */
export function PropertyPoolSafetyDisclosure({
  property,
}: {
  property: PublicPropertyDetail;
}) {
  const t = useTranslations('property.poolSafety');
  const locale = useLocale();
  const d = property.poolSafetyDisclosure;
  if (!d?.poolAvailable && !(d?.safetyDisclosures?.length)) return null;

  const access =
    locale === 'ar' ? d?.accessRestrictionsAr : d?.accessRestrictionsEn || d?.accessRestrictionsAr;
  const warnings =
    locale === 'ar' ? d?.otherWarningsAr : d?.otherWarningsEn || d?.otherWarningsAr;

  return (
    <section
      className="mt-6 space-y-2 border-t border-[#E5EAF1] pt-5"
      data-testid="public-pool-safety-disclosure"
    >
      <h2 className="text-lg font-semibold text-[#0D2046]">{t('title')}</h2>
      <p className="text-xs text-[#8A8490]">{t('ownerProvided')}</p>

      {d?.poolAvailable ? (
        <ul className="space-y-1 text-sm text-[#0D2046]">
          <li>
            {t('poolAvailable')}
            {d.poolsCount > 0 ? ` · ${t('count', { count: d.poolsCount })}` : ''}
          </li>
          {d.minDepthMeters != null || d.maxDepthMeters != null ? (
            <li>
              {t('depthOwnerProvided')}:{' '}
              {d.minDepthMeters != null && d.maxDepthMeters != null
                ? `${d.minDepthMeters}–${d.maxDepthMeters} ${t('meters')}`
                : d.maxDepthMeters != null
                  ? `${d.maxDepthMeters} ${t('meters')}`
                  : `${d.minDepthMeters} ${t('meters')}`}
            </li>
          ) : null}
          {d.childrenRequireAdultSupervision ? (
            <li>{t('adultSupervision')}</li>
          ) : null}
          {d.childrenAllowed === false ? <li>{t('childrenNotAllowed')}</li> : null}
          {access ? <li>{access}</li> : null}
          {warnings ? <li>{warnings}</li> : null}
        </ul>
      ) : null}

      {(d?.safetyDisclosures ?? []).map((s, i) => (
        <p key={i} className="text-sm text-[#0D2046]">
          {locale === 'ar' ? s.descriptionAr : s.descriptionEn || s.descriptionAr}
        </p>
      ))}

      <p className="text-xs text-[#8A8490]">{t('noCertification')}</p>
    </section>
  );
}
