'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { Link } from '@/i18n/navigation';
import {
  Calendar,
  Clock,
  ShieldCheck,
  Loader2,
  AlertCircle,
  Users,
} from 'lucide-react';
import type {
  AvailabilityPeriod,
  BookingQuote,
  CouponValidationResult,
  PublicAvailabilitySlot,
  PublicPropertyDetail,
} from '@mazare3/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FavoriteButton } from '@/components/favorites/favorite-button';
import {
  BookingApiError,
  clearBookingDraft,
  createBooking,
  fetchBookingQuote,
  loadBookingDraft,
  saveBookingDraft,
  validatePlatformCoupon,
  validatePropertyCoupon,
} from '@/lib/api-bookings';
import { getMe } from '@/lib/api-auth';
import { LegalCommitmentNotice } from '@/components/legal/legal-commitment-notice';
import { formatPrice } from '@/lib/property-helpers';
import { bookableSlotsForDate, monthKeyFromIso } from '@/lib/booking-calendar';
import { AvailabilityCalendar } from '@/components/marketplace/booking/availability-calendar';
import { BookingPeriodSelector } from '@/components/marketplace/booking/booking-period-selector';
import { GuestCountStepper } from '@/components/marketplace/booking/guest-count-stepper';
import { BookingQuoteBreakdown } from '@/components/marketplace/booking/booking-quote-breakdown';

interface BookingPanelProps {
  property: PublicPropertyDetail;
  locale: 'ar' | 'en';
  initialDate?: string;
  initialPeriod?: AvailabilityPeriod | '';
  initialGuests?: number;
  preferredPeriod?: AvailabilityPeriod;
  rebookMode?: boolean;
  /** CB-UX-1 — dedicated booking configuration page layout. */
  layout?: 'page' | 'legacy';
}

