'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useRouter } from '@/i18n/navigation';
import { Loader2, Lock, LockOpen, Save } from 'lucide-react';
import type { OwnerAvailabilitySlotRow, OwnerPropertyCard } from '@mazare3/shared';
import { AVAILABILITY_PERIODS, isOwnerReviewContentMutableStatus } from '@mazare3/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  fetchOwnerAvailability,
  fetchOwnerProperties,
  patchOwnerAvailabilitySlot,
  OwnerApiError,
} from '@/lib/api-owner';
import { OwnerAvailabilitySchedule } from '@/components/owner/owner-availability-schedule';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function OwnerAvailabilityView() {
  const t = useTranslations('owner');
  const locale = useLocale() as 'ar' | 'en';
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialPropertyId = searchParams.get('propertyId') ?? '';

  const [properties, setProperties] = useState<OwnerPropertyCard[]>([]);
  const [propertyId, setPropertyId] = useState(initialPropertyId);
  const [from, setFrom] = useState(todayIso());
  const [to, setTo] = useState(addDays(todayIso(), 14));
  const [slots, setSlots] = useState<OwnerAvailabilitySlotRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [priceEdits, setPriceEdits] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetchOwnerProperties();
        setProperties(res.data);
        if (!propertyId && res.data[0]) {
          setPropertyId(res.data[0].id);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : t('loadError'));
      } finally {
        setLoading(false);
      }
    })();
  }, [propertyId, t]);

  const loadSlots = useCallback(async () => {
    if (!propertyId || !from || !to) return;
    setLoadingSlots(true);
    setError(null);
    try {
      const res = await fetchOwnerAvailability(propertyId, from, to);
      setSlots(res.data);
      const edits: Record<string, string> = {};
      for (const s of res.data) {
        edits[s.id] = String(s.price);
      }
      setPriceEdits(edits);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('loadError'));
      setSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  }, [propertyId, from, to, t]);

  useEffect(() => {
    if (propertyId) void loadSlots();
  }, [propertyId, from, to, loadSlots]);

  useEffect(() => {
    if (propertyId) {
      router.replace(`/owner/availability?propertyId=${propertyId}`);
    }
  }, [propertyId, router]);

  const slotsByDate = useMemo(() => {
    const map = new Map<string, OwnerAvailabilitySlotRow[]>();
    for (const s of slots) {
      const list = map.get(s.date) ?? [];
      list.push(s);
      map.set(s.date, list);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [slots]);

  async function toggleBlock(slot: OwnerAvailabilitySlotRow) {
    const selected = properties.find((p) => p.id === propertyId);
    if (!isOwnerReviewContentMutableStatus(selected?.status)) {
      setError(t('pendingReviewAvailabilityFrozen'));
      return;
    }
    if (slot.hasActiveBooking || slot.status === 'booked') {
      setError(t('slotBookedError'));
      return;
    }
    setSavingId(slot.id);
    setError(null);
    try {
      const nextStatus = slot.status === 'blocked' ? 'available' : 'blocked';
      await patchOwnerAvailabilitySlot(slot.id, { status: nextStatus });
      await loadSlots();
    } catch (e) {
      if (e instanceof OwnerApiError && e.code === 'SLOT_HAS_ACTIVE_BOOKING') {
        setError(t('slotBookedError'));
      } else {
        setError(e instanceof Error ? e.message : t('saveError'));
      }
    } finally {
      setSavingId(null);
    }
  }

  async function savePrice(slot: OwnerAvailabilitySlotRow) {
    const selected = properties.find((p) => p.id === propertyId);
    if (!isOwnerReviewContentMutableStatus(selected?.status)) {
      setError(t('pendingReviewAvailabilityFrozen'));
      return;
    }
    if (slot.hasActiveBooking || slot.status === 'booked') {
      setError(t('slotBookedError'));
      return;
    }
    const raw = priceEdits[slot.id];
    const price = Number(raw);
    if (!Number.isFinite(price) || price <= 0) {
      setError(t('invalidPrice'));
      return;
    }
    setSavingId(slot.id);
    setError(null);
    try {
      await patchOwnerAvailabilitySlot(slot.id, { price });
      await loadSlots();
    } catch (e) {
      if (e instanceof OwnerApiError && e.code === 'SLOT_HAS_ACTIVE_BOOKING') {
        setError(t('slotBookedError'));
      } else {
        setError(e instanceof Error ? e.message : t('saveError'));
      }
    } finally {
      setSavingId(null);
    }
  }

  if (loading) {
    return (
      <div data-testid="owner-availability" className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (properties.length === 0) {
    return (
      <Card className="glass-panel rounded-3xl border-primary/12">
        <CardContent className="py-16 text-center text-muted">{t('propertiesEmpty')}</CardContent>
      </Card>
    );
  }

  const selectedProperty = properties.find((p) => p.id === propertyId);
  const propertyTitle =
    selectedProperty &&
    (locale === 'ar' ? selectedProperty.titleAr : selectedProperty.titleEn);
  const availabilityMutable = isOwnerReviewContentMutableStatus(selectedProperty?.status);

  return (
    <div data-testid="owner-availability" className="space-y-6">
      <Card className="glass-panel rounded-2xl border-primary/12">
        <CardHeader>
          <CardTitle className="text-lg text-navy">{t('availabilityFilters')}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2 sm:col-span-2">
            <label className="text-sm font-medium text-navy">{t('selectProperty')}</label>
            <select
              data-testid="owner-availability-property"
              className="flex h-11 w-full rounded-xl border border-border bg-surface px-4 text-sm"
              value={propertyId}
              onChange={(e) => setPropertyId(e.target.value)}
            >
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {locale === 'ar' ? p.titleAr : p.titleEn}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-navy">{t('fromDate')}</label>
            <Input type="date" value={from} min={todayIso()} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-navy">{t('toDate')}</label>
            <Input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {propertyTitle && (
        <p className="text-sm text-muted">
          {t('managingFor')}: <span className="font-medium text-navy">{propertyTitle}</span>
        </p>
      )}

      {propertyId && (
        <OwnerAvailabilitySchedule
          propertyId={propertyId}
          onGenerated={() => void loadSlots()}
          readOnly={!availabilityMutable}
        />
      )}

      {error && (
        <p
          data-testid="owner-availability-error"
          className="rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger"
        >
          {error}
        </p>
      )}

      {loadingSlots ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : slotsByDate.length === 0 ? (
        <Card className="glass-panel rounded-3xl border-primary/12">
          <CardContent className="py-12 text-center text-muted">{t('availabilityEmpty')}</CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {slotsByDate.map(([date, daySlots]) => (
            <Card key={date} className="glass-panel overflow-hidden rounded-2xl border-primary/12">
              <div className="gradient-primary h-1" />
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-navy">{date}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2">
                  {AVAILABILITY_PERIODS.map((period) => {
                    const slot = daySlots.find((s) => s.period === period);
                    if (!slot) return null;
                    const locked =
                      slot.hasActiveBooking ||
                      slot.status === 'booked' ||
                      !availabilityMutable;
                    return (
                      <div
                        key={slot.id}
                        className="rounded-xl border border-border bg-surface/80 p-4"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-navy">{t(`period.${period}`)}</span>
                          <Badge
                            variant={
                              slot.status === 'available'
                                ? 'highlight'
                                : slot.status === 'blocked'
                                  ? 'muted'
                                  : 'default'
                            }
                          >
                            {t(`slotStatus.${slot.status}`)}
                          </Badge>
                        </div>
                        {(slot.startAtLocal || slot.endAtLocal) && (
                          <p
                            data-testid={`owner-slot-times-${slot.id}`}
                            className="mt-2 text-xs text-muted"
                          >
                            {slot.startAtLocal} – {slot.endAtLocal} ({slot.timeZone})
                          </p>
                        )}
                        <p className="mt-1 text-xs text-muted" data-testid={`owner-slot-source-${slot.id}`}>
                          {t(`slotSource.${slot.source}`)}
                          {slot.priceOverridden ? ` · ${t('manualPrice')}` : ''}
                          {slot.usesLegacyTiming ? ` · ${t('legacyTiming')}` : ''}
                        </p>
                        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
                          <div className="w-full min-w-0 flex-1 sm:min-w-[100px]">
                            <label className="text-xs text-muted">{t('price')}</label>
                            <Input
                              type="number"
                              min={1}
                              data-testid={`owner-slot-price-${slot.id}`}
                              disabled={locked || savingId === slot.id}
                              value={priceEdits[slot.id] ?? String(slot.price)}
                              onChange={(e) =>
                                setPriceEdits((prev) => ({
                                  ...prev,
                                  [slot.id]: e.target.value,
                                }))
                              }
                            />
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={locked || savingId === slot.id}
                            data-testid={`owner-slot-save-${slot.id}`}
                            onClick={() => void savePrice(slot)}
                          >
                            <Save className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant={slot.status === 'blocked' ? 'default' : 'outline'}
                            disabled={locked || savingId === slot.id}
                            data-testid={`owner-slot-toggle-${slot.id}`}
                            onClick={() => void toggleBlock(slot)}
                            className="w-full gap-1 sm:w-auto"
                          >
                            {slot.status === 'blocked' ? (
                              <>
                                <LockOpen className="h-4 w-4" />
                                {t('unblock')}
                              </>
                            ) : (
                              <>
                                <Lock className="h-4 w-4" />
                                {t('block')}
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
