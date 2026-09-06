'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { CalendarPlus, Loader2, Save } from 'lucide-react';
import { AVAILABILITY_PERIODS, type AvailabilityPeriod, type AvailabilityRuleInput } from '@mazare3/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  fetchOwnerAvailabilityHealth,
  fetchOwnerAvailabilityRules,
  generateOwnerAvailability,
  previewOwnerAvailabilityGenerate,
  putOwnerAvailabilityRules,
  OwnerApiError,
} from '@/lib/api-owner';

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const;

type DraftRule = {
  enabled: boolean;
  startTime: string;
  endTime: string;
  price: string;
};

function emptyDraft(): DraftRule {
  return { enabled: false, startTime: '', endTime: '', price: '' };
}

function keyOf(weekday: number, period: AvailabilityPeriod) {
  return `${weekday}-${period}`;
}

export function OwnerAvailabilitySchedule({
  propertyId,
  onGenerated,
  readOnly = false,
}: {
  propertyId: string;
  onGenerated: () => void;
  readOnly?: boolean;
}) {
  const t = useTranslations('owner');
  const [draft, setDraft] = useState<Record<string, DraftRule>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [genSummary, setGenSummary] = useState<string | null>(null);
  const [range, setRange] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rulesRes, healthRes] = await Promise.all([
        fetchOwnerAvailabilityRules(propertyId),
        fetchOwnerAvailabilityHealth(propertyId),
      ]);
      const next: Record<string, DraftRule> = {};
      for (const w of WEEKDAYS) {
        for (const p of AVAILABILITY_PERIODS) {
          next[keyOf(w, p)] = emptyDraft();
        }
      }
      for (const rule of rulesRes.data) {
        next[keyOf(rule.weekday, rule.period)] = {
          enabled: rule.enabled,
          startTime: rule.startTime,
          endTime: rule.endTime,
          price: String(rule.price),
        };
      }
      setDraft(next);
      const h = healthRes.data;
      setWarning(h.warning);
      if (h.earliestAvailableDate && h.latestAvailableDate) {
        setRange(`${h.earliestAvailableDate} → ${h.latestAvailableDate}`);
      } else {
        setRange(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t('loadError'));
    } finally {
      setLoading(false);
    }
  }, [propertyId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  function update(weekday: number, period: AvailabilityPeriod, patch: Partial<DraftRule>) {
    const k = keyOf(weekday, period);
    setDraft((prev) => ({ ...prev, [k]: { ...(prev[k] ?? emptyDraft()), ...patch } }));
  }

  async function saveRules() {
    if (readOnly) return;
    setSaving(true);
    setError(null);
    try {
      const rules: AvailabilityRuleInput[] = [];
      for (const w of WEEKDAYS) {
        for (const p of AVAILABILITY_PERIODS) {
          const row = draft[keyOf(w, p)] ?? emptyDraft();
          if (!row.enabled) continue;
          const price = Number(row.price);
          if (!row.startTime || !row.endTime || !Number.isFinite(price) || price < 0) {
            setError(t('scheduleInvalidTimes'));
            setSaving(false);
            return;
          }
          rules.push({
            weekday: w,
            period: p,
            enabled: true,
            startTime: row.startTime,
            endTime: row.endTime,
            price,
          });
        }
      }
      await putOwnerAvailabilityRules(propertyId, rules);
      await load();
    } catch (e) {
      setError(e instanceof OwnerApiError ? e.message : t('saveError'));
    } finally {
      setSaving(false);
    }
  }

  async function generate() {
    if (readOnly) return;
    setGenerating(true);
    setError(null);
    setGenSummary(null);
    try {
      const preview = await previewOwnerAvailabilityGenerate(propertyId);
      const result = await generateOwnerAvailability(propertyId);
      setGenSummary(
        t('generateResult', {
          created: result.data.created,
          existing: result.data.alreadyExisting,
          preview: preview.data.created,
        }),
      );
      setRange(`${result.data.from} → ${result.data.to}`);
      await load();
      onGenerated();
    } catch (e) {
      setError(e instanceof OwnerApiError ? e.message : t('saveError'));
    } finally {
      setGenerating(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card data-testid="owner-availability-schedule" className="glass-panel rounded-2xl border-primary/12">
      <CardHeader>
        <CardTitle className="text-lg text-navy">{t('weeklySchedule')}</CardTitle>
        <p className="text-sm text-muted">{t('weeklyScheduleHint')}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {readOnly ? (
          <p
            data-testid="owner-availability-schedule-frozen"
            className="rounded-xl border border-primary/20 bg-primary-soft/40 px-4 py-3 text-sm text-navy"
          >
            {t('pendingReviewAvailabilityFrozen')}
          </p>
        ) : null}
        {warning && (
          <p
            data-testid="owner-availability-warning"
            className="rounded-xl border border-amber-400/40 bg-amber-50 px-4 py-3 text-sm text-navy"
          >
            {t(`availabilityWarning.${warning}`)}
          </p>
        )}
        {range && (
          <p data-testid="owner-availability-range" className="text-sm text-muted">
            {t('generatedRange')}: {range}
          </p>
        )}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-start text-sm">
            <thead>
              <tr className="text-muted">
                <th className="p-2 font-medium">{t('weekdayLabel')}</th>
                <th className="p-2 font-medium">{t('periodLabel')}</th>
                <th className="p-2 font-medium">{t('enabled')}</th>
                <th className="p-2 font-medium">{t('startTime')}</th>
                <th className="p-2 font-medium">{t('endTime')}</th>
                <th className="p-2 font-medium">{t('price')}</th>
              </tr>
            </thead>
            <tbody>
              {WEEKDAYS.map((w) =>
                AVAILABILITY_PERIODS.map((p) => {
                  const row = draft[keyOf(w, p)] ?? emptyDraft();
                  return (
                    <tr key={keyOf(w, p)} className="border-t border-border/60">
                      <td className="p-2 text-navy">{t(`weekday.${w}`)}</td>
                      <td className="p-2 text-navy">{t(`period.${p}`)}</td>
                      <td className="p-2">
                        <input
                          type="checkbox"
                          data-testid={`owner-rule-${w}-${p}-enabled`}
                          checked={row.enabled}
                          onChange={(e) => update(w, p, { enabled: e.target.checked })}
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          type="time"
                          data-testid={`owner-rule-${w}-${p}-start`}
                          disabled={!row.enabled}
                          value={row.startTime}
                          onChange={(e) => update(w, p, { startTime: e.target.value })}
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          type="time"
                          data-testid={`owner-rule-${w}-${p}-end`}
                          disabled={!row.enabled}
                          value={row.endTime}
                          onChange={(e) => update(w, p, { endTime: e.target.value })}
                        />
                      </td>
                      <td className="p-2">
                        <Input
                          type="number"
                          min={0}
                          data-testid={`owner-rule-${w}-${p}-price`}
                          disabled={!row.enabled}
                          value={row.price}
                          onChange={(e) => update(w, p, { price: e.target.value })}
                        />
                      </td>
                    </tr>
                  );
                }),
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button data-testid="owner-schedule-save" disabled={saving || readOnly} onClick={() => void saveRules()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {t('saveSchedule')}
          </Button>
          <Button
            data-testid="owner-availability-generate"
            variant="outline"
            disabled={generating || readOnly}
            onClick={() => void generate()}
          >
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CalendarPlus className="h-4 w-4" />
            )}
            {t('generateHorizon')}
          </Button>
        </div>
        {genSummary && (
          <p data-testid="owner-generate-summary" className="text-sm text-navy">
            {genSummary}
          </p>
        )}
        {error && (
          <p className="rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
