'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, FileText, Plus, Eye, Send, CalendarClock } from 'lucide-react';
import { LEGAL_DOCUMENT_TYPES, DATA_SUBJECT_REQUEST_STATUSES } from '@mazare3/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AdminApiError,
  bootstrapAdminLegalPlaceholders,
  createAdminLegalDraft,
  fetchAdminDataSubjectRequests,
  fetchAdminLegalAcceptance,
  fetchAdminLegalActivationReadiness,
  fetchAdminLegalRelease,
  fetchAdminLegalReleases,
  fetchAdminLegalStats,
  patchAdminDataSubjectRequest,
  patchAdminLegalReleaseGovernance,
  publishAdminLegalRelease,
  scheduleAdminLegalRelease,
  updateAdminLegalDraft,
  type AdminDataSubjectRequestRow,
  type AdminLegalAcceptanceInspect,
  type AdminLegalActivationReadiness,
  type AdminLegalRelease,
  type AdminLegalStats,
} from '@/lib/api-admin';
import { AdminBreachIncidentsPanel } from '@/components/admin/admin-breach-incidents-panel';

type TabId = 'releases' | 'stats' | 'inspect' | 'dsr' | 'breach' | 'readiness';

const DOC_TYPES = LEGAL_DOCUMENT_TYPES;