function CloudMark() {
  return (
    <svg
      viewBox="0 0 76 48"
      className="h-9 w-[56px] text-[#7EB6FF]/45"
      fill="none"
      aria-hidden
    >
      <path
        d="M13 35c-5 0-9-4-9-9 0-4 3-8 7-9 2-7 8-12 16-12 8 0 15 6 16 14 6 1 11 6 11 12 0 6-5 10-11 10H13Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function StackedField({
  icon,
  label,
  htmlFor,
  children,
}: {
  icon: ReactNode;
  label: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-[14px] border border-[#E7EEF8] bg-white px-2.5 py-2 shadow-[0_4px_12px_rgba(47,110,246,.04)]">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F3F8FF] text-[#2F6EF6]">
        {icon}
      </div>
      <div className="min-w-0 flex-1 text-start">
        <Label
          htmlFor={htmlFor}
          className="mb-0 block text-[10px] font-medium leading-none text-[#8794A7]"
        >
          {label}
        </Label>
        {children}
      </div>
    </div>
  );
}

export function BookingPanel({
  property,
  locale,
  initialDate = '',
  initialPeriod = '',
  initialGuests,
  preferredPeriod,
  rebookMode = false,
  layout = 'legacy',
}: BookingPanelProps) {
  const t = useTranslations('property');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const pathname = usePathname();
  const instant = property.instantBookingEnabled !== false;

  const [date, setDate] = useState(initialDate);
  const [period, setPeriod] = useState<AvailabilityPeriod | ''>(initialPeriod);
  const [guests, setGuests] = useState(
    initialGuests ? Math.min(initialGuests, property.capacity) : Math.min(10, property.capacity),
  );
  const [monthSlots, setMonthSlots] = useState<PublicAvailabilitySlot[]>([]);
  const [loadedMonthKey, setLoadedMonthKey] = useState('');
  const [loadingMonth, setLoadingMonth] = useState(false);
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [couponInput, setCouponInput] = useState('');
  const [coupon, setCoupon] = useState<CouponValidationResult | null>(null);
  const [couponBusy, setCouponBusy] = useState(false);
  const [calendarEpoch, setCalendarEpoch] = useState(0);
  const [quote, setQuote] = useState<BookingQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoteEpoch, setQuoteEpoch] = useState(0);
  const quoteSeq = useRef(0);

  const currency = property.currency;

  useEffect(() => {
    setDate(initialDate || '');
    setPeriod(initialPeriod || '');
    setMonthSlots([]);
    setLoadedMonthKey('');
    setCoupon(null);
    setError(null);
    setQuote(null);
    setQuoteError(null);
    setCalendarEpoch((n) => n + 1);
  }, [property.slug, property.id, initialDate, initialPeriod]);

  useEffect(() => {
    if (initialGuests) setGuests(Math.min(initialGuests, property.capacity));
    else setGuests((g) => Math.min(g, property.capacity));
  }, [initialGuests, property.capacity]);

  useEffect(() => {
    if (rebookMode || initialDate) return;
    const draft = loadBookingDraft(property.slug);
    if (draft?.date) setDate(draft.date);
    if (draft?.period) setPeriod(draft.period as AvailabilityPeriod);
    if (draft?.guests) setGuests(Math.min(draft.guests, property.capacity));
  }, [property.slug, property.capacity, initialDate, rebookMode]);

  useEffect(() => {
    if (!date && !period) return;
    saveBookingDraft(property.slug, {
      date,
      period,
      guests,
    });
  }, [property.slug, date, period, guests]);

  const handleMonthSlots = useCallback((slots: PublicAvailabilitySlot[], monthKey: string) => {
    setMonthSlots(slots);
    setLoadedMonthKey(monthKey);
  }, []);

  const slotsForDate = useMemo(() => {
    if (!date) return [];
    if (loadedMonthKey && monthKeyFromIso(date) !== loadedMonthKey) return [];
    return bookableSlotsForDate(monthSlots, date, property.allowsOvernight);
  }, [date, monthSlots, loadedMonthKey, property.allowsOvernight]);

  const loadingSlots =
    Boolean(date) &&
    (loadingMonth || loadedMonthKey === '' || monthKeyFromIso(date) !== loadedMonthKey);

  useEffect(() => {
    if (!date || !preferredPeriod || loadingSlots) return;
    const ok = slotsForDate.some((s) => s.period === preferredPeriod);
    if (ok) setPeriod(preferredPeriod);
  }, [date, preferredPeriod, loadingSlots, slotsForDate]);

  useEffect(() => {
    if (!date || !period) return;
    if (loadingSlots) return;
    if (!slotsForDate.some((s) => s.period === period)) {
      setPeriod('');
    }
  }, [date, period, slotsForDate, loadingSlots]);

  const selectedSlot = useMemo(
    () => slotsForDate.find((s) => s.period === period),
    [slotsForDate, period],
  );

  useEffect(() => {
    setCoupon(null);
    setCouponInput('');
  }, [date, period]);

  const loadQuote = useCallback(async () => {
    if (!date || !period) {
      setQuote(null);
      setQuoteError(null);
      setQuoteLoading(false);
      return;
    }
    const seq = ++quoteSeq.current;
    setQuoteLoading(true);
    setQuoteError(null);
    setQuote(null);
    try {
      const res = await fetchBookingQuote(property.slug, {
        date,
        period,
        guestsCount: guests,
        couponCode: coupon?.normalizedCode,
      });
      if (seq !== quoteSeq.current) return;
      setQuote(res.data);
    } catch (err) {
      if (seq !== quoteSeq.current) return;
      setQuote(null);
      if (err instanceof BookingApiError && err.code === 'SLOT_UNAVAILABLE') {
        setCalendarEpoch((n) => n + 1);
        setPeriod('');
        setQuoteError(t('slotUnavailable'));
      } else {
        setQuoteError(t('quoteLoadError'));
      }
    } finally {
      if (seq === quoteSeq.current) setQuoteLoading(false);
    }
  }, [date, period, guests, coupon?.normalizedCode, property.slug, t]);

  useEffect(() => {
    void loadQuote();
  }, [loadQuote, quoteEpoch]);

  function handleSelectDate(iso: string) {
    setDate(iso);
    setPeriod('');
    setError(null);
    setQuoteError(null);
  }

  function couponErrorMessage(code?: string) {
    if (code === 'COUPON_INVALID') return t('couponInvalid');
    if (code === 'COUPON_EXPIRED' || code === 'COUPON_PAUSED') return t('couponExpired');
    if (code === 'COUPON_USAGE_LIMIT') return t('couponUsageLimit');
    if (code === 'COUPON_ALREADY_USED') return t('couponAlreadyUsed');
    if (code === 'COUPON_MIN_AMOUNT') return t('couponMinAmount');
    if (code === 'DISCOUNT_NOT_STACKABLE') return t('couponNotStackable');
    return t('couponInvalid');
  }

  async function applyCoupon() {
    if (!date || !period || !couponInput.trim()) return;
    setCouponBusy(true);
    setError(null);
    try {
      const res = await validatePropertyCoupon(property.slug, {
        code: couponInput,
        date,
        period,
      });
      setCoupon(res.data);
    } catch (err) {
      if (err instanceof BookingApiError && err.code === 'COUPON_INVALID') {
        try {
          const platform = await validatePlatformCoupon(property.slug, {
            code: couponInput,
            date,
            period,
          });
          setCoupon(platform.data);
          return;
        } catch (platformErr) {
          setCoupon(null);
          setError(
            platformErr instanceof BookingApiError
              ? couponErrorMessage(platformErr.code)
              : t('couponInvalid'),
          );
          return;
        }
      }
      setCoupon(null);
      setError(err instanceof BookingApiError ? couponErrorMessage(err.code) : t('couponInvalid'));
    } finally {
      setCouponBusy(false);
    }
  }

  async function handleBook() {
    setError(null);
    if (!date || !period || !quote) {
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
      router.push(`/auth?returnUrl=${returnUrl}`);
      return;
    }

    setBooking(true);
    try {
      const res = await createBooking({
        propertySlug: property.slug,
        date,
        period: period as AvailabilityPeriod,
        guestsCount: guests,
        expectedTotalAmount: quote.expectedTotalAmount,
        couponCode: coupon?.normalizedCode,
      });
      clearBookingDraft(property.slug);
      if (res.data.status === 'pending_owner_approval') {
        router.push('/account/bookings');
      } else {
        router.push(`/checkout/${res.data.id}`);
      }
    } catch (err) {
      if (err instanceof BookingApiError && err.code === 'SLOT_UNAVAILABLE') {
        setCalendarEpoch((n) => n + 1);
        setPeriod('');
        setQuote(null);
        setError(t('slotUnavailable'));
      } else if (err instanceof BookingApiError && err.code === 'PRICING_CHANGED') {
        setCoupon(null);
        setQuoteEpoch((n) => n + 1);
        setError(t('pricingChangedReview'));
      } else if (err instanceof BookingApiError && err.code) {
        setError(couponErrorMessage(err.code));
      } else {
        setError(err instanceof Error ? err.message : t('bookingError'));
      }
    } finally {
      setBooking(false);
    }
  }

  const quoteReady = Boolean(quote) && !quoteLoading && !quoteError;
  const ctaDisabled = booking || !date || !period || !quoteReady;
  const isPage = layout === 'page';

  const submitLabel = booking ? (
    <>
      <Loader2 className="h-3.5 w-3.5 animate-spin" />
      {t('bookingInProgress')}
    </>
  ) : instant ? (
    t('ctaContinuePayment')
  ) : (
    t('ctaSendRequest')
  );

  const couponBlock =
    date && period ? (
      <div
        className="space-y-2 rounded-[14px] border border-[#E7EEF8] bg-white px-3 py-3"
        data-testid="coupon-box"
      >
        <p className="text-[13px] font-bold text-[#0D2046]">{t('couponSaveTitle')}</p>
        <p className="text-[11px] text-[#53637A]">{t('couponPrompt')}</p>
        <div className="flex gap-2">
          <Input
            data-testid="coupon-input"
            value={couponInput}
            onChange={(e) => setCouponInput(e.target.value)}
            disabled={Boolean(coupon)}
            className="h-10 rounded-[10px] border-[#E7EEF8] bg-white text-[13px]"
          />
          {coupon ? (
            <Button
              type="button"
              variant="outline"
              data-testid="coupon-remove"
              onClick={() => {
                setCoupon(null);
                setCouponInput('');
              }}
              className="h-10 rounded-[10px] text-[12px]"
            >
              {t('couponRemove')}
            </Button>
          ) : (
            <Button
              type="button"
              data-testid="coupon-apply"
              disabled={couponBusy || !couponInput.trim()}
              onClick={() => void applyCoupon()}
              className="h-10 rounded-[10px] bg-[#2F6EF6] text-[12px] hover:bg-[#2563EB]"
            >
              {t('couponApply')}
            </Button>
          )}
        </div>
      </div>
    ) : null;

  if (isPage) {
    return (
      <div
        data-testid="booking-panel"
        data-layout="page"
        data-instant={instant ? 'true' : 'false'}
        className="space-y-4"
      >
        <div className="text-start">
          <h2 className="text-[20px] font-bold text-[#0D2046]">{t('bookingPanelTitle')}</h2>
          <p className="mt-1 text-[13px] text-[#53637A]">{t('bookingConfigSubtitle')}</p>
        </div>

        <section className="space-y-2 border-b border-[#E8EEF5] pb-4" data-testid="booking-section-date">
          <h3 className="text-[15px] font-bold text-[#0D2046]">{t('selectDateSection')}</h3>
          <div className="rounded-[16px] border border-[#E7EEF8] bg-white px-3 py-3">
            <AvailabilityCalendar
              propertySlug={property.slug}
              locale={locale}
              selectedDate={date}
              onSelectDate={handleSelectDate}
              onMonthSlots={handleMonthSlots}
              onLoadingChange={setLoadingMonth}
              refreshEpoch={calendarEpoch}
            />
          </div>
        </section>

        <section className="space-y-2 border-b border-[#E8EEF5] pb-4" data-testid="booking-section-period">
          <h3 className="text-[15px] font-bold text-[#0D2046]">{t('selectPeriodSection')}</h3>
          <div className="rounded-[16px] border border-[#E7EEF8] bg-white px-3 py-3">
            <BookingPeriodSelector
              slots={slotsForDate}
              selectedPeriod={period}
              onSelect={setPeriod}
              locale={locale}
              loading={loadingSlots}
              hasDate={Boolean(date)}
            />
          </div>
        </section>

        <section className="space-y-2 border-b border-[#E8EEF5] pb-4" data-testid="booking-section-guests">
          <h3 className="text-[15px] font-bold text-[#0D2046]">{t('guestsCount')}</h3>
          <p className="text-[12px] text-[#53637A]">{t('guestsCapacityHint', { capacity: property.capacity })}</p>
          <div className="rounded-[16px] border border-[#E7EEF8] bg-white px-3 py-3">
            <GuestCountStepper value={guests} capacity={property.capacity} onChange={setGuests} />
          </div>
        </section>

        {couponBlock}

        {date && period ? (
          <section className="space-y-2" data-testid="booking-section-summary">
            <h3 className="text-[15px] font-bold text-[#0D2046]">{t('paymentSummaryTitle')}</h3>
            <div
              className="rounded-[14px] border border-[#E7EEF8] bg-white px-3 py-2 text-[12px] text-[#5B6B7C]"
              data-testid="booking-selection-summary"
            >
              <p className="font-semibold text-[#0D2046]">
                {t(`period.${period}`)}
                {selectedSlot?.startAtLocal && selectedSlot?.endAtLocal
                  ? ` · ${selectedSlot.startAtLocal} – ${selectedSlot.endAtLocal}`
                  : quote?.startAtLocal && quote?.endAtLocal
                    ? ` · ${quote.startAtLocal} – ${quote.endAtLocal}`
                    : ''}
              </p>
              <p className="mt-0.5 text-[11px]">{t('guestsSummary', { count: guests })}</p>
            </div>
            <BookingQuoteBreakdown
              quote={quote}
              loading={quoteLoading}
              locale={locale}
              error={quoteError}
              onRetry={() => setQuoteEpoch((n) => n + 1)}
            />
          </section>
        ) : null}

        {error ? (
          <p
            data-testid="booking-error"
            className="flex items-start gap-2 rounded-[12px] border border-danger/20 bg-danger/10 px-3 py-2 text-[12px] text-danger"
            role="alert"
          >
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {error}
          </p>
        ) : null}

        {!instant ? (
          <div
            className="rounded-[12px] border border-[#E7EEF8] bg-[#F8FBFF] px-3 py-2 text-[11px] leading-relaxed text-[#53637A]"
            data-testid="owner-approval-no-charge-note"
          >
            <p className="font-semibold text-[#0D2046]">{t('ownerApprovalNoCharge')}</p>
            <p className="mt-0.5">{t('ownerApprovalPayAfter')}</p>
          </div>
        ) : (
          <p className="text-[11px] text-[#8794A7]" data-testid="instant-hold-hint">
            {t('instantHoldHint')}
          </p>
        )}

        <div className="[&_a]:h-[40px] [&_a]:rounded-[12px] [&_button]:h-[40px] [&_button]:rounded-[12px]">
          <FavoriteButton propertyId={property.id} variant="outline" />
        </div>

        <Link
          href="/cancellation-refund"
          data-testid="booking-cancellation-policy-link"
          className="inline-block text-[12px] font-medium text-[#2F6EF6] hover:underline"
        >
          {t('safeBookingPolicyLink')}
        </Link>
        <LegalCommitmentNotice testId="booking-legal-notice" />

        <div
          data-testid="booking-sticky-cta"
          className="fixed inset-x-0 bottom-0 z-40 border-t border-[#E0E8F3] bg-white/95 px-3 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur lg:static lg:mt-2 lg:border-0 lg:bg-transparent lg:p-0 lg:pb-0 lg:backdrop-blur-none"
        >
          <Button
            data-testid="booking-submit"
            type="button"
            size="lg"
            disabled={ctaDisabled}
            onClick={() => void handleBook()}
            className="h-[48px] w-full rounded-[12px] bg-[linear-gradient(90deg,#2F6EF6_0%,#4B8CFF_100%)] text-[15px] font-semibold text-white shadow-[0_8px_16px_rgba(47,110,246,.22)]"
          >
            {submitLabel}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="booking-panel"
      data-instant={instant ? 'true' : 'false'}
      className="relative overflow-hidden rounded-[22px] border border-[#E0E8F3] bg-[linear-gradient(165deg,rgba(236,245,255,.92)_0%,rgba(255,255,255,.78)_48%,rgba(232,243,255,.88)_100%)] px-3.5 pb-3.5 pt-3.5 shadow-[0_8px_14px_-8px_rgba(47,90,150,.18)] backdrop-blur-[18px] sm:px-4 sm:pb-4 sm:pt-4"
    >
      <div className="pointer-events-none absolute left-2 top-3 opacity-80">
        <CloudMark />
      </div>

      <div className="relative text-start">
        <h2 className="text-[18px] font-bold leading-snug text-[#0D2046]">
          {t('bookingPanelTitle')}
        </h2>
        <p className="mt-1 max-w-[260px] text-[11px] font-medium leading-relaxed text-[#53637A]">
          {t('bookingPanelSubtitle')}
        </p>
      </div>

      <div className="relative mt-3 flex flex-col gap-1.5">
        <StackedField
          icon={<Calendar className="h-4 w-4" aria-hidden />}
          label={t('selectDate')}
          htmlFor="booking-date-trigger"
        >
          <AvailabilityCalendar
            propertySlug={property.slug}
            locale={locale}
            selectedDate={date}
            onSelectDate={handleSelectDate}
            onMonthSlots={handleMonthSlots}
            onLoadingChange={setLoadingMonth}
            refreshEpoch={calendarEpoch}
          />
        </StackedField>

        <div className="rounded-[14px] border border-[#E7EEF8] bg-white px-2.5 py-2 shadow-[0_4px_12px_rgba(47,110,246,.04)]">
          <div className="mb-1.5 flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F3F8FF] text-[#2F6EF6]">
              <Clock className="h-4 w-4" aria-hidden />
            </div>
            <p className="text-[10px] font-medium text-[#8794A7]">{t('selectPeriod')}</p>
          </div>
          <BookingPeriodSelector
            slots={slotsForDate}
            selectedPeriod={period}
            onSelect={setPeriod}
            locale={locale}
            loading={loadingSlots}
            hasDate={Boolean(date)}
          />
        </div>

        <StackedField
          icon={<Users className="h-4 w-4" aria-hidden />}
          label={t('guestsCount')}
          htmlFor="booking-guests"
        >
          <GuestCountStepper
            value={guests}
            capacity={property.capacity}
            onChange={setGuests}
          />
        </StackedField>

        {date && period ? (
          <div
            className="rounded-[14px] border border-[#E7EEF8] bg-white/90 px-3 py-2 text-[12px] text-[#5B6B7C]"
            data-testid="booking-selection-summary"
          >
            <p className="font-semibold text-[#0D2046]">
              {t(`period.${period}`)}
              {selectedSlot?.startAtLocal && selectedSlot?.endAtLocal
                ? ` · ${selectedSlot.startAtLocal} – ${selectedSlot.endAtLocal}`
                : quote?.startAtLocal && quote?.endAtLocal
                  ? ` · ${quote.startAtLocal} – ${quote.endAtLocal}`
                  : ''}
            </p>
            <p className="mt-0.5 text-[11px]">
              {t('guestsSummary', { count: guests })}
            </p>
          </div>
        ) : (
          <div className="rounded-[14px] border border-[#E7EEF8] bg-white/90 px-3 py-2.5 text-[12px] text-[#5B6B7C]">
            <div className="flex items-center justify-between gap-3">
              <span>
                {tCommon('from')} / {tCommon('perDay')}
              </span>
              <span className="tabular-nums font-medium text-[#0D2046]">
                {formatPrice(property.basePrice, currency, locale)}
              </span>
            </div>
          </div>
        )}

        {date && period ? (
          <BookingQuoteBreakdown
            quote={quote}
            loading={quoteLoading}
            locale={locale}
            error={quoteError}
            onRetry={() => setQuoteEpoch((n) => n + 1)}
          />
        ) : null}

        {couponBlock}

        {error ? (
          <p
            data-testid="booking-error"
            className="flex items-start gap-2 rounded-[12px] border border-danger/20 bg-danger/10 px-3 py-2 text-[12px] text-danger"
            role="alert"
          >
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {error}
          </p>
        ) : null}

        {!instant ? (
          <div
            className="rounded-[12px] border border-[#E7EEF8] bg-[#F8FBFF] px-3 py-2 text-[11px] leading-relaxed text-[#53637A]"
            data-testid="owner-approval-no-charge-note"
          >
            <p className="font-semibold text-[#0D2046]">{t('ownerApprovalNoCharge')}</p>
            <p className="mt-0.5">{t('ownerApprovalPayAfter')}</p>
          </div>
        ) : (
          <p
            className="px-0.5 text-[10px] leading-relaxed text-[#8794A7]"
            data-testid="instant-hold-hint"
          >
            {t('instantHoldHint')}
          </p>
        )}

        <Button
          data-testid="booking-submit"
          type="button"
          size="lg"
          disabled={ctaDisabled}
          onClick={() => void handleBook()}
          className="mt-0.5 h-[42px] w-full rounded-[12px] bg-[linear-gradient(90deg,#2F6EF6_0%,#4B8CFF_100%)] text-[13px] font-semibold text-white shadow-[0_8px_16px_rgba(47,110,246,.22)] transition hover:-translate-y-0.5 hover:bg-[#2F6EF6]"
        >
          {submitLabel}
        </Button>

        <div className="[&_a]:h-[40px] [&_a]:rounded-[12px] [&_a]:border-[#D7E6FA] [&_a]:bg-white/90 [&_a]:text-[12px] [&_a]:shadow-[0_3px_10px_rgba(47,110,246,.05)] [&_button]:h-[40px] [&_button]:rounded-[12px] [&_button]:border-[#D7E6FA] [&_button]:bg-white/90 [&_button]:text-[12px] [&_button]:shadow-[0_3px_10px_rgba(47,110,246,.05)]">
          <FavoriteButton propertyId={property.id} variant="outline" />
        </div>

        <div className="flex items-start gap-2 px-0.5 pt-1">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#16A34A]" aria-hidden />
          <div className="min-w-0 text-start">
            <p className="text-[12px] font-bold text-[#0D2046]">{t('safeBookingTitle')}</p>
            <Link
              href="/cancellation-refund"
              data-testid="booking-cancellation-policy-link"
              className="mt-0.5 inline-block text-[11px] font-medium leading-relaxed text-[#2F6EF6] hover:underline"
            >
              {t('safeBookingPolicyLink')}
            </Link>
          </div>
        </div>

        <LegalCommitmentNotice testId="booking-legal-notice" />
      </div>
    </div>
  );
}
