'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronLeft, ChevronRight, Loader2, X } from 'lucide-react';
import type { PublicAvailabilitySlot } from '@mazare3/shared';
import { fetchPropertyAvailability } from '@/lib/api-properties';
import {
  BOOKING_CALENDAR_TIME_ZONE,
  buildMonthGrid,
  compareMonthKeys,
  currentMonthKey,
  formatMonthTitle,
  formatSelectedDateLabel,
  maxMonthKey,
  monthKeyFromIso,
  monthRangeForFetch,
  shiftMonthKey,
  weekdayLabels,
  type CalendarDayState,
} from '@/lib/booking-calendar';
import { todayIsoInPlatformZone } from '@/lib/format-platform-time';

type Props = {
  propertySlug: string;
  locale: 'ar' | 'en';
  selectedDate: string;
  onSelectDate: (iso: string) => void;
  onMonthSlots: (slots: PublicAvailabilitySlot[], monthKey: string) => void;
  onLoadingChange?: (loading: boolean) => void;
  /** Bump to clear month cache and refetch (e.g. after SLOT_UNAVAILABLE). */
  refreshEpoch?: number;
};

function stateLabel(
  state: CalendarDayState,
  t: ReturnType<typeof useTranslations<'property'>>,
): string {
  if (state === 'past') return t('calendar.past');
  if (state === 'available') return t('calendar.available');
  if (state === 'partially_available') return t('calendar.partial');
  if (state === 'unavailable') return t('calendar.unavailable');
  return '';
}

