'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AdminApiError,
  approveAdminExtraReschedule,
  classifyAdminForceMajeure,
  confirmAdminIncidentNoShow,
  confirmAdminIncidentOwnerFault,
  fetchAdminCommercialTermsAudit,
  fetchAdminMarketplaceIncidents,
  fetchAdminOwnerAdjustments,
  rejectAdminIncident,
  waiveAdminOwnerAdjustment,
  type AdminBookingIncidentRow,
  type AdminCommercialTermsAuditRow,
  type AdminOwnerAdjustmentRow,
} from '@/lib/api-admin';

const EXPECTED_STANDARD = 18;
const EXPECTED_VERIFIED = 15;

function incidentFinancialConsequences(
  t: ReturnType<typeof useTranslations<'admin'>>,
  type: string,
): string {
  if (type === 'customer_no_show_report') {
    return t('marketplaceFairness.consequenceCustomerNoShow');
  }
  if (
    type === 'owner_no_show_report' ||
    type === 'access_denied_report' ||
    type === 'property_unavailable_report'
  ) {
    return t('marketplaceFairness.consequenceOwnerFault');
  }
  return t('marketplaceFairness.consequenceGeneric');
}

export function AdminMarketplaceFairnessView() {
  const t = useTranslations('admin');
  const [incidents, setIncidents] = useState<AdminBookingIncidentRow[]>([]);
  const [adjustments, setAdjustments] = useState<AdminOwnerAdjustmentRow[]>([]);
  const [auditRows, setAuditRows] = useState<AdminCommercialTermsAuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [waiveReason, setWaiveReason] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmIncidentId, setConfirmIncidentId] = useState<string | null>(null);

  const [fmBookingId, setFmBookingId] = useState('');
  const [fmOutcome, setFmOutcome] = useState<
    'confirm_awaiting_customer' | 'full_refund' | 'approve_reschedule'
  >('confirm_awaiting_customer');
  const [fmReason, setFmReason] = useState('');
  const [fmToSlotId, setFmToSlotId] = useState('');
  const [fmVoluntaryUpgrade, setFmVoluntaryUpgrade] = useState(false);
  const [fmEvidence, setFmEvidence] = useState('');

  const fmIncidentForBooking = incidents.find(
    (i) =>
      i.bookingId === fmBookingId.trim() &&
      i.type === 'force_majeure' &&
      (i.status === 'confirmed' || i.status === 'under_review' || i.status === 'open'),
  );
  const fmCustomerChoice = fmIncidentForBooking?.customerResolutionChoice ?? null;
  const fmRescheduleAllowed = fmCustomerChoice === 'EQUIVALENT_RESCHEDULE';
  const fmChoiceLabel = !fmCustomerChoice
    ? t('marketplaceFairness.fmCustomerChoiceNone')
    : fmCustomerChoice === 'FULL_REFUND'
      ? t('marketplaceFairness.fmCustomerChoiceRefund')
      : t('marketplaceFairness.fmCustomerChoiceReschedule');

  const [extraBookingId, setExtraBookingId] = useState('');
  const [extraReason, setExtraReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [incRes, adjRes, auditRes] = await Promise.all([
        fetchAdminMarketplaceIncidents(),
        fetchAdminOwnerAdjustments(),
        fetchAdminCommercialTermsAudit().catch(() => ({ data: [] as AdminCommercialTermsAuditRow[] })),
      ]);
      setIncidents(incRes.data);
      setAdjustments(adjRes.data);
      setAuditRows(auditRes.data);
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : t('loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function runIncidentAction(
    incidentId: string,
    action: 'confirm-no-show' | 'confirm-owner-fault' | 'reject',
  ) {
    if (action !== 'reject' && confirmIncidentId !== incidentId) {
      setConfirmIncidentId(incidentId);
      return;
    }
    setBusy(incidentId);
    setError(null);
    try {
      const note = notes[incidentId]?.trim();
      if (action === 'confirm-no-show') await confirmAdminIncidentNoShow(incidentId, note);
      else if (action === 'confirm-owner-fault') {
        await confirmAdminIncidentOwnerFault(incidentId, note);
      } else {
        if (!note || note.length < 3) {
          setError(t('marketplaceFairness.rejectNoteRequired'));
          return;
        }
        await rejectAdminIncident(incidentId, note);
      }
      setConfirmIncidentId(null);
      await load();
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : t('saveError'));
    } finally {
      setBusy(null);
    }
  }

  async function handleWaive(adjustmentId: string) {
    const reason = waiveReason[adjustmentId]?.trim();
    if (!reason || reason.length < 10) {
      setError(t('marketplaceFairness.waiveReasonMin'));
      return;
    }
    setBusy(`waive-${adjustmentId}`);
    setError(null);
    try {
      await waiveAdminOwnerAdjustment(adjustmentId, reason);
      await load();
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : t('saveError'));
    } finally {
      setBusy(null);
    }
  }

  async function handleForceMajeure() {
    const reason = fmReason.trim();
    if (!fmBookingId.trim()) {
      setError(t('marketplaceFairness.fmBookingRequired'));
      return;
    }
    if (reason.length < 10) {
      setError(t('marketplaceFairness.fmReasonMin'));
      return;
    }
    if (fmOutcome === 'approve_reschedule' && !fmRescheduleAllowed) {
      setError(t('marketplaceFairness.fmRescheduleBlocked'));
      return;
    }
    setBusy('force-majeure');
    setError(null);
    try {
      await classifyAdminForceMajeure({
        bookingId: fmBookingId.trim(),
        outcome: fmOutcome,
        reason,
        evidenceText: fmEvidence.trim() || undefined,
        toSlotId: fmToSlotId.trim() || undefined,
        voluntaryUpgrade: fmVoluntaryUpgrade || undefined,
        incidentId: fmIncidentForBooking?.id,
      });
      setFmBookingId('');
      setFmReason('');
      setFmToSlotId('');
      setFmEvidence('');
      setFmVoluntaryUpgrade(false);
      setFmOutcome('confirm_awaiting_customer');
      await load();
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : t('saveError'));
    } finally {
      setBusy(null);
    }
  }

  async function handleApproveExtra() {
    const reason = extraReason.trim();
    if (!extraBookingId.trim()) {
      setError(t('marketplaceFairness.extraBookingRequired'));
      return;
    }
    if (reason.length < 10) {
      setError(t('marketplaceFairness.extraReasonMin'));
      return;
    }
    setBusy('extra-reschedule');
    setError(null);
    try {
      await approveAdminExtraReschedule(extraBookingId.trim(), reason);
      setExtraBookingId('');
      setExtraReason('');
      await load();
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : t('saveError'));
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return (
      <div data-testid="admin-marketplace-fairness" className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div data-testid="admin-marketplace-fairness" className="space-y-6">
      <p className="text-sm text-muted">{t('marketplaceFairness.subtitle')}</p>
      {error && (
        <p className="rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-navy">{t('marketplaceFairness.forceMajeureTitle')}</h2>
        <Card className="glass-panel rounded-2xl border-primary/12">
          <CardContent className="space-y-3 p-4">
            <Input
              placeholder={t('marketplaceFairness.fmBookingIdPlaceholder')}
              value={fmBookingId}
              onChange={(e) => setFmBookingId(e.target.value)}
              data-testid="admin-fm-booking-id"
            />
            <select
              className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm"
              value={fmOutcome}
              onChange={(e) =>
                setFmOutcome(
                  e.target.value as
                    | 'confirm_awaiting_customer'
                    | 'full_refund'
                    | 'approve_reschedule',
                )
              }
              data-testid="admin-fm-outcome"
            >
              <option value="confirm_awaiting_customer">
                {t('marketplaceFairness.fmOutcomeConfirm')}
              </option>
              <option value="full_refund">{t('marketplaceFairness.fmOutcomeRefund')}</option>
              <option value="approve_reschedule" disabled={!fmRescheduleAllowed}>
                {t('marketplaceFairness.fmOutcomeReschedule')}
              </option>
            </select>
            {fmBookingId.trim() ? (
              <p className="text-xs text-muted" data-testid="admin-fm-customer-choice">
                {t('marketplaceFairness.fmCustomerChoiceLabel')}: {fmChoiceLabel}
              </p>
            ) : null}
            {fmOutcome === 'approve_reschedule' && !fmRescheduleAllowed ? (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-navy" data-testid="admin-fm-reschedule-blocked">
                {t('marketplaceFairness.fmRescheduleBlocked')}
              </p>
            ) : null}
            {fmOutcome === 'approve_reschedule' && (
              <>
                <Input
                  placeholder={t('marketplaceFairness.fmToSlotPlaceholder')}
                  value={fmToSlotId}
                  onChange={(e) => setFmToSlotId(e.target.value)}
                  data-testid="admin-fm-to-slot"
                />
                <label className="flex items-center gap-2 text-sm text-navy">
                  <input
                    type="checkbox"
                    checked={fmVoluntaryUpgrade}
                    onChange={(e) => setFmVoluntaryUpgrade(e.target.checked)}
                    data-testid="admin-fm-voluntary-upgrade"
                  />
                  {t('marketplaceFairness.fmVoluntaryUpgrade')}
                </label>
              </>
            )}
            <Input
              placeholder={t('marketplaceFairness.fmReasonPlaceholder')}
              value={fmReason}
              onChange={(e) => setFmReason(e.target.value)}
              data-testid="admin-fm-reason"
            />
            <Input
              placeholder={t('marketplaceFairness.fmEvidencePlaceholder')}
              value={fmEvidence}
              onChange={(e) => setFmEvidence(e.target.value)}
            />
            <Button
              size="sm"
              disabled={
                busy === 'force-majeure' ||
                (fmOutcome === 'approve_reschedule' && !fmRescheduleAllowed)
              }
              data-testid="admin-fm-submit"
              onClick={() => void handleForceMajeure()}
            >
              {t('marketplaceFairness.fmSubmit')}
            </Button>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-navy">
          {t('marketplaceFairness.extraRescheduleTitle')}
        </h2>
        <Card className="glass-panel rounded-2xl border-primary/12">
          <CardContent className="space-y-3 p-4">
            <p className="text-xs text-muted">{t('marketplaceFairness.extraRescheduleHint')}</p>
            <Input
              placeholder={t('marketplaceFairness.extraBookingIdPlaceholder')}
              value={extraBookingId}
              onChange={(e) => setExtraBookingId(e.target.value)}
              data-testid="admin-extra-booking-id"
            />
            <Input
              placeholder={t('marketplaceFairness.extraReasonPlaceholder')}
              value={extraReason}
              onChange={(e) => setExtraReason(e.target.value)}
              data-testid="admin-extra-reason"
            />
            <Button
              size="sm"
              disabled={busy === 'extra-reschedule'}
              data-testid="admin-extra-submit"
              onClick={() => void handleApproveExtra()}
            >
              {t('marketplaceFairness.extraSubmit')}
            </Button>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-navy">{t('marketplaceFairness.incidentsTitle')}</h2>
        {incidents.length === 0 ? (
          <Card className="glass-panel rounded-2xl border-primary/12">
            <CardContent className="py-12 text-center text-muted">
              {t('marketplaceFairness.incidentsEmpty')}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {incidents.map((inc) => {
              const actionable = inc.status === 'open' || inc.status === 'under_review';
              const awaitingConfirm = confirmIncidentId === inc.id;
              return (
                <Card key={inc.id} className="glass-panel rounded-2xl border-primary/12">
                  <CardContent className="space-y-3 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-mono font-semibold text-navy">{inc.booking.publicCode}</p>
                        <p className="text-sm text-muted">
                          {t(`marketplaceFairness.incidentType.${inc.type}` as never)} ·{' '}
                          {inc.openedBy.email ?? inc.openedBy.name ?? '—'}
                        </p>
                      </div>
                      <Badge variant={actionable ? 'highlight' : 'muted'}>{inc.status}</Badge>
                    </div>
                    {inc.evidenceText && (
                      <p className="text-sm text-muted">{inc.evidenceText}</p>
                    )}
                    {inc.type === 'force_majeure' ? (
                      <p className="text-xs text-muted" data-testid={`admin-fm-choice-${inc.id}`}>
                        {t('marketplaceFairness.fmCustomerChoiceLabel')}:{' '}
                        {!inc.customerResolutionChoice
                          ? t('marketplaceFairness.fmCustomerChoiceNone')
                          : inc.customerResolutionChoice === 'FULL_REFUND'
                            ? t('marketplaceFairness.fmCustomerChoiceRefund')
                            : t('marketplaceFairness.fmCustomerChoiceReschedule')}
                      </p>
                    ) : null}
                    {actionable && (
                      <>
                        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-navy">
                          {t('marketplaceFairness.financialConsequences')}:{' '}
                          {incidentFinancialConsequences(t, inc.type)}
                        </p>
                        <Input
                          placeholder={t('marketplaceFairness.adminNotePlaceholder')}
                          value={notes[inc.id] ?? ''}
                          onChange={(e) => setNotes((n) => ({ ...n, [inc.id]: e.target.value }))}
                        />
                        {awaitingConfirm && (
                          <p className="text-xs font-medium text-danger">
                            {t('marketplaceFairness.confirmConsequencesPrompt')}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-2">
                          {inc.type === 'customer_no_show_report' && (
                            <Button
                              size="sm"
                              disabled={busy === inc.id}
                              onClick={() => void runIncidentAction(inc.id, 'confirm-no-show')}
                            >
                              {awaitingConfirm
                                ? t('marketplaceFairness.confirmNoShowAgain')
                                : t('marketplaceFairness.confirmNoShow')}
                            </Button>
                          )}
                          {(inc.type === 'owner_no_show_report' ||
                            inc.type === 'access_denied_report' ||
                            inc.type === 'property_unavailable_report') && (
                            <Button
                              size="sm"
                              disabled={busy === inc.id}
                              onClick={() => void runIncidentAction(inc.id, 'confirm-owner-fault')}
                            >
                              {awaitingConfirm
                                ? t('marketplaceFairness.confirmOwnerFaultAgain')
                                : t('marketplaceFairness.confirmOwnerFault')}
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy === inc.id}
                            onClick={() => {
                              setConfirmIncidentId(null);
                              void runIncidentAction(inc.id, 'reject');
                            }}
                          >
                            {t('marketplaceFairness.rejectIncident')}
                          </Button>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-navy">{t('marketplaceFairness.adjustmentsTitle')}</h2>
        {adjustments.length === 0 ? (
          <Card className="glass-panel rounded-2xl border-primary/12">
            <CardContent className="py-12 text-center text-muted">
              {t('marketplaceFairness.adjustmentsEmpty')}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {adjustments.map((adj) => (
              <Card key={adj.id} className="glass-panel rounded-2xl border-primary/12">
                <CardContent className="space-y-3 p-4">
                  <div className="flex flex-wrap justify-between gap-2">
                    <div>
                      <p className="font-semibold text-navy">{adj.owner.displayName}</p>
                      <p className="text-sm text-muted">
                        {adj.booking?.publicCode ?? '—'} · {adj.type} · {adj.amountJod} JOD
                      </p>
                    </div>
                    <Badge variant="muted">{adj.status}</Badge>
                  </div>
                  {adj.status !== 'waived' && adj.status !== 'applied' && (
                    <>
                      <Input
                        placeholder={t('marketplaceFairness.waiveReasonPlaceholder')}
                        value={waiveReason[adj.id] ?? ''}
                        onChange={(e) =>
                          setWaiveReason((r) => ({ ...r, [adj.id]: e.target.value }))
                        }
                        required
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy === `waive-${adj.id}`}
                        onClick={() => void handleWaive(adj.id)}
                      >
                        {t('marketplaceFairness.waivePenalty')}
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-navy">
          {t('marketplaceFairness.commercialAuditTitle')}
        </h2>
        <p className="text-xs text-muted">{t('marketplaceFairness.commercialAuditHint')}</p>
        <p className="text-xs text-muted">
          {t('marketplaceFairness.expectedRates', {
            standard: EXPECTED_STANDARD,
            verified: EXPECTED_VERIFIED,
          })}
        </p>
        {auditRows.length === 0 ? (
          <Card className="glass-panel rounded-2xl border-primary/12">
            <CardContent className="py-12 text-center text-muted">
              {t('marketplaceFairness.commercialAuditEmpty')}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {auditRows.map((row) => {
              const obsolete12 = row.commissionPercent === 12 || row.note.includes('12%');
              const custom =
                row.customOverride === true ||
                (row.commissionPercent !== EXPECTED_STANDARD &&
                  row.commissionPercent !== EXPECTED_VERIFIED);
              return (
                <Card key={row.id} className="glass-panel rounded-2xl border-primary/12">
                  <CardContent className="space-y-2 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-navy">
                          {t('marketplaceFairness.auditOwner')}: {row.ownerProfileId}
                        </p>
                        <p className="text-sm text-muted">
                          {t('marketplaceFairness.auditProperty')}: {row.propertyId ?? '—'}
                        </p>
                      </div>
                      <Badge variant={obsolete12 ? 'highlight' : 'muted'}>{row.status}</Badge>
                    </div>
                    <p className="text-sm text-navy">
                      {t('marketplaceFairness.auditCommission')}: {row.commissionPercent}%
                      {custom ? ` · ${t('marketplaceFairness.auditCustomOverride')}` : ''}
                    </p>
                    {row.source && (
                      <p className="text-xs text-muted">
                        {t('marketplaceFairness.auditSource')}: {row.source}
                      </p>
                    )}
                    {(row.effectiveFrom || row.effectiveTo) && (
                      <p className="text-xs text-muted">
                        {t('marketplaceFairness.auditEffective')}: {row.effectiveFrom ?? '—'} →{' '}
                        {row.effectiveTo ?? '—'}
                      </p>
                    )}
                    <p className="text-xs text-muted">{row.note}</p>
                    {obsolete12 && (
                      <p className="rounded-lg bg-danger/10 px-3 py-2 text-xs font-medium text-danger">
                        {t('marketplaceFairness.obsolete12Warning')}
                      </p>
                    )}
                    {row.history && row.history.length > 0 && (
                      <ul className="space-y-1 border-t border-primary/10 pt-2 text-xs text-muted">
                        {row.history.map((h, i) => (
                          <li key={`${row.id}-h-${i}`}>
                            {h.at}: {h.note}
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
