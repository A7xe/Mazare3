'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  AdminApiError,
  createAdminBreachIncident,
  fetchAdminBreachIncident,
  fetchAdminBreachIncidents,
  patchAdminBreachIncident,
  prepareAdminBreachAuthorityPack,
  type AdminBreachIncidentRow,
} from '@/lib/api-admin';

/**
 * Phase 3C.4B.1.2 — admin personal-data breach readiness console.
 * Admin-only; organisational least-privilege gap documented in API responses.
 */
export function AdminBreachIncidentsPanel() {
  const t = useTranslations('adminLegal');
  const tAdmin = useTranslations('admin');
  const [rows, setRows] = useState<AdminBreachIncidentRow[]>([]);
  const [selected, setSelected] = useState<AdminBreachIncidentRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('Synthetic availability outage (QA)');

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchAdminBreachIncidents();
      setRows(res.data);
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : tAdmin('loadError'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function createSynthetic(kind: 'security_incident_only' | 'personal_data_breach', opts?: {
    title: string;
    categories?: string[];
    financial?: boolean;
    kyc?: boolean;
  }) {
    setBusy(true);
    setError(null);
    try {
      await createAdminBreachIncident({
        title: opts?.title ?? title,
        incidentKind: kind,
        discoveredAt: new Date().toISOString(),
        discoverySource: 'synthetic_qa_fixture',
        affectedDataCategories: opts?.categories ?? [],
        involvesFinancialSensitiveData: opts?.financial ?? false,
        involvesKycData: opts?.kyc ?? false,
        sourceMechanismDescription: 'Synthetic QA fixture — not a real breach',
        internalNotes: 'QA only. Do not treat as Production incident.',
      });
      await load();
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : tAdmin('saveError'));
    } finally {
      setBusy(false);
    }
  }

  async function openDetail(id: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetchAdminBreachIncident(id);
      setSelected(res.data);
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : tAdmin('loadError'));
    } finally {
      setBusy(false);
    }
  }

  async function confirmSevereHarm(id: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await patchAdminBreachIncident(id, {
        severeHarmAssessment: 'severe_harm_likely',
        severeHarmReason: 'Authorised human assessment (admin console)',
        humanConfirmation: true,
      });
      setSelected(res.data);
      await load();
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : tAdmin('saveError'));
    } finally {
      setBusy(false);
    }
  }

  async function prepareAuthority(id: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await prepareAdminBreachAuthorityPack(id);
      setSelected(res.data);
      await load();
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : tAdmin('saveError'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3" data-testid="admin-legal-breach">
      <p className="text-sm text-muted">{t('breachSubtitle')}</p>
      <p className="text-xs text-amber-900" data-testid="admin-legal-breach-access-gap">
        {t('breachAccessGap')}
      </p>
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        <input
          className="min-w-[240px] flex-1 rounded-xl border border-border bg-surface px-3 py-2 text-sm"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          data-testid="admin-legal-breach-title"
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy}
          data-testid="admin-legal-breach-create-security-only"
          onClick={() =>
            void createSynthetic('security_incident_only', {
              title: title || 'Synthetic availability outage (no personal data)',
            })
          }
        >
          {t('breachCreateSecurityOnly')}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy}
          data-testid="admin-legal-breach-create-pdb"
          onClick={() =>
            void createSynthetic('personal_data_breach', {
              title: 'Synthetic exposed contacts (QA)',
              categories: ['identity_contact'],
            })
          }
        >
          {t('breachCreatePersonalData')}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy}
          data-testid="admin-legal-breach-create-kyc"
          onClick={() =>
            void createSynthetic('personal_data_breach', {
              title: 'Synthetic public KYC object (QA)',
              categories: ['kyc'],
              kyc: true,
            })
          }
        >
          {t('breachCreateKyc')}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy}
          data-testid="admin-legal-breach-create-iban"
          onClick={() =>
            void createSynthetic('personal_data_breach', {
              title: 'Synthetic IBAN export leak (QA)',
              categories: ['payout_iban', 'financial_sensitive'],
              financial: true,
            })
          }
        >
          {t('breachCreateFinancial')}
        </Button>
      </div>

      {loading ? (
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
      ) : rows.length === 0 ? (
        <Card className="rounded-2xl">
          <CardContent className="py-12 text-center text-muted">{t('breachEmpty')}</CardContent>
        </Card>
      ) : (
        rows.map((row) => (
          <Card key={row.id} className="rounded-2xl" data-testid={`admin-legal-breach-${row.id}`}>
            <CardContent className="space-y-2 py-4 text-sm">
              <p className="font-semibold text-navy">
                {row.title}
              </p>
              <p className="text-xs text-muted">
                {row.incidentKind} · {row.workflowStatus} · {row.severeHarmAssessment}
              </p>
              <p className="text-xs text-muted">
                {t('breachDiscoveredAt')}: {row.effectiveDiscoveryAt}
                {row.customerNotificationDueAt || row.dataSubjectNotificationDueAt
                  ? ` · ${t('breachCustomerDue')}: ${row.dataSubjectNotificationDueAt ?? row.customerNotificationDueAt} (${row.dataSubjectDeadlineUrgency ?? row.customerDeadlineUrgency})`
                  : ''}
                {row.authorityNotificationDueAt
                  ? ` · ${t('breachAuthorityDue')}: ${row.authorityNotificationDueAt} (${row.authorityDeadlineUrgency})`
                  : ''}
              </p>
              <p className="text-xs text-muted">
                {t('breachCustomerStatus')}: {row.customerNotificationStatus}
                {' · '}
                {t('breachAuthorityStatus')}: {row.authorityNotificationStatus}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => void openDetail(row.id)}>
                  {t('breachOpen')}
                </Button>
                {row.incidentKind === 'personal_data_breach' &&
                row.severeHarmAssessment !== 'severe_harm_likely' ? (
                  <Button
                    type="button"
                    size="sm"
                    data-testid={`admin-legal-breach-confirm-severe-${row.id}`}
                    disabled={busy}
                    onClick={() => void confirmSevereHarm(row.id)}
                  >
                    {t('breachConfirmSevere')}
                  </Button>
                ) : null}
                {row.customerNotificationRequired ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    data-testid={`admin-legal-breach-prep-authority-${row.id}`}
                    onClick={() => void prepareAuthority(row.id)}
                  >
                    {t('breachPrepAuthority')}
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>
        ))
      )}

      {selected ? (
        <Card className="rounded-2xl" data-testid="admin-legal-breach-detail">
          <CardContent className="space-y-2 py-4 text-sm">
            <p className="font-semibold text-navy">{selected.title}</p>
            <pre className="max-h-80 overflow-auto rounded-xl bg-muted/40 p-3 text-xs">
              {JSON.stringify(
                {
                  incidentKind: selected.incidentKind,
                  severeHarmAssessment: selected.severeHarmAssessment,
                  discoveredAt: selected.discoveredAt,
                  initiallyRecordedDiscoveryAt: selected.initiallyRecordedDiscoveryAt,
                  correctedDiscoveryAt: selected.correctedDiscoveryAt,
                  customerNotificationDueAt: selected.customerNotificationDueAt,
                  authorityNotificationDueAt: selected.authorityNotificationDueAt,
                  customerNotificationStatus: selected.customerNotificationStatus,
                  authorityNotificationStatus: selected.authorityNotificationStatus,
                  authorityPackStatus: selected.authorityPackJson?.statusEn ?? null,
                  authoritySubmittedAt: selected.authoritySubmittedAt,
                  emailProviderBlocker: selected.emailProviderBlocker,
                  involvesFinancialSensitiveData: selected.involvesFinancialSensitiveData,
                  involvesKycData: selected.involvesKycData,
                  affectedSubjectRefCount: selected.affectedSubjectRefCount,
                },
                null,
                2,
              )}
            </pre>
            <Button type="button" size="sm" variant="outline" onClick={() => setSelected(null)}>
              {t('breachCloseDetail')}
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
