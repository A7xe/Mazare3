import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import type { Locale } from '@mazare3/shared';
import type { SiteIdentity } from '@/lib/legal/site-identity';
import { getSessionUser } from '@/lib/get-session-user';
import { resolveAddFarmHref, resolveAddFarmLabelKey } from '@/lib/add-farm-entry';

export async function ContactIdentity({
  locale,
  identity,
}: {
  locale: Locale;
  identity: SiteIdentity;
}) {
  const t = await getTranslations('legal');
  const tAddFarmCta = await getTranslations('common.addFarmCta');
  const sessionUser = await getSessionUser();
  const addFarmHref = resolveAddFarmHref(sessionUser);
  const addFarmLabel = tAddFarmCta(resolveAddFarmLabelKey({ user: sessionUser }));
  const product = locale === 'ar' ? identity.productNameAr : identity.productNameEn;
  const rows: { label: string; value: string }[] = [];
  if (identity.legalEntityName) {
    rows.push({ label: t('identityLegalName'), value: identity.legalEntityName });
  }
  if (identity.registrationNumber) {
    rows.push({ label: t('identityRegistration'), value: identity.registrationNumber });
  }
  if (identity.taxNumber) {
    rows.push({ label: t('identityTax'), value: identity.taxNumber });
  }
  if (identity.registeredAddress) {
    rows.push({ label: t('identityAddress'), value: identity.registeredAddress });
  }
  if (identity.supportEmail) {
    rows.push({ label: t('identitySupportEmail'), value: identity.supportEmail });
  }
  if (identity.privacyEmail) {
    rows.push({ label: t('identityPrivacyEmail'), value: identity.privacyEmail });
  }
  if (identity.supportPhone) {
    rows.push({ label: t('identityPhone'), value: identity.supportPhone });
  }

  return (
    <div
      className="mt-8 rounded-2xl border border-primary/15 bg-surface p-5 shadow-card"
      data-testid="contact-identity"
    >
      <p className="text-sm font-semibold text-navy">{product}</p>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm leading-relaxed text-muted" data-testid="contact-identity-unpublished">
          {t('identityUnpublished')}
        </p>
      ) : (
        <dl className="mt-3 space-y-2 text-sm">
          {rows.map((row) => (
            <div key={row.label}>
              <dt className="text-muted">{row.label}</dt>
              <dd className="font-medium text-navy">
                {row.value.includes('@') ? (
                  <a className="text-primary hover:underline" href={`mailto:${row.value}`}>
                    {row.value}
                  </a>
                ) : (
                  row.value
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}
      <p className="mt-4 text-sm">
        <Link href="/account/bookings" className="font-medium text-primary hover:underline">
          {t('goToBookings')}
        </Link>
        <span className="mx-2 text-muted">·</span>
        <Link href={addFarmHref} className="font-medium text-primary hover:underline">
          {addFarmLabel}
        </Link>
      </p>
    </div>
  );
}
