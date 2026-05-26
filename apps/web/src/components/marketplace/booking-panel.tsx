'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { Calendar, ShieldCheck, Loader2, AlertCircle } from 'lucide-react';
import type { AvailabilityPeriod, PublicAvailabilitySlot, PublicPropertyDetail } from '@mazare3/shared';
import { AVAILABILITY_PERIODS } from '@mazare3/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { PriceDisplay } from './price-display';
import { TrustBadges } from './trust-badges';
import { fetchPropertyAvailability } from '@/lib/api-properties';
import {
  BookingApiError,
  clearBookingDraft,
  createBooking,
  loadBookingDraft,
  saveBookingDraft,
} from '@/lib/api-bookings';
import { getMe } from '@/lib/api-auth';

interface BookingPanelProps {
  property: PublicPropertyDetail;
  locale: 'ar' | 'en';
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function BookingPanel({ property, locale }: BookingPanelProps) {
  const t = useTranslations('property');
  const tCommon = useTranslations('common');
  const tHome = useTranslations('home');
  const router = useRouter();
  const pathname = usePathname();

  const [date, setDate] = useState('');
  const [period, setPeriod] = useState<AvailabilityPeriod | ''>('');
  const [guests, setGuests] = useState(Math.min(10, property.capacity));
  const [slots, setSlots] = useState<PublicAvailabilitySlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const minDate = todayIso();

  useEffect(() => {
    const draft = loadBookingDraft(property.slug);
    if (draft?.date) setDate(draft.date);
    if (draft?.period) setPeriod(draft.period as AvailabilityPeriod);
    if (draft?.guests) setGuests(Math.min(draft.guests, property.capacity));
  }, [property.slug, property.capacity]);

  useEffect(() => {
    if (!date && !period) return;
    saveBookingDraft(property.slug, {
      date,
      period,
      guests,
    });
  }, [property.slug, date, period, guests]);

  const loadSlots = useCallback(async (selectedDate: string) => {
    if (!selectedDate) return;
    setLoadingSlots(true);
    setError(null);
    try {
      const to = addDays(selectedDate, 14);
      const data = await fetchPropertyAvailability(property.slug, selectedDate, to);
      setSlots(data);
    } catch {
      setError(t('availabilityError'));
      setSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  }, [property.slug, t]);

  useEffect(() => {
    if (date) void loadSlots(date);
  }, [date, loadSlots]);

  const slotsForDate = useMemo(
    () => slots.filter((s) => s.date === date),
    [slots, date],
  );

  const selectedSlot = useMemo(
    () => slotsForDate.find((s) => s.period === period && s.status === 'available'),
    [slotsForDate, period],
  );

  const availablePeriods = useMemo(() => {
    const set = new Set(
      slotsForDate.filter((s) => s.status === 'available').map((s) => s.period),
    );
    return AVAILABILITY_PERIODS.filter((p) => {
      if (p === 'overnight' && !property.allowsOvernight) return false;
      return set.has(p);
    });
  }, [slotsForDate, property.allowsOvernight]);

  async function handleBook() {
    setError(null);
    if (!date || !period || !selectedSlot) {
      setError(t('selectSlotError'));
      return;
    }

    try {
      const me = await getMe();
      if (me.data.user.role !== 'customer') {
        setError(t('customerOnlyError'));
        return;
      }
    } catch {
      const returnUrl = encodeURIComponent(pathname);
      router.push(`/login?returnUrl=${returnUrl}`);
      return;
    }

    setBooking(true);
    try {
      const res = await createBooking({
        propertySlug: property.slug,
        date,
        period: period as AvailabilityPeriod,
        guestsCount: guests,
      });
      clearBookingDraft(property.slug);
      router.push(`/checkout/${res.data.id}`);
    } catch (err) {
      if (err instanceof BookingApiError && err.code === 'SLOT_UNAVAILABLE') {
        if (date) await loadSlots(date);
        setError(t('slotUnavailable'));
        setPeriod('');
      } else {
        setError(err instanceof Error ? err.message : t('bookingError'));
      }
    } finally {
      setBooking(false);
    }
  }

  const title = locale === 'ar' ? property.titleAr : property.titleEn;
  const displayPrice = selectedSlot?.price ?? property.basePrice;

  return (
    <Card
      data-testid="booking-panel"
      className="glass-panel overflow-hidden rounded-3xl border-primary/12 lg:sticky lg:top-24"
    >
      <div className="gradient-primary h-1" />
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle>{t('bookingPanelTitle')}</CardTitle>
          <Badge variant="highlight" className="shrink-0 gap-1">
            <ShieldCheck className="h-3 w-3" />
            {tHome('trustBooking')}
          </Badge>
        </div>
        <PriceDisplay
          amount={displayPrice}
          currency={selectedSlot?.currency ?? property.currency}
          locale={locale}
          fromLabel={selectedSlot ? '' : tCommon('from')}
          perDayLabel={tCommon('perDay')}
          large
        />
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="mb-2 flex items-center gap-2 text-sm font-medium text-navy">
            <Calendar className="h-4 w-4 text-primary" />
            {t('selectDate')}
          </label>
          <Input
            data-testid="booking-date"
            type="date"
            min={minDate}
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              setPeriod('');
            }}
            onBlur={(e) => {
              const v = e.target.value;
              if (v && v !== date) {
                setDate(v);
                setPeriod('');
              }
            }}
          />
        </div>

        {date && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-navy">{t('selectPeriod')}</p>
            {loadingSlots ? (
              <p className="flex items-center gap-2 text-sm text-muted">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t('loadingAvailability')}
              </p>
            ) : availablePeriods.length === 0 ? (
              <p className="text-sm text-muted">{t('noSlotsForDate')}</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {availablePeriods.map((p) => {
                  const slot = slotsForDate.find((s) => s.period === p && s.status === 'available');
                  return (
                    <button
                      key={p}
                      type="button"
                      data-testid={`booking-period-${p}`}
                      aria-pressed={period === p}
                      onClick={() => setPeriod(p)}
                      className={`rounded-xl border px-3 py-2 text-start text-sm transition-colors ${
                        period === p
                          ? 'border-primary bg-primary-soft text-navy'
                          : 'border-border bg-surface hover:border-primary/40'
                      }`}
                    >
                      <span className="font-medium">{t(`period.${p}`)}</span>
                      {slot && (
                        <span className="mt-0.5 block text-xs text-muted">
                          {slot.price} {slot.currency}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div className="space-y-2">
          <label htmlFor="guests" className="text-sm font-medium text-navy">
            {t('guestsCount')}
          </label>
          <Input
            id="guests"
            data-testid="booking-guests"
            type="number"
            min={1}
            max={property.capacity}
            value={guests}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (!Number.isNaN(n) && n >= 1) setGuests(Math.min(n, property.capacity));
            }}
          />
        </div>

        {date && period && selectedSlot && (
          <div className="rounded-2xl border border-border bg-primary-soft/30 p-4 text-sm text-navy">
            <p className="font-semibold">{t('bookingSummary')}</p>
            <ul className="mt-2 space-y-1 text-muted">
              <li>
                <span className="text-navy">{t('summaryProperty')}:</span> {title}
              </li>
              <li>
                <span className="text-navy">{t('summaryDate')}:</span> {date}
              </li>
              <li>
                <span className="text-navy">{t('summaryPeriod')}:</span> {t(`period.${period}`)}
              </li>
              <li>
                <span className="text-navy">{t('summaryGuests')}:</span> {guests}
              </li>
              <li>
                <span className="text-navy">{t('summaryPrice')}:</span> {selectedSlot.price}{' '}
                {selectedSlot.currency}
              </li>
            </ul>
            <p className="mt-3 rounded-lg border border-primary/15 bg-surface/80 px-3 py-2 text-xs leading-relaxed text-muted">
              {t('paymentAtCheckout')}
            </p>
          </div>
        )}

        {error && (
          <p
            data-testid="booking-error"
            className="flex items-start gap-2 rounded-xl border border-danger/20 bg-danger/10 px-3 py-2 text-sm text-danger"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </p>
        )}

        <Button
          data-testid="booking-submit"
          className="w-full shadow-soft"
          size="lg"
          disabled={booking || !date || !period || !selectedSlot}
          onClick={() => void handleBook()}
        >
          {booking ? (
            <>
              <Loader2 className="me-2 h-4 w-4 animate-spin" />
              {t('bookingInProgress')}
            </>
          ) : (
            tCommon('bookNow')
          )}
        </Button>

        <p className="text-center text-xs leading-relaxed text-muted">{t('bookingPanelNote')}</p>
        <div className="border-t border-border pt-4">
          <TrustBadges showSupport compact />
        </div>
      </CardContent>
    </Card>
  );
}