export function AvailabilityCalendar({
  propertySlug,
  locale,
  selectedDate,
  onSelectDate,
  onMonthSlots,
  onLoadingChange,
  refreshEpoch = 0,
}: Props) {
  const t = useTranslations('property');
  const tRef = useRef(t);
  tRef.current = t;
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [monthKey, setMonthKey] = useState(() =>
    selectedDate ? monthKeyFromIso(selectedDate) : currentMonthKey(),
  );
  const [slots, setSlots] = useState<PublicAvailabilitySlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cacheRef = useRef<Map<string, PublicAvailabilitySlot[]>>(new Map());
  const requestSeq = useRef(0);
  const today = todayIsoInPlatformZone(BOOKING_CALENDAR_TIME_ZONE);
  const minMonth = currentMonthKey();
  const horizonMax = maxMonthKey();
  // Allow viewing a deep-linked / QA date beyond the default horizon month
  const maxMonth =
    selectedDate && compareMonthKeys(monthKeyFromIso(selectedDate), horizonMax) > 0
      ? monthKeyFromIso(selectedDate)
      : horizonMax;
  const isRtl = locale === 'ar';

  const cacheKey = `${propertySlug}:${monthKey}`;

  const setLoadingBoth = useCallback(
    (v: boolean) => {
      setLoading(v);
      onLoadingChange?.(v);
    },
    [onLoadingChange],
  );

  const loadMonth = useCallback(
    async (key: string, force = false) => {
      const ck = `${propertySlug}:${key}`;
      if (!force && cacheRef.current.has(ck)) {
        const cached = cacheRef.current.get(ck)!;
        setSlots(cached);
        setError(null);
        setLoadingBoth(false);
        onMonthSlots(cached, key);
        return;
      }
      const seq = ++requestSeq.current;
      setLoadingBoth(true);
      setError(null);
      try {
        const { from, to } = monthRangeForFetch(key);
        const data = await fetchPropertyAvailability(propertySlug, from, to);
        if (seq !== requestSeq.current) return;
        cacheRef.current.set(ck, data);
        setSlots(data);
        onMonthSlots(data, key);
      } catch {
        if (seq !== requestSeq.current) return;
        setSlots([]);
        setError(tRef.current('calendar.loadError'));
      } finally {
        if (seq === requestSeq.current) setLoadingBoth(false);
      }
    },
    [propertySlug, onMonthSlots, setLoadingBoth],
  );

  useEffect(() => {
    cacheRef.current.clear();
    setMonthKey(selectedDate ? monthKeyFromIso(selectedDate) : currentMonthKey());
    setSlots([]);
    setError(null);
  }, [propertySlug, refreshEpoch]);

  useEffect(() => {
    if (!open && !selectedDate) return;
    const key = open ? monthKey : monthKeyFromIso(selectedDate);
    void loadMonth(key);
  }, [open, monthKey, selectedDate, propertySlug, refreshEpoch, loadMonth]);

  const grid = useMemo(
    () => buildMonthGrid(monthKey, slots, BOOKING_CALENDAR_TIME_ZONE),
    [monthKey, slots],
  );
  const weekdays = useMemo(() => weekdayLabels(locale), [locale]);
  const canPrev = compareMonthKeys(monthKey, minMonth) > 0;
  const canNext = compareMonthKeys(monthKey, maxMonth) < 0;

  function goPrev() {
    if (!canPrev) return;
    setMonthKey((m) => shiftMonthKey(m, -1));
  }
  function goNext() {
    if (!canNext) return;
    setMonthKey((m) => shiftMonthKey(m, 1));
  }

  function pickDate(iso: string, state: CalendarDayState) {
    if (state === 'past' || state === 'unavailable' || state === 'empty' || !iso) return;
    onSelectDate(iso);
    setOpen(false);
  }

  const triggerLabel = selectedDate
    ? formatSelectedDateLabel(selectedDate, locale)
    : t('selectDatePlaceholder');

  return (
    <div data-testid="booking-availability-calendar">
      <button
        type="button"
        id="booking-date-trigger"
        data-testid="booking-date-trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setMonthKey(selectedDate ? monthKeyFromIso(selectedDate) : currentMonthKey());
          setOpen(true);
        }}
        className="w-full appearance-none border-0 bg-transparent p-0 text-start text-[12px] font-semibold leading-tight text-[#0D2046] outline-none ring-0 focus-visible:ring-2 focus-visible:ring-[#2F6EF6]/40"
      >
        <span className={selectedDate ? 'text-[#0D2046]' : 'font-medium text-[#8794A7]'}>
          {triggerLabel}
        </span>
      </button>
      <input
        id="booking-date"
        data-testid="booking-date"
        type="hidden"
        value={selectedDate}
        readOnly
      />

      {open ? (
        <div
          className="fixed inset-0 z-[70]"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          data-testid="booking-calendar-dialog"
        >
          <button
            type="button"
            className="absolute inset-0 bg-[#0D2046]/35 backdrop-blur-[3px]"
            aria-label={t('calendar.close')}
            onClick={() => setOpen(false)}
          />
          <div
            className="absolute inset-x-0 bottom-0 flex max-h-[92vh] flex-col overflow-hidden rounded-t-[28px] border border-[#E4ECF7] bg-white shadow-[0_28px_80px_rgba(31,70,120,.22)] lg:inset-x-auto lg:bottom-auto lg:left-1/2 lg:top-[12vh] lg:w-full lg:max-w-[420px] lg:-translate-x-1/2 lg:rounded-[24px]"
            data-testid="booking-calendar-sheet"
          >
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#E8EEF6] px-4 pb-3 pt-4">
              <div className="min-w-0 text-start">
                <p className="text-[11px] font-medium text-[#8A96A8]">{t('selectDate')}</p>
                <h2 id={titleId} className="truncate text-[17px] font-bold text-[#0D2046]">
                  {formatMonthTitle(monthKey, locale)}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#E1EAF6] bg-white text-[#4E5D73]"
                aria-label={t('calendar.close')}
                data-testid="booking-calendar-close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex items-center justify-between gap-2 px-4 py-3">
              <button
                type="button"
                data-testid="booking-calendar-prev"
                disabled={!canPrev || loading}
                onClick={goPrev}
                aria-label={t('calendar.prevMonth')}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#E1EAF6] bg-white text-[#0D2046] disabled:cursor-not-allowed disabled:opacity-35"
              >
                {isRtl ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
              </button>
              <p
                className="text-[13px] font-semibold text-[#0D2046]"
                data-testid="booking-calendar-month-label"
              >
                {formatMonthTitle(monthKey, locale)}
              </p>
              <button
                type="button"
                data-testid="booking-calendar-next"
                disabled={!canNext || loading}
                onClick={goNext}
                aria-label={t('calendar.nextMonth')}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#E1EAF6] bg-white text-[#0D2046] disabled:cursor-not-allowed disabled:opacity-35"
              >
                {isRtl ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4 sm:px-4">
              {error ? (
                <div
                  className="flex flex-col items-center gap-3 rounded-2xl border border-danger/20 bg-danger/5 px-4 py-8 text-center"
                  data-testid="booking-calendar-error"
                >
                  <p className="text-[13px] text-danger">{error}</p>
                  <button
                    type="button"
                    data-testid="booking-calendar-retry"
                    onClick={() => void loadMonth(monthKey, true)}
                    className="rounded-full bg-[#2F6EF6] px-4 py-2 text-[12px] font-semibold text-white"
                  >
                    {t('calendar.retry')}
                  </button>
                </div>
              ) : (
                <>
                  <div className="mb-1 grid grid-cols-7 gap-1" role="row" aria-hidden>
                    {weekdays.map((d) => (
                      <div
                        key={d}
                        className="py-1 text-center text-[10px] font-semibold text-[#8794A7]"
                      >
                        {d}
                      </div>
                    ))}
                  </div>

                  {loading && !cacheRef.current.has(cacheKey) ? (
                    <div
                      className="grid grid-cols-7 gap-1"
                      data-testid="booking-calendar-skeleton"
                    >
                      {Array.from({ length: 35 }).map((_, i) => (
                        <div
                          key={i}
                          className="aspect-square animate-pulse rounded-xl bg-[#EAF1FB]"
                        />
                      ))}
                    </div>
                  ) : (
                    <div
                      className="relative grid grid-cols-7 gap-1"
                      role="grid"
                      aria-labelledby={titleId}
                      data-testid="booking-calendar-grid"
                    >
                      {loading ? (
                        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-white/50">
                          <Loader2 className="h-5 w-5 animate-spin text-[#2F6EF6]" />
                        </div>
                      ) : null}
                      {grid.map((cell, idx) => {
                        if (!cell.inCurrentMonth || !cell.iso) {
                          return <div key={`pad-${idx}`} className="aspect-square" aria-hidden />;
                        }
                        const isToday = cell.iso === today;
                        const selected = cell.iso === selectedDate;
                        const disabled =
                          cell.state === 'past' || cell.state === 'unavailable';
                        const selectable =
                          cell.state === 'available' || cell.state === 'partially_available';
                        return (
                          <button
                            key={cell.iso}
                            type="button"
                            role="gridcell"
                            data-testid={`booking-calendar-day-${cell.iso}`}
                            data-day-state={cell.state}
                            aria-label={`${formatSelectedDateLabel(cell.iso, locale)}, ${stateLabel(cell.state, t)}`}
                            aria-current={isToday ? 'date' : undefined}
                            aria-selected={selected}
                            disabled={disabled || loading}
                            onClick={() => pickDate(cell.iso, cell.state)}
                            className={`relative flex aspect-square flex-col items-center justify-center rounded-xl text-[13px] font-semibold tabular-nums transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2F6EF6]/45 ${
                              selected
                                ? 'bg-[#2F6EF6] text-white shadow-[0_6px_14px_rgba(47,110,246,.35)]'
                                : disabled
                                  ? 'cursor-not-allowed text-[#C5CDD8]'
                                  : selectable
                                    ? 'bg-[#F7FAFF] text-[#0D2046] hover:bg-[#EEF4FF]'
                                    : 'text-[#C5CDD8]'
                            } ${isToday && !selected ? 'ring-1 ring-[#2F6EF6]/50' : ''}`}
                          >
                            <span>{cell.dayOfMonth}</span>
                            {cell.state === 'partially_available' && !selected ? (
                              <span
                                className="absolute bottom-1 h-1 w-1 rounded-full bg-[#2F6EF6]"
                                aria-hidden
                              />
                            ) : null}
                            {cell.state === 'available' && !selected ? (
                              <span
                                className="absolute bottom-1 h-1 w-1 rounded-full bg-[#16A34A]/80"
                                aria-hidden
                              />
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <div
                    className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-[10px] font-medium text-[#8794A7]"
                    data-testid="booking-calendar-legend"
                  >
                    <span className="inline-flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#16A34A]/80" />
                      {t('calendar.available')}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#2F6EF6]" />
                      {t('calendar.partial')}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#C5CDD8]" />
                      {t('calendar.unavailable')}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