export function AdminLegalConsoleView() {
  const t = useTranslations('admin.legal');
  const tAdmin = useTranslations('admin');
  const [tab, setTab] = useState<TabId>('releases');
  const [typeFilter, setTypeFilter] = useState('');
  const [releases, setReleases] = useState<AdminLegalRelease[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<AdminLegalRelease | null>(null);
  const [stats, setStats] = useState<AdminLegalStats | null>(null);
  const [inspectId, setInspectId] = useState('');
  const [inspected, setInspected] = useState<AdminLegalAcceptanceInspect | null>(null);
  const [dsrRows, setDsrRows] = useState<AdminDataSubjectRequestRow[]>([]);
  const [dsrStatus, setDsrStatus] = useState('');
  const [dsrOverdueOnly, setDsrOverdueOnly] = useState(false);
  const [dsrRejectReasons, setDsrRejectReasons] = useState<Record<string, string>>({});
  const [readiness, setReadiness] = useState<AdminLegalActivationReadiness | null>(null);
  const [govReason, setGovReason] = useState('');
  const [govReviewStatus, setGovReviewStatus] = useState('not_reviewed');
  const [govFounderStatus, setGovFounderStatus] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewLang, setPreviewLang] = useState<'ar' | 'en'>('ar');
  const [showCreate, setShowCreate] = useState(false);

  // Draft create/edit fields
  const [draftType, setDraftType] = useState<string>('terms_and_conditions');
  const [draftVersion, setDraftVersion] = useState('1.0.0');
  const [draftChangelog, setDraftChangelog] = useState('');
  const [draftRequiresReaccept, setDraftRequiresReaccept] = useState(false);
  const [draftMaterial, setDraftMaterial] = useState(false);
  const [draftTitleEn, setDraftTitleEn] = useState('');
  const [draftTitleAr, setDraftTitleAr] = useState('');
  const [draftContentEn, setDraftContentEn] = useState('');
  const [draftContentAr, setDraftContentAr] = useState('');
  const [effectiveAt, setEffectiveAt] = useState('');

  const loadReleases = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAdminLegalReleases(typeFilter || undefined);
      setReleases(res.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : tAdmin('loadError'));
    } finally {
      setLoading(false);
    }
  }, [typeFilter, tAdmin]);

  const loadSelected = useCallback(async (id: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetchAdminLegalRelease(id);
      setSelected(res.data);
      setSelectedId(id);
      setDraftChangelog(res.data.changelog ?? '');
      setDraftRequiresReaccept(res.data.requiresReacceptance);
      setDraftMaterial(res.data.materialChange);
      const en = res.data.versions.find((v) => v.language === 'en');
      const ar = res.data.versions.find((v) => v.language === 'ar');
      setDraftTitleEn(en?.title ?? '');
      setDraftTitleAr(ar?.title ?? '');
      setDraftContentEn(en?.content ?? '');
      setDraftContentAr(ar?.content ?? '');
      setEffectiveAt(res.data.effectiveAt?.slice(0, 16) ?? '');
      setGovReviewStatus(res.data.legalReviewStatus ?? 'not_reviewed');
      setGovFounderStatus(res.data.founderApprovalStatus ?? 'pending');
    } catch (e) {
      setError(e instanceof Error ? e.message : tAdmin('loadError'));
    } finally {
      setBusy(false);
    }
  }, [tAdmin]);

  useEffect(() => {
    if (tab === 'releases') void loadReleases();
  }, [tab, loadReleases]);

  useEffect(() => {
    if (tab !== 'stats') return;
    void (async () => {
      setLoading(true);
      try {
        const res = await fetchAdminLegalStats();
        setStats(res.data);
      } catch (e) {
        setError(e instanceof Error ? e.message : tAdmin('loadError'));
      } finally {
        setLoading(false);
      }
    })();
  }, [tab, tAdmin]);

  useEffect(() => {
    if (tab !== 'dsr') return;
    void (async () => {
      setLoading(true);
      try {
        const res = await fetchAdminDataSubjectRequests(dsrStatus || undefined, dsrOverdueOnly);
        setDsrRows(res.data);
      } catch (e) {
        setError(e instanceof Error ? e.message : tAdmin('loadError'));
      } finally {
        setLoading(false);
      }
    })();
  }, [tab, dsrStatus, dsrOverdueOnly, tAdmin]);

  useEffect(() => {
    if (tab !== 'readiness') return;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchAdminLegalActivationReadiness();
        setReadiness(res.data);
      } catch (e) {
        setError(e instanceof Error ? e.message : tAdmin('loadError'));
      } finally {
        setLoading(false);
      }
    })();
  }, [tab, tAdmin]);

  const previewContent = useMemo(() => {
    if (!selected) return null;
    return selected.versions.find((v) => v.language === previewLang) ?? selected.versions[0] ?? null;
  }, [selected, previewLang]);

  async function handleCreateDraft() {
    setBusy(true);
    setError(null);
    try {
      const versions = [];
      if (draftTitleEn.trim() && draftContentEn.trim()) {
        versions.push({
          language: 'en' as const,
          title: draftTitleEn.trim(),
          content: draftContentEn.trim(),
        });
      }
      if (draftTitleAr.trim() && draftContentAr.trim()) {
        versions.push({
          language: 'ar' as const,
          title: draftTitleAr.trim(),
          content: draftContentAr.trim(),
        });
      }
      if (versions.length === 0) {
        setError(t('needVersionContent'));
        return;
      }
      const res = await createAdminLegalDraft({
        documentType: draftType,
        version: draftVersion.trim(),
        requiresReacceptance: draftRequiresReaccept,
        materialChange: draftMaterial,
        changelog: draftChangelog.trim() || null,
        versions,
      });
      setShowCreate(false);
      await loadReleases();
      await loadSelected(res.data.id);
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : tAdmin('saveError'));
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveDraft() {
    if (!selected || selected.status !== 'draft') return;
    setBusy(true);
    setError(null);
    try {
      const versions = [];
      if (draftTitleEn.trim() && draftContentEn.trim()) {
        versions.push({
          language: 'en' as const,
          title: draftTitleEn.trim(),
          content: draftContentEn.trim(),
        });
      }
      if (draftTitleAr.trim() && draftContentAr.trim()) {
        versions.push({
          language: 'ar' as const,
          title: draftTitleAr.trim(),
          content: draftContentAr.trim(),
        });
      }
      await updateAdminLegalDraft(selected.id, {
        requiresReacceptance: draftRequiresReaccept,
        materialChange: draftMaterial,
        changelog: draftChangelog.trim() || null,
        effectiveAt: effectiveAt ? new Date(effectiveAt).toISOString() : null,
        versions: versions.length ? versions : undefined,
      });
      await loadSelected(selected.id);
      await loadReleases();
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : tAdmin('saveError'));
    } finally {
      setBusy(false);
    }
  }

  async function handlePublish() {
    if (!selectedId) return;
    setBusy(true);
    setError(null);
    try {
      await publishAdminLegalRelease({
        releaseId: selectedId,
        effectiveAt: effectiveAt ? new Date(effectiveAt).toISOString() : undefined,
      });
      await loadSelected(selectedId);
      await loadReleases();
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : tAdmin('saveError'));
    } finally {
      setBusy(false);
    }
  }

  async function handleSchedule() {
    if (!selectedId || !effectiveAt) {
      setError(t('effectiveRequired'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await scheduleAdminLegalRelease({
        releaseId: selectedId,
        effectiveAt: new Date(effectiveAt).toISOString(),
      });
      await loadSelected(selectedId);
      await loadReleases();
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : tAdmin('saveError'));
    } finally {
      setBusy(false);
    }
  }

  async function handleBootstrap() {
    if (!window.confirm(t('bootstrapConfirm'))) return;
    setBusy(true);
    setError(null);
    try {
      await bootstrapAdminLegalPlaceholders();
      await loadReleases();
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : tAdmin('saveError'));
    } finally {
      setBusy(false);
    }
  }

  async function handleInspect() {
    if (!inspectId.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetchAdminLegalAcceptance(inspectId.trim());
      setInspected(res.data);
    } catch (e) {
      setInspected(null);
      setError(e instanceof AdminApiError ? e.message : tAdmin('loadError'));
    } finally {
      setBusy(false);
    }
  }

  async function handleGovernanceSave() {
    if (!selectedId || !govReason.trim()) {
      setError(t('governanceReasonRequired'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await patchAdminLegalReleaseGovernance(selectedId, {
        legalReviewStatus: govReviewStatus,
        founderApprovalStatus: govFounderStatus,
        reason: govReason.trim(),
      });
      await loadSelected(selectedId);
      setGovReason('');
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : tAdmin('saveError'));
    } finally {
      setBusy(false);
    }
  }

  const tabs: { id: TabId; label: string }[] = [
    { id: 'releases', label: t('tabReleases') },
    { id: 'stats', label: t('tabStats') },
    { id: 'inspect', label: t('tabInspect') },
    { id: 'dsr', label: t('tabDsr') },
    { id: 'breach', label: t('tabBreach') },
    { id: 'readiness', label: t('tabReadiness') },
  ];

  return (
    <div data-testid="admin-legal" className="space-y-4">
      <p className="text-sm text-muted">{t('subtitle')}</p>

      <div className="flex flex-wrap gap-2">
        {tabs.map((item) => (
          <Button
            key={item.id}
            type="button"
            size="sm"
            variant={tab === item.id ? 'default' : 'outline'}
            data-testid={`admin-legal-tab-${item.id}`}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </Button>
        ))}
      </div>

      {error ? (
        <p className="rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {tab === 'releases' ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <Label className="text-xs">{t('filterType')}</Label>
              <select
                className="mt-1 block rounded-xl border border-border bg-surface px-3 py-2 text-sm"
                value={typeFilter}
                data-testid="admin-legal-type-filter"
                onChange={(e) => setTypeFilter(e.target.value)}
              >
                <option value="">{t('allTypes')}</option>
                {DOC_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
            <Button
              type="button"
              size="sm"
              data-testid="admin-legal-create"
              onClick={() => setShowCreate((v) => !v)}
            >
              <Plus className="h-4 w-4" />
              {t('createDraft')}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              data-testid="admin-legal-bootstrap"
              disabled={busy}
              onClick={() => void handleBootstrap()}
            >
              {t('bootstrap')}
            </Button>
          </div>

          {showCreate ? (
            <Card className="rounded-2xl border-primary/12">
              <CardContent className="space-y-3 py-4">
                <h3 className="font-semibold text-navy">{t('createDraft')}</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>{t('documentType')}</Label>
                    <select
                      className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm"
                      value={draftType}
                      onChange={(e) => setDraftType(e.target.value)}
                    >
                      {DOC_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label>{t('version')}</Label>
                    <Input value={draftVersion} onChange={(e) => setDraftVersion(e.target.value)} />
                  </div>
                </div>
                <div>
                  <Label>{t('changelog')}</Label>
                  <textarea
                    className="mt-1 min-h-[72px] w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm"
                    value={draftChangelog}
                    onChange={(e) => setDraftChangelog(e.target.value)}
                  />
                </div>
                <div className="flex flex-wrap gap-4 text-sm">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={draftRequiresReaccept}
                      onChange={(e) => setDraftRequiresReaccept(e.target.checked)}
                    />
                    {t('requiresReacceptance')}
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={draftMaterial}
                      onChange={(e) => setDraftMaterial(e.target.checked)}
                    />
                    {t('materialChange')}
                  </label>
                </div>
                <div className="grid gap-3 lg:grid-cols-2">
                  <div>
                    <Label>{t('titleEn')}</Label>
                    <Input value={draftTitleEn} onChange={(e) => setDraftTitleEn(e.target.value)} />
                    <textarea
                      className="mt-2 min-h-[120px] w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm"
                      value={draftContentEn}
                      onChange={(e) => setDraftContentEn(e.target.value)}
                      placeholder={t('contentEn')}
                    />
                  </div>
                  <div>
                    <Label>{t('titleAr')}</Label>
                    <Input value={draftTitleAr} onChange={(e) => setDraftTitleAr(e.target.value)} />
                    <textarea
                      className="mt-2 min-h-[120px] w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm"
                      value={draftContentAr}
                      onChange={(e) => setDraftContentAr(e.target.value)}
                      placeholder={t('contentAr')}
                      dir="rtl"
                    />
                  </div>
                </div>
                <Button type="button" disabled={busy} onClick={() => void handleCreateDraft()}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {t('saveDraft')}
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : releases.length === 0 ? (
            <Card className="rounded-2xl">
              <CardContent className="py-12 text-center text-muted">{t('emptyReleases')}</CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                {releases.map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    data-testid={`admin-legal-release-${row.id}`}
                    className={`flex w-full items-start gap-3 rounded-2xl border px-3 py-3 text-start transition ${
                      selectedId === row.id
                        ? 'border-primary bg-primary-soft'
                        : 'border-border bg-surface hover:border-primary/40'
                    }`}
                    onClick={() => void loadSelected(row.id)}
                  >
                    <FileText className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-navy">
                        {row.documentType} · v{row.version}
                      </p>
                      <p className="mt-0.5 text-xs text-muted">
                        {row.status}
                        {row.requiresReacceptance ? ` · ${t('requiresReacceptance')}` : ''}
                        {row.materialChange ? ` · ${t('materialChange')}` : ''}
                      </p>
                      <p className="mt-0.5 truncate font-mono text-[10px] text-muted">
                        {row.versions.map((v) => v.contentHash.slice(0, 10)).join(' / ')}
                      </p>
                    </div>
                  </button>
                ))}
              </div>

              <Card className="rounded-2xl border-primary/12">
                <CardContent className="space-y-3 py-4">
                  {!selected ? (
                    <p className="py-10 text-center text-sm text-muted">{t('selectRelease')}</p>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h3 className="font-semibold text-navy">
                            {selected.documentType} · v{selected.version}
                          </h3>
                          <p className="text-xs text-muted">
                            {selected.status}
                            {selected.publishedAt
                              ? ` · ${t('publishedAt')}: ${selected.publishedAt}`
                              : ''}
                            {selected.supersededAt
                              ? ` · ${t('supersededAt')}: ${selected.supersededAt}`
                              : ''}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant={previewLang === 'ar' ? 'default' : 'outline'}
                            onClick={() => setPreviewLang('ar')}
                          >
                            AR
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={previewLang === 'en' ? 'default' : 'outline'}
                            onClick={() => setPreviewLang('en')}
                          >
                            EN
                          </Button>
                        </div>
                      </div>

                      {previewContent ? (
                        <div
                          className="max-h-64 overflow-auto rounded-xl border border-border bg-[#F8FBFF] p-3 text-xs whitespace-pre-wrap"
                          data-testid="admin-legal-preview"
                          dir={previewContent.language === 'ar' ? 'rtl' : 'ltr'}
                        >
                          <p className="mb-2 font-semibold">{previewContent.title}</p>
                          <p className="mb-2 font-mono text-[10px] text-muted">
                            hash: {previewContent.contentHash}
                          </p>
                          {previewContent.content}
                        </div>
                      ) : (
                        <p className="text-sm text-muted">{t('noPreview')}</p>
                      )}

                      <div
                        className="space-y-3 border-t border-border pt-3"
                        data-testid="admin-legal-governance"
                      >
                        <p className="text-xs font-medium text-muted">{t('governanceTitle')}</p>
                        <p className="text-[11px] text-muted">
                          {t('governanceHint')} · review={selected.legalReviewStatus ?? '—'} ·
                          founder={selected.founderApprovalStatus ?? '—'}
                        </p>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <div>
                            <Label className="text-xs">{t('legalReviewStatus')}</Label>
                            <select
                              className="mt-1 block w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm"
                              value={govReviewStatus}
                              onChange={(e) => setGovReviewStatus(e.target.value)}
                            >
                              {[
                                'not_reviewed',
                                'under_review',
                                'approved',
                                'approved_with_changes',
                                'rejected',
                              ].map((s) => (
                                <option key={s} value={s}>
                                  {s}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <Label className="text-xs">{t('founderApprovalStatus')}</Label>
                            <select
                              className="mt-1 block w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm"
                              value={govFounderStatus}
                              onChange={(e) => setGovFounderStatus(e.target.value)}
                            >
                              {['pending', 'approved', 'rejected'].map((s) => (
                                <option key={s} value={s}>
                                  {s}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs">{t('governanceReason')}</Label>
                          <Input
                            value={govReason}
                            onChange={(e) => setGovReason(e.target.value)}
                            placeholder={t('governanceReason')}
                          />
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => void handleGovernanceSave()}
                        >
                          {t('saveGovernance')}
                        </Button>
                      </div>

                      {selected.status === 'draft' ? (
                        <div className="space-y-3 border-t border-border pt-3">
                          <p className="text-xs font-medium text-muted">{t('editDraftOnly')}</p>
                          <div>
                            <Label>{t('changelog')}</Label>
                            <textarea
                              className="mt-1 min-h-[64px] w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm"
                              value={draftChangelog}
                              onChange={(e) => setDraftChangelog(e.target.value)}
                            />
                          </div>
                          <div className="flex flex-wrap gap-4 text-sm">
                            <label className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={draftRequiresReaccept}
                                onChange={(e) => setDraftRequiresReaccept(e.target.checked)}
                              />
                              {t('requiresReacceptance')}
                            </label>
                            <label className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={draftMaterial}
                                onChange={(e) => setDraftMaterial(e.target.checked)}
                              />
                              {t('materialChange')}
                            </label>
                          </div>
                          <div>
                            <Label>{t('effectiveAt')}</Label>
                            <Input
                              type="datetime-local"
                              value={effectiveAt}
                              onChange={(e) => setEffectiveAt(e.target.value)}
                            />
                          </div>
                          <div className="grid gap-3 lg:grid-cols-2">
                            <textarea
                              className="min-h-[100px] w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm"
                              value={draftContentEn}
                              onChange={(e) => setDraftContentEn(e.target.value)}
                              placeholder={t('contentEn')}
                            />
                            <textarea
                              className="min-h-[100px] w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm"
                              value={draftContentAr}
                              onChange={(e) => setDraftContentAr(e.target.value)}
                              placeholder={t('contentAr')}
                              dir="rtl"
                            />
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              size="sm"
                              disabled={busy}
                              onClick={() => void handleSaveDraft()}
                            >
                              {t('saveDraft')}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              disabled={busy}
                              data-testid="admin-legal-publish"
                              onClick={() => void handlePublish()}
                            >
                              <Send className="h-3.5 w-3.5" />
                              {t('publish')}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={busy}
                              data-testid="admin-legal-schedule"
                              onClick={() => void handleSchedule()}
                            >
                              <CalendarClock className="h-3.5 w-3.5" />
                              {t('schedule')}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2 border-t border-border pt-3 text-xs text-muted">
                          <p>{t('readOnlyNonDraft')}</p>
                          {selected.changelog ? (
                            <p>
                              <span className="font-medium text-navy">{t('changelog')}: </span>
                              {selected.changelog}
                            </p>
                          ) : null}
                        </div>
                      )}
                    </>
                  )}
                  {busy ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : null}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      ) : null}

      {tab === 'stats' ? (
        <Card className="rounded-2xl">
          <CardContent className="space-y-3 py-4" data-testid="admin-legal-stats">
            {loading || !stats ? (
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
            ) : (
              <>
                <p className="text-sm">
                  {t('acceptanceCount')}: <strong>{stats.acceptanceCount}</strong>
                </p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <StatBlock title={t('releasesByStatus')} rows={stats.releasesByStatus} />
                  <StatBlock title={t('consentsByStatus')} rows={stats.consentsByStatus} />
                  <StatBlock title={t('dsrByStatus')} rows={stats.dataSubjectRequestsByStatus} />
                </div>
                {stats.priorConsentReadiness ? (
                  <div
                    className="space-y-2 rounded-xl border border-[#E0E8F3] bg-[#F8FBFF] p-3"
                    data-testid="admin-prior-consent-readiness"
                  >
                    <p className="text-sm font-semibold text-navy">{t('priorConsentReadiness')}</p>
                    <p className="text-xs text-muted">
                      corpus {stats.priorConsentReadiness.corpusVersion} —{' '}
                      {stats.priorConsentReadiness.adminCannotGrantConsent
                        ? t('adminCannotGrantConsent')
                        : ''}
                    </p>
                    <ul className="space-y-1 text-xs text-[#53637A]">
                      {stats.priorConsentReadiness.purposeDefs.map((p) => (
                        <li key={p.purposeKey} data-testid={`admin-prior-purpose-${p.purposeKey}`}>
                          {p.purposeKey} · {p.legalBasisStatus} · {p.durationStatus}
                        </li>
                      ))}
                    </ul>
                    <StatBlock
                      title={t('priorConsentCounts')}
                      rows={stats.priorConsentReadiness.countsByPurposeStatus.map((r) => ({
                        status: `${r.purposeKey}:${r.status}`,
                        _count: r.count,
                      }))}
                    />
                  </div>
                ) : null}
                <p className="text-xs text-muted">{stats.note}</p>
              </>
            )}
          </CardContent>
        </Card>
      ) : null}

      {tab === 'inspect' ? (
        <Card className="rounded-2xl">
          <CardContent className="space-y-3 py-4">
            <p className="text-sm text-muted">{t('inspectHint')}</p>
            <div className="flex flex-wrap gap-2">
              <Input
                className="max-w-md"
                placeholder={t('acceptanceId')}
                value={inspectId}
                data-testid="admin-legal-inspect-id"
                onChange={(e) => setInspectId(e.target.value)}
              />
              <Button type="button" disabled={busy} onClick={() => void handleInspect()}>
                <Eye className="h-4 w-4" />
                {t('inspect')}
              </Button>
            </div>
            {inspected ? (
              <pre
                className="max-h-96 overflow-auto rounded-xl border border-border bg-[#F8FBFF] p-3 text-xs"
                data-testid="admin-legal-inspect-result"
              >
                {JSON.stringify(inspected, null, 2)}
              </pre>
            ) : null}
            <p className="text-xs text-muted">{t('noForgeNote')}</p>
          </CardContent>
        </Card>
      ) : null}

      {tab === 'dsr' ? (
        <div className="space-y-3" data-testid="admin-legal-dsr">
          <div className="flex flex-wrap items-center gap-3">
          <select
            className="rounded-xl border border-border bg-surface px-3 py-2 text-sm"
            value={dsrStatus}
            onChange={(e) => setDsrStatus(e.target.value)}
            data-testid="admin-legal-dsr-status-filter"
          >
            <option value="">{t('allStatuses')}</option>
            {DATA_SUBJECT_REQUEST_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm text-navy">
            <input
              type="checkbox"
              checked={dsrOverdueOnly}
              onChange={(e) => setDsrOverdueOnly(e.target.checked)}
              data-testid="admin-legal-dsr-overdue-only"
            />
            {t('dsrOverdueOnly')}
          </label>
          </div>
          {loading ? (
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          ) : dsrRows.length === 0 ? (
            <Card className="rounded-2xl">
              <CardContent className="py-12 text-center text-muted">{t('emptyDsr')}</CardContent>
            </Card>
          ) : (
            dsrRows.map((row) => (
              <Card key={row.id} className="rounded-2xl" data-testid={`admin-legal-dsr-${row.id}`}>
                <CardContent className="space-y-2 py-4 text-sm">
                  <p className="font-semibold text-navy">
                    {row.type} · {row.status}
                    {row.overdue || row.urgency === 'OVERDUE' ? (
                      <span
                        className="ms-2 rounded bg-danger/15 px-2 py-0.5 text-xs text-danger"
                        data-testid={`admin-legal-dsr-overdue-${row.id}`}
                      >
                        {t('dsrOverdueBadge')}
                      </span>
                    ) : null}
                    {!row.overdue && row.urgency === 'DUE_SOON' ? (
                      <span
                        className="ms-2 rounded bg-amber-500/15 px-2 py-0.5 text-xs text-amber-900"
                        data-testid={`admin-legal-dsr-due-soon-${row.id}`}
                      >
                        {t('dsrDueSoonBadge')}
                      </span>
                    ) : null}
                  </p>
                  <p className="text-xs text-muted">
                    {row.email ?? row.userId}
                  </p>
                  <p className="text-xs text-muted" data-testid={`admin-legal-dsr-submitted-${row.id}`}>
                    {t('dsrSubmittedAt')}: {row.receivedAt ?? row.createdAt}
                    {row.dueAt ? ` · ${t('dsrDueAt')}: ${row.dueAt}` : ''}
                    {row.resolvedAt ? ` · ${t('dsrResolvedAt')}: ${row.resolvedAt}` : ''}
                  </p>
                  {row.holidayCalendarStatus === 'HOLIDAY_CALENDAR_VERIFICATION_REQUIRED' ? (
                    <p
                      className="text-xs text-amber-800"
                      data-testid={`admin-legal-dsr-holiday-verify-${row.id}`}
                    >
                      {t('dsrHolidayCalendarVerify')}
                    </p>
                  ) : null}
                  {row.description ? <p>{row.description}</p> : null}
                  {row.rejectionReason ? (
                    <p className="text-xs text-amber-800">
                      {t('dsrRejectionReason')}: {row.rejectionReason}
                    </p>
                  ) : null}
                  <div className="space-y-1">
                    <Label htmlFor={`dsr-reject-${row.id}`}>{t('dsrRejectionReasonRequired')}</Label>
                    <Input
                      id={`dsr-reject-${row.id}`}
                      value={dsrRejectReasons[row.id] ?? ''}
                      onChange={(e) =>
                        setDsrRejectReasons((prev) => ({ ...prev, [row.id]: e.target.value }))
                      }
                      placeholder={t('dsrRejectionReasonPlaceholder')}
                      data-testid={`admin-legal-dsr-reject-reason-${row.id}`}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {DATA_SUBJECT_REQUEST_STATUSES.map((status) => (
                      <Button
                        key={status}
                        type="button"
                        size="sm"
                        variant={row.status === status ? 'default' : 'outline'}
                        disabled={busy}
                        onClick={() =>
                          void (async () => {
                            setBusy(true);
                            setError(null);
                            try {
                              const rejectionReason =
                                status === 'rejected_with_reason'
                                  ? (dsrRejectReasons[row.id] ?? '').trim()
                                  : undefined;
                              if (status === 'rejected_with_reason' && !rejectionReason) {
                                setError(t('dsrRejectionReasonRequiredError'));
                                return;
                              }
                              await patchAdminDataSubjectRequest(row.id, {
                                status,
                                rejectionReason: rejectionReason || null,
                              });
                              const res = await fetchAdminDataSubjectRequests(
                                dsrStatus || undefined,
                                dsrOverdueOnly,
                              );
                              setDsrRows(res.data);
                            } catch (e) {
                              setError(
                                e instanceof Error ? e.message : tAdmin('saveError'),
                              );
                            } finally {
                              setBusy(false);
                            }
                          })()
                        }
                      >
                        {status}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      ) : null}

      {tab === 'breach' ? <AdminBreachIncidentsPanel /> : null}

      {tab === 'readiness' ? (
        <Card className="rounded-2xl" data-testid="admin-legal-readiness">
          <CardContent className="space-y-4 py-4">
            <p className="text-sm text-muted">{t('readinessDisclaimer')}</p>
            {loading || !readiness ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <>
                <p className="text-lg font-semibold text-navy" data-testid="admin-legal-readiness-overall">
                  {t('readinessOverall')}: {readiness.overall}
                </p>
                <p className="text-xs text-muted">{readiness.disclaimer}</p>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl border border-border p-3 text-sm">
                    <p className="font-medium">{t('readinessLegalEntity')}</p>
                    <p className="mt-1 text-xs text-muted">
                      {readiness.identity.productNameEn} / {readiness.identity.productNameAr}
                    </p>
                    <ul className="mt-2 space-y-1 text-xs" data-testid="admin-legal-readiness-entity">
                      {(
                        [
                          ['legalEntityNameAr', 'Arabic legal name'],
                          ['legalEntityNameEn', 'English founder/company-confirmed name'],
                          ['legalFormAr', 'Legal form (AR)'],
                          ['legalFormEn', 'Legal form (EN)'],
                          ['commercialRegistrationNumber', 'CR number'],
                          ['nationalEstablishmentNumber', 'National establishment number'],
                          ['registeredAddressAr', 'Registered address (AR)'],
                          ['registeredAddressEn', 'Registered address (EN)'],
                          ['legalContactEmail', 'Legal contact email'],
                        ] as const
                      ).map(([key, label]) => {
                        const ok = readiness.identity.resolvedIdentity?.[key] ?? false;
                        return (
                          <li key={key} className={ok ? 'text-emerald-700' : 'text-amber-700'}>
                            {ok ? '✓' : '!'} {label}
                          </li>
                        );
                      })}
                    </ul>
                    <p className="mt-3 font-medium">{t('readinessOperations')}</p>
                    <ul className="mt-1 space-y-1 text-xs" data-testid="admin-legal-readiness-ops">
                      {(
                        [
                          ['projectOperationalEmail', 'Mazare3 operational email'],
                          ['partnershipContactPhone', 'Partnership contact phone'],
                        ] as const
                      ).map(([key, label]) => {
                        const ok = readiness.identity.resolvedIdentity?.[key] ?? false;
                        return (
                          <li key={key} className={ok ? 'text-emerald-700' : 'text-amber-700'}>
                            {ok ? '✓' : '!'} {label}
                          </li>
                        );
                      })}
                    </ul>
                    <p className="mt-3 font-medium">{t('readinessPrivacy')}</p>
                    <ul className="mt-1 space-y-1 text-xs text-amber-700" data-testid="admin-legal-readiness-privacy">
                      <li>
                        {readiness.privacy.privacyContactConfigured ? '✓' : '!'} privacy contact{' '}
                        {readiness.privacy.privacyContactConfigured
                          ? t('readinessResolved')
                          : t('readinessUnresolved')}
                      </li>
                      <li>
                        {readiness.identity.dpoAppointed ? '✓' : '!'} DPO appointment{' '}
                        {readiness.identity.dpoAppointed
                          ? t('readinessResolved')
                          : t('readinessUnresolved')}
                      </li>
                    </ul>
                    <p className="mt-3 font-medium">{t('readinessLegalReview')}</p>
                    <ul className="mt-1 space-y-1 text-xs text-amber-700">
                      <li>
                        {readiness.legalReview.anyApproved ? '✓' : '!'} counsel approval{' '}
                        {readiness.legalReview.anyApproved
                          ? t('readinessResolved')
                          : t('readinessUnresolved')}
                      </li>
                      <li>
                        {readiness.founderApproval.anyApproved ? '✓' : '!'} founder approval{' '}
                        {readiness.founderApproval.anyApproved
                          ? t('readinessResolved')
                          : t('readinessUnresolved')}
                      </li>
                    </ul>
                    <ul className="mt-2 list-inside list-disc text-xs text-muted">
                      {readiness.identity.founderInputRequired.length === 0 ? (
                        <li>{t('readinessIdentityOk')}</li>
                      ) : (
                        readiness.identity.founderInputRequired.map((item) => (
                          <li key={item.key}>
                            {item.key}
                            {item.token ? ` ${item.token}` : ''}
                          </li>
                        ))
                      )}
                    </ul>
                  </div>
                  <div className="rounded-xl border border-border p-3 text-sm">
                    <p className="font-medium">{t('readinessPsp')}</p>
                    <p className="mt-1 text-xs">
                      {readiness.psp.status}: {readiness.psp.note}
                    </p>
                  </div>
                </div>
                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#F8FBFF] text-muted">
                      <tr>
                        <th className="px-3 py-2">{t('documentType')}</th>
                        <th className="px-3 py-2">{t('version')}</th>
                        <th className="px-3 py-2">AR/EN</th>
                        <th className="px-3 py-2">{t('legalReviewStatus')}</th>
                        <th className="px-3 py-2">Issues</th>
                      </tr>
                    </thead>
                    <tbody>
                      {readiness.documents.map((doc) => (
                        <tr key={doc.documentType} className="border-t border-border">
                          <td className="px-3 py-2 font-mono">{doc.documentType}</td>
                          <td className="px-3 py-2">
                            {doc.activeVersion ?? (doc.draftLaunchCandidate ? 'draft-lc' : '—')}
                          </td>
                          <td className="px-3 py-2">
                            {doc.languages.ar ? 'AR' : '—'}/{doc.languages.en ? 'EN' : '—'}
                          </td>
                          <td className="px-3 py-2">{doc.legalReviewStatus ?? '—'}</td>
                          <td className="px-3 py-2 text-muted">
                            {doc.issues.length ? doc.issues.join('; ') : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-muted">{readiness.consistency.ssotNote}</p>
              </>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function StatBlock({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ status: string; _count: number }>;
}) {
  return (
    <div className="rounded-xl border border-border p-3">
      <p className="mb-2 text-xs font-semibold text-navy">{title}</p>
      <ul className="space-y-1 text-xs text-muted">
        {rows.map((row) => (
          <li key={row.status}>
            {row.status}: {row._count}
          </li>
        ))}
        {rows.length === 0 ? <li>—</li> : null}
      </ul>
    </div>
  );
}
