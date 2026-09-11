'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { OwnerPerformancePanel } from '@/components/owner/owner-performance-panel';
import { AdminPartnerSettlements } from '@/components/admin/admin-partner-settlements';
import {
  activateAdminPartnerCommercialTerms,
  adminPartnerDocumentFileUrl,
  approveAdminPartner,
  createAdminPartnerCommercialTerms,
  fetchAdminPartner,
  fetchAdminPartnerPerformance,
  previewAdminPartnerCommercialTerms,
  rejectAdminPartner,
  requestAdminPartnerChanges,
  restoreAdminPartner,
  reviewAdminPartnerDocument,
  reviewAdminPartnerPayout,
  suspendAdminPartner,
  type AdminPartnerDetail,
} from '@/lib/api-admin';

function verificationVariant(status: string) {
  if (status === 'approved' || status === 'legacy_approved') return 'highlight' as const;
  if (status === 'rejected' || status === 'suspended') return 'muted' as const;
  return 'default' as const;
}

export function AdminPartnerDetailView({ ownerId }: { ownerId: string }) {
  const t = useTranslations('admin');
  const locale = useLocale() as 'ar' | 'en';
  const [partner, setPartner] = useState<AdminPartnerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [docReasons, setDocReasons] = useState<Record<string, string>>({});
  const [changeReason, setChangeReason] = useState('');
  const [actionReason, setActionReason] = useState('');
  const [useDefaultCommission, setUseDefaultCommission] = useState(false);
  const [commissionPercent, setCommissionPercent] = useState('10');
  const [effectiveFrom, setEffectiveFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [previewText, setPreviewText] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAdminPartner(ownerId);
      setPartner(res.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('loadError'));
    } finally {
      setLoading(false);
    }
  }, [ownerId, t]);

  const loadPerformance = useCallback(
    async (range: import('@mazare3/shared').OwnerPerformanceRange) => {
      const res = await fetchAdminPartnerPerformance(ownerId, range);
      return res.data;
    },
    [ownerId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  async function run(action: () => Promise<{ data: AdminPartnerDetail } | void>) {
    setSaving(true);
    setError(null);
    try {
      const res = await action();
      if (res && 'data' in res && res.data && 'ownerProfileId' in res.data) {
        setPartner(res.data);
      } else {
        await load();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t('saveError'));
    } finally {
      setSaving(false);
    }
  }

  async function openDocument(documentId: string) {
    try {
      const res = await fetch(adminPartnerDocumentFileUrl(ownerId, documentId), {
        credentials: 'include',
      });
      if (!res.ok) throw new Error(t('loadError'));
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (e) {
      setError(e instanceof Error ? e.message : t('loadError'));
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error && !partner) {
    return (
      <p className="rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-danger">
        {error}
      </p>
    );
  }

  if (!partner) return null;

  const dateLocale = locale === 'ar' ? 'ar-JO' : 'en-GB';

  return (
    <div className="space-y-6" data-testid="admin-partner-detail">
      <Button variant="ghost" size="sm" asChild className="gap-1">
        <Link href="/admin/owners">
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
          {t('backToOwners')}
        </Link>
      </Button>

      {error ? (
        <p className="rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-danger">{error}</p>
      ) : null}

      <Card className="glass-panel overflow-hidden rounded-2xl border-primary/12">
        <div className="gradient-primary h-1" />
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-2xl">{partner.displayName}</CardTitle>
              <p className="mt-1 text-sm text-muted">{partner.email ?? '—'}</p>
              {partner.businessName ? (
                <p className="text-sm text-muted">{partner.businessName}</p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant={verificationVariant(partner.verificationStatus)}>
                {t(`partnerVerification.${partner.verificationStatus}`)}
              </Badge>
              <Badge variant="muted">{t(`ownerStatus.${partner.ownerStatus}`)}</Badge>
              {partner.legacyApproved ? <Badge variant="highlight">{t('legacyBadge')}</Badge> : null}
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <p>
            <span className="text-muted">{t('colArea')}: </span>
            {partner.area && partner.city ? `${partner.area} — ${partner.city}` : '—'}
          </p>
          <p>
            <span className="text-muted">{t('colEmail')}: </span>
            {partner.contactEmail ?? partner.email ?? '—'}
          </p>
          <p dir="ltr">
            <span className="text-muted">{t('colOwner')}: </span>
            {partner.phone}
          </p>
          <p>
            <span className="text-muted">{t('colProperties')}: </span>
            {partner.publishedPropertiesCount}
          </p>
          {partner.changeRequestReason ? (
            <p className="sm:col-span-2 text-navy">
              {t('requestChanges')}: {partner.changeRequestReason}
            </p>
          ) : null}
          {partner.rejectionReason ? (
            <p className="sm:col-span-2 text-danger">
              {t('rejectPartner')}: {partner.rejectionReason}
            </p>
          ) : null}
          {partner.suspensionReason ? (
            <p className="sm:col-span-2 text-danger">
              {t('suspendPartner')}: {partner.suspensionReason}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <OwnerPerformancePanel ns="admin" locale={locale} load={loadPerformance} />

      <AdminPartnerSettlements
        ownerId={ownerId}
        payoutReady={partner.payout.reviewStatus === 'reviewed'}
      />

      <Card className="rounded-2xl border-primary/12">
        <CardHeader>
          <CardTitle>{t('partnerDocuments')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {partner.documents.length === 0 ? (
            <p className="text-sm text-muted">{t('ownersEmpty')}</p>
          ) : (
            partner.documents.map((doc) => (
              <div key={doc.id} className="rounded-2xl border border-border bg-background p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-navy">{doc.originalFileName}</p>
                    <p className="text-xs text-muted">{doc.documentType}</p>
                  </div>
                  <Badge variant={doc.reviewStatus === 'approved' ? 'highlight' : 'muted'}>
                    {t(`docReview.${doc.reviewStatus}`)}
                  </Badge>
                </div>
                {doc.rejectionReason ? (
                  <p className="mt-2 text-sm text-danger">{doc.rejectionReason}</p>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    data-testid={`admin-view-doc-${doc.id}`}
                    onClick={() => void openDocument(doc.id)}
                  >
                    {t('viewDocument')}
                  </Button>
                  <Input
                    placeholder={t('documentReason')}
                    data-testid={`admin-doc-reason-${doc.id}`}
                    value={docReasons[doc.id] ?? ''}
                    onChange={(e) =>
                      setDocReasons((prev) => ({ ...prev, [doc.id]: e.target.value }))
                    }
                    className="max-w-xs"
                  />
                  <Button
                    size="sm"
                    disabled={saving}
                    data-testid={`admin-approve-doc-${doc.id}`}
                    onClick={() =>
                      void run(() =>
                        reviewAdminPartnerDocument(ownerId, doc.id, { status: 'approved' }),
                      )
                    }
                  >
                    {t('approveDocument')}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={saving}
                    data-testid={`admin-reject-doc-${doc.id}`}
                    onClick={() =>
                      void run(() =>
                        reviewAdminPartnerDocument(ownerId, doc.id, {
                          status: 'rejected',
                          reason: docReasons[doc.id] || t('defaultRejectReason'),
                        }),
                      )
                    }
                  >
                    {t('rejectDocument')}
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-primary/12">
        <CardHeader>
          <CardTitle>{t('partnerPayout')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-navy" data-testid="partner-iban-masked">
            {partner.payout.ibanMasked ?? '—'}
          </p>
          <p className="text-sm text-muted">
            {partner.payout.reviewStatus
              ? t(`payoutReview.${partner.payout.reviewStatus}`)
              : t('payoutReview.pending')}
          </p>
          {partner.payout.reviewReason ? (
            <p className="text-sm text-danger">{partner.payout.reviewReason}</p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              data-testid="admin-payout-reviewed"
              disabled={saving || !partner.payout.complete}
              onClick={() =>
                void run(() => reviewAdminPartnerPayout(ownerId, { status: 'reviewed' }))
              }
            >
              {t('markPayoutReviewed')}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={saving || !partner.payout.complete}
              onClick={() =>
                void run(() =>
                  reviewAdminPartnerPayout(ownerId, {
                    status: 'rejected',
                    reason: actionReason || t('defaultRejectReason'),
                  }),
                )
              }
            >
              {t('rejectPayout')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-primary/12">
        <CardHeader>
          <CardTitle>{t('partnerTerms')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <label className="text-sm text-muted">{t('commissionPercent')}</label>
              <Input
                type="number"
                min={0}
                max={100}
                step="0.1"
                value={commissionPercent}
                onChange={(e) => setCommissionPercent(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm text-muted">{t('effectiveFrom')}</label>
              <Input
                type="date"
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button
                disabled={saving}
                onClick={() =>
                  void (async () => {
                    setSaving(true);
                    setError(null);
                    try {
                      const created = await createAdminPartnerCommercialTerms(ownerId, {
                        commissionPercent: Number(commissionPercent),
                        effectiveFrom: new Date(effectiveFrom).toISOString(),
                      });
                      await activateAdminPartnerCommercialTerms(ownerId, created.data.id);
                      await load();
                    } catch (e) {
                      setError(e instanceof Error ? e.message : t('saveError'));
                    } finally {
                      setSaving(false);
                    }
                  })()
                }
              >
                {t('createTerms')}
              </Button>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={saving}
            onClick={() =>
              void (async () => {
                try {
                  const res = await previewAdminPartnerCommercialTerms(ownerId);
                  setPreviewText(
                    t('termsPreview', {
                      percent: res.data.commissionPercent,
                      source: t(`commissionSource.${res.data.source}`),
                    }),
                  );
                } catch (e) {
                  setError(e instanceof Error ? e.message : t('loadError'));
                }
              })()
            }
          >
            {t('previewTerms')}
          </Button>
          {previewText ? <p className="text-sm text-navy">{previewText}</p> : null}
          <ul className="space-y-2 text-sm">
            {partner.commercialTermsList.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-3 py-2"
              >
                <span>
                  {row.commissionPercent}% · {t(`termsStatus.${row.status}`)} ·{' '}
                  {new Date(row.effectiveFrom).toLocaleDateString(dateLocale)}
                </span>
                {row.status === 'draft' || row.status === 'scheduled' ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={saving}
                    onClick={() =>
                      void (async () => {
                        setSaving(true);
                        try {
                          await activateAdminPartnerCommercialTerms(ownerId, row.id);
                          await load();
                        } catch (e) {
                          setError(e instanceof Error ? e.message : t('saveError'));
                        } finally {
                          setSaving(false);
                        }
                      })()
                    }
                  >
                    {t('activateTerms')}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-primary/12">
        <CardHeader>
          <CardTitle>{t('suspensionImpact')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm text-navy">
          <p>{t('impactPublished', { count: partner.suspensionImpact.publishedProperties })}</p>
          <p>{t('impactBookings', { count: partner.suspensionImpact.openBookings })}</p>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-primary/12">
        <CardHeader>
          <CardTitle>{t('partnerActions')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!partner.readiness.canApprove ? (
            <p className="text-sm text-muted">{t('notReadyToApprove')}</p>
          ) : null}
          <textarea
            rows={3}
            className="flex w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm"
            placeholder={t('reasonPlaceholder')}
            value={actionReason}
            onChange={(e) => setActionReason(e.target.value)}
          />
          <div className="space-y-2">
            <label className="text-sm font-medium text-navy">{t('requestChangesReason')}</label>
            <textarea
              rows={3}
              className="flex w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm"
              value={changeReason}
              onChange={(e) => setChangeReason(e.target.value)}
            />
            <Button
              size="sm"
              variant="outline"
              disabled={saving || changeReason.trim().length < 8}
              onClick={() =>
                void run(() =>
                  requestAdminPartnerChanges(ownerId, { reason: changeReason.trim() }),
                )
              }
            >
              {t('sendChangeRequest')}
            </Button>
          </div>
          <label className="flex items-center gap-2 text-sm text-navy">
            <input
              type="checkbox"
              data-testid="admin-use-platform-default"
              checked={useDefaultCommission}
              onChange={(e) => setUseDefaultCommission(e.target.checked)}
            />
            {t('usePlatformDefaultCommission')}
          </label>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={saving || !partner.readiness.canApprove}
              data-testid="admin-approve-partner"
              onClick={() =>
                void run(() =>
                  approveAdminPartner(ownerId, {
                    usePlatformDefaultCommission: useDefaultCommission,
                  }),
                )
              }
            >
              {t('approvePartner')}
            </Button>
            <Button
              variant="outline"
              disabled={saving || actionReason.trim().length < 8}
              onClick={() => void run(() => rejectAdminPartner(ownerId, actionReason.trim()))}
            >
              {t('rejectPartner')}
            </Button>
            <Button
              variant="outline"
              disabled={saving || actionReason.trim().length < 8}
              onClick={() => void run(() => suspendAdminPartner(ownerId, actionReason.trim()))}
            >
              {t('suspendPartner')}
            </Button>
            <Button
              variant="secondary"
              disabled={saving}
              onClick={() => void run(() => restoreAdminPartner(ownerId))}
            >
              {t('restorePartner')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-primary/12">
        <CardHeader>
          <CardTitle>{t('partnerAudit')}</CardTitle>
        </CardHeader>
        <CardContent>
          {partner.audit.length === 0 ? (
            <p className="text-sm text-muted">{t('auditEmpty')}</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {partner.audit.map((row) => (
                <li key={row.id} className="rounded-xl border border-border px-3 py-2">
                  <p className="font-medium text-navy">{row.action}</p>
                  <p className="text-xs text-muted">
                    {new Date(row.createdAt).toLocaleString(dateLocale)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
