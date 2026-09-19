'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { FileText, Loader2 } from 'lucide-react';
import { usePathname } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { useAuthSession } from '@/components/auth/auth-session';
import {
  acceptLegalDocument,
  fetchActiveLegalDocument,
  type PublicLegalDocument,
} from '@/lib/api-legal';
import { useMyLegalStatus } from '@/components/legal/legal-reacceptance';
import { formatPlatformDateTime } from '@/lib/format-platform-time';

/** Paths that must remain usable without owner-agreement reacceptance. */
function isOwnerPayoutExemptPath(pathname: string): boolean {
  return (
    pathname === '/owner/payout' ||
    pathname.startsWith('/owner/payout/') ||
    pathname === '/owner/payouts' ||
    pathname.startsWith('/owner/payouts/')
  );
}

/**
 * Soft gate when owner_agreement reacceptance is required.
 * Shown on owner dashboard / property create flows — not on payout/history.
 */
export function OwnerAgreementGate() {
  const t = useTranslations('legal');
  const locale = useLocale();
  const pathname = usePathname();
  const { user, ready } = useAuthSession();
  const { status, loading, refresh } = useMyLegalStatus(Boolean(ready && user));
  const [viewLang, setViewLang] = useState<'ar' | 'en'>(locale === 'en' ? 'en' : 'ar');
  const [docAr, setDocAr] = useState<PublicLegalDocument | null>(null);
  const [docEn, setDocEn] = useState<PublicLegalDocument | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  const required = Boolean(status?.owner.ownerAgreementReacceptanceRequired);
  const exempt = isOwnerPayoutExemptPath(pathname);
  const show = Boolean(user && required && !exempt);
  const doc = viewLang === 'en' ? docEn : docAr;
  const acceptDoc = (locale === 'en' ? docEn : docAr) ?? docAr ?? docEn;

  const loadDocs = useCallback(async () => {
    try {
      const [ar, en] = await Promise.all([
        fetchActiveLegalDocument('owner_agreement', 'ar'),
        fetchActiveLegalDocument('owner_agreement', 'en'),
      ]);
      setDocAr(ar);
      setDocEn(en);
    } catch {
      setDocAr(null);
      setDocEn(null);
    }
  }, []);

  useEffect(() => {
    if (!show) return;
    void loadDocs();
  }, [show, loadDocs]);

  async function handleAccept() {
    if (!checked || !acceptDoc?.id) return;
    setBusy(true);
    setError(null);
    try {
      await acceptLegalDocument({
        documentVersionId: acceptDoc.id,
        context: 'owner_agreement_update',
        sourceSurface: 'owner.agreement-gate',
      });
      setChecked(false);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('ownerGate.acceptError'));
    } finally {
      setBusy(false);
    }
  }

  if (!show || loading) return null;

  const summary =
    doc?.content
      ?.replace(/^#+\s+/gm, '')
      .split(/\n+/)
      .map((l) => l.trim())
      .find((l) => l.length > 40)
      ?.slice(0, 280) ?? null;

  return (
    <div
      className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:p-5"
      data-testid="owner-agreement-gate"
      role="region"
      aria-labelledby="owner-agreement-gate-title"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-amber-700">
          <FileText className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2
            id="owner-agreement-gate-title"
            className="text-base font-heading font-bold text-amber-950"
          >
            {t('ownerGate.title')}
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-amber-900/85">{t('ownerGate.body')}</p>

          {doc || docAr || docEn ? (
            <div className="mt-3 rounded-xl border border-amber-200/80 bg-white/80 px-3.5 py-3 text-sm text-[#0D2046]">
              <p className="font-semibold">{(doc ?? acceptDoc)?.title}</p>
              <p className="mt-1 text-xs text-[#53637A]">
                {t('ownerGate.versionLabel', {
                  version: (doc ?? acceptDoc)?.version ?? '—',
                })}
                {(doc ?? acceptDoc)?.effectiveAt ? (
                  <>
                    {' · '}
                    {t('ownerGate.effectiveLabel', {
                      date: formatPlatformDateTime(
                        (doc ?? acceptDoc)!.effectiveAt!,
                        locale,
                      ),
                    })}
                  </>
                ) : null}
              </p>
              {summary ? (
                <p className="mt-2 text-xs leading-relaxed text-[#53637A]">
                  {summary}
                  {summary.length >= 280 ? '…' : ''}
                </p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={viewLang === 'ar' ? 'default' : 'outline'}
                  data-testid="owner-agreement-link-ar"
                  onClick={() => setViewLang('ar')}
                  disabled={!docAr}
                >
                  {t('ownerGate.linkAr')}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={viewLang === 'en' ? 'default' : 'outline'}
                  data-testid="owner-agreement-link-en"
                  onClick={() => setViewLang('en')}
                  disabled={!docEn}
                >
                  {t('ownerGate.linkEn')}
                </Button>
              </div>
              {doc?.content ? (
                <div
                  className="mt-3 max-h-48 overflow-y-auto rounded-lg border border-[#E0E8F3] bg-white p-3 text-[11px] leading-relaxed text-[#53637A] whitespace-pre-wrap"
                  data-testid="owner-agreement-preview"
                >
                  {doc.content.slice(0, 4000)}
                  {doc.content.length > 4000 ? '…' : ''}
                </div>
              ) : null}
            </div>
          ) : (
            <p className="mt-2 text-xs text-amber-900/80">{t('acceptance.versionsUnavailable')}</p>
          )}

          <label className="mt-3 flex items-start gap-2.5 text-xs leading-relaxed text-amber-950">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-amber-300 text-primary"
              checked={checked}
              disabled={busy || !acceptDoc?.id}
              data-testid="owner-agreement-ack"
              onChange={(e) => setChecked(e.target.checked)}
            />
            <span>{t('ownerGate.ackCheckbox')}</span>
          </label>

          {error ? (
            <p className="mt-2 text-xs text-danger" role="alert">
              {error}
            </p>
          ) : null}

          <Button
            type="button"
            size="sm"
            className="mt-3"
            disabled={!checked || busy || !acceptDoc?.id}
            data-testid="owner-agreement-accept"
            onClick={() => void handleAccept()}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {t('ownerGate.acceptCta')}
          </Button>
        </div>
      </div>
    </div>
  );
}
