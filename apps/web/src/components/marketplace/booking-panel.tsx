'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
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
  CouponValidationResult,
  PublicAvailabilitySlot,
  PublicPropertyDetail,
} from '@mazare3/shared';
import { AVAILABILITY_PERIODS } from '@mazare3/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FavoriteButton } from '@/components/favorites/favorite-button';
import { fetchPropertyAvailability } from '@/lib/api-properties';
import {
  BookingApiError,
  clearBookingDraft,
  createBooking,
  loadBookingDraft,
  saveBookingDraft,
  validatePlatformCoupon,
  validatePropertyCoupon,
} from '@/lib/api-bookings';
import { getMe } from '@/lib/api-auth';
import { LegalCommitmentNotice } from '@/components/legal/legal-commitment-notice';
import { formatPrice } from '@/lib/property-helpers';
import { todayIsoInPlatformZone } from '@/lib/format-platform-time';

interface BookingPanelProps {
  property: PublicPropertyDetail;
  locale: 'ar' | 'en';
  initialDate?: string;
  initialPeriod?: AvailabilityPeriod | '';
  initialGuests?: number;
  preferredPeriod?: AvailabilityPeriod;
  rebookMode?: boolean;
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function todayIso(): string {
  return todayIsoInPlatformZone();
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
  htmlFor: string;
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

const stackedControlClass =
  'w-full appearance-none border-0 bg-transparent p-0 text-start text-[12px] font-semibold leading-tight text-[#0D2046] outline-none ring-0 placeholder:font-medium placeholder:text-[#8794A7] focus:outline-none focus:ring-0';

export function BookingPanel({
  property,
  locale,
  initialDate = '',
  initialPeriod = '',
  initialGuests,
  preferredPeriod,
  rebookMode = false,
}: BookingPanelProps) {
  const t = useTranslations('property');
  const tCommon = useTranslations('common');
  const tSearch = useTranslations('search');
  const router = useRouter();
  const pathname = usePathname();

  const [date, setDate] = useState(initialDate);
  const [period, setPeriod] = useState<AvailabilityPeriod | ''>(initialPeriod);
  const [guests, setGuests] = useState(
    initialGuests ? Math.min(initialGuests, property.capacity) : Math.min(10, property.capacity),
  );
  const [slots, setSlots] = useState<PublicAvailabilitySlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [couponInput, setCouponInput] = useState('');
  const [coupon, setCoupon] = useState<CouponValidationResult | null>(null);
  const [couponBusy, setCouponBusy] = useState(false);

  const minDate = todayIso();
  const currency = property.currency;

  useEffect(() => {
    if (initialGuests) setGuests(Math.min(initialGuests, property.capacity));
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

  const loadSlots = useCallback(
    async (selectedDate: string) => {
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
    },
    [property.slug, t],
  );

  useEffect(() => {
    if (date) void loadSlots(date);
  }, [date, loadSlots]);

  const slotsForDate = useMemo(() => slots.filter((s) => s.date === date), [slots, date]);

  useEffect(() => {
    if (!date || !preferredPeriod || loadingSlots) return;
    const ok = slotsForDate.some((s) => s.period === preferredPeriod && s.bookable);
    if (ok) setPeriod(preferredPeriod);
  }, [date, preferredPeriod, loadingSlots, slotsForDate]);

  const selectedSlot = useMemo(
    () => slotsForDate.find((s) => s.period === period && s.bookable),
    [slotsForDate, period],
  );

  useEffect(() => {
    setCoupon(null);
  }, [date, period]);

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

  const availablePeriods = useMemo(() => {
    const set = new Set(slotsForDate.filter((s) => s.bookable).map((s) => s.period));
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
        expectedTotalAmount: coupon?.finalPrice ?? selectedSlot.price,
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
        if (date) await loadSlots(date);
        setError(t('slotUnavailable'));
        setPeriod('');
      } else if (err instanceof BookingApiError && err.code === 'PRICING_CHANGED') {
        if (date) await loadSlots(date);
        setCoupon(null);
        setError(t('pricingChanged'));
      } else if (err instanceof BookingApiError && err.code) {
        setError(couponErrorMessage(err.code));
      } else {
        setError(err instanceof Error ? err.message : t('bookingError'));
      }
    } finally {
      setBooking(false);
    }
  }

  const displayPrice = coupon?.finalPrice ?? selectedSlot?.price ?? property.basePrice;
  const displayDeposit = coupon?.depositAmount ?? selectedSlot?.depositAmount;
  const displayRemaining = coupon?.remainingAmount ?? selectedSlot?.remainingAmount;
  const displayDiscount = coupon?.discountAmount ?? selectedSlot?.discountAmount;
  const slotCurrency = selectedSlot?.currency ?? currency;

  return (
    <div
      data-testid="booking-panel"
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
        {property.instantBookingEnabled === false ? (
          <p className="mt-2 text-[11px] text-[#5B6B7C]">{t('ownerApprovalHint')}</p>
        ) : null}
      </div>

      <div className="relative mt-3 flex flex-col gap-1.5">
        <StackedField
          icon={<Calendar className="h-4 w-4" aria-hidden />}
          label={t('selectDate')}
          htmlFor="booking-date"
        >
          <input
            id="booking-date"
            data-testid="booking-date"
            type="date"
            min={minDate}
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              setPeriod('');
            }}
            className={stackedControlClass}
          />
        </StackedField>

        {date ? (
          <div className="rounded-[14px] border border-[#E7EEF8] bg-white px-2.5 py-2 shadow-[0_4px_12px_rgba(47,110,246,.04)]">
            <div className="mb-1.5 flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F3F8FF] text-[#2F6EF6]">
                <Clock className="h-4 w-4" aria-hidden />
              </div>
              <p className="text-[10px] font-medium text-[#8794A7]">{t('selectPeriod')}</p>
            </div>
            {loadingSlots ? (
              <p className="flex items-center gap-2 px-1 text-[12px] text-[#5B6B7C]">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {t('loadingAvailability')}
              </p>
            ) : availablePeriods.length === 0 ? (
              <p className="px-1 text-[12px] text-[#5B6B7C]">{t('noSlotsForDate')}</p>
            ) : (
              <div className="grid grid-cols-2 gap-1.5">
                {availablePeriods.map((p) => {
                  const slot = slotsForDate.find((s) => s.period === p && s.bookable);
                  return (
                    <button
                      key={p}
                      type="button"
                      data-testid={`booking-period-${p}`}
                      aria-pressed={period === p}
                      onClick={() => setPeriod(p)}
                      className={`rounded-[10px] border px-2 py-1.5 text-start text-[11px] transition-colors ${
                        period === p
                          ? 'border-[#2F6EF6] bg-[#EEF4FF] text-[#0D2046]'
                          : 'border-[#E7EEF8] bg-[#F8FBFF] hover:border-[#2F6EF6]/40'
                      }`}
                    >
                      <span className="font-semibold">{t(`period.${p}`)}</span>
                      {slot?.startAtLocal && slot?.endAtLocal ? (
                        <span className="mt-0.5 block text-[10px] font-medium text-[#8794A7]">
                          {slot.startAtLocal} – {slot.endAtLocal}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <StackedField
            icon={<Clock className="h-4 w-4" aria-hidden />}
            label={t('selectPeriod')}
            htmlFor="booking-period-placeholder"
          >
            <p id="booking-period-placeholder" className="text-[12px] font-semibold text-[#8794A7]">
              {tSearch('filterAnyPeriod')}
            </p>
          </StackedField>
        )}

        <StackedField
          icon={<Users className="h-4 w-4" aria-hidden />}
          label={t('guestsCount')}
          htmlFor="booking-guests"
        >
          <input
            id="booking-guests"
            data-testid="booking-guests"
            type="number"
            min={1}
            max={property.capacity}
            value={guests}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (!Number.isNaN(n) && n >= 1) setGuests(Math.min(n, property.capacity));
            }}
            className={stackedControlClass}
          />
        </StackedField>

        {/* Price summary */}
        <div className="mt-1 space-y-1.5 rounded-[14px] border border-[#E7EEF8] bg-white/90 px-3 py-2.5 text-[12px] text-[#5B6B7C] shadow-[0_4px_12px_rgba(47,110,246,.04)]">
          {selectedSlot ? (
            <>
              <div className="flex items-center justify-between gap-3">
                <span>{t(`period.${period}`)}</span>
                <span className="tabular-nums font-medium text-[#0D2046]">
                  {formatPrice(selectedSlot.price, slotCurrency, locale)}
                </span>
              </div>
              {displayDiscount ? (
                <div
                  className="flex items-center justify-between gap-3"
                  data-testid="booking-summary-discount"
                >
                  <span>{t('summaryDiscount')}</span>
                  <span className="tabular-nums">
                    −{formatPrice(displayDiscount, slotCurrency, locale)}
                  </span>
                </div>
              ) : null}
              <div
                className="flex items-center justify-between gap-3"
                data-testid="booking-summary-deposit"
              >
                <span>{t('summaryDeposit')}</span>
                <span className="tabular-nums">
                  {formatPrice(displayDeposit ?? 0, slotCurrency, locale)}
                </span>
              </div>
              <div
                className="flex items-center justify-between gap-3"
                data-testid="booking-summary-remaining"
              >
                <span>{t('summaryRemaining')}</span>
                <span className="tabular-nums">
                  {formatPrice(displayRemaining ?? 0, slotCurrency, locale)}
                </span>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <span>
                {tCommon('from')} / {tCommon('perDay')}
              </span>
              <span className="tabular-nums font-medium text-[#0D2046]">
                {formatPrice(property.basePrice, currency, locale)}
              </span>
            </div>
          )}
          <div
            className="flex items-center justify-between gap-3 border-t border-[#E7EEF8] pt-1.5 text-[13px] font-bold text-[#0D2046]"
            data-testid="booking-summary-price"
          >
            <span>{t('total')}</span>
            <span className="tabular-nums text-[15px]">
              {formatPrice(displayPrice, slotCurrency, locale)}
            </span>
          </div>
        </div>

        {date && period && selectedSlot?.bookable ? (
          <div className="space-y-2 rounded-[14px] border border-[#E7EEF8] bg-white/90 px-3 py-2.5" data-testid="coupon-box">
            <p className="text-[11px] font-medium text-[#0D2046]">{t('couponPrompt')}</p>
            <div className="flex gap-2">
              <Input
                data-testid="coupon-input"
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value)}
                disabled={Boolean(coupon)}
                className="h-9 rounded-[10px] border-[#E7EEF8] bg-white text-[12px]"
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
                  className="h-9 rounded-[10px] text-[12px]"
                >
                  {t('couponRemove')}
                </Button>
              ) : (
                <Button
                  type="button"
                  data-testid="coupon-apply"
                  disabled={couponBusy || !couponInput.trim()}
                  onClick={() => void applyCoupon()}
                  className="h-9 rounded-[10px] bg-[#2F6EF6] text-[12px] hover:bg-[#2563EB]"
                >
                  {t('couponApply')}
                </Button>
              )}
            </div>
          </div>
        ) : null}

        {error ? (
          <p
            data-testid="booking-error"
            className="flex items-start gap-2 rounded-[12px] border border-danger/20 bg-danger/10 px-3 py-2 text-[12px] text-danger"
          >
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {error}
          </p>
        ) : null}

        <Button
          data-testid="booking-submit"
          type="button"
          size="lg"
          disabled={booking || !date || !period || !selectedSlot}
          onClick={() => void handleBook()}
          className="mt-0.5 h-[42px] w-full rounded-[12px] bg-[linear-gradient(90deg,#2F6EF6_0%,#4B8CFF_100%)] text-[13px] font-semibold text-white shadow-[0_8px_16px_rgba(47,110,246,.22)] transition hover:-translate-y-0.5 hover:bg-[#2F6EF6]"
        >
          {booking ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {t('bookingInProgress')}
            </>
          ) : (
            tCommon('bookNow')
          )}
        </Button>

        <div className="[&_a]:h-[40px] [&_a]:rounded-[12px] [&_a]:border-[#D7E6FA] [&_a]:bg-white/90 [&_a]:text-[12px] [&_a]:shadow-[0_3px_10px_rgba(47,110,246,.05)] [&_button]:h-[40px] [&_button]:rounded-[12px] [&_button]:border-[#D7E6FA] [&_button]:bg-white/90 [&_button]:text-[12px] [&_button]:shadow-[0_3px_10px_rgba(47,110,246,.05)]">
          <FavoriteButton propertyId={property.id} variant="outline" />
        </div>

        <div className="flex items-start gap-2 px-0.5 pt-1">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#16A34A]" aria-hidden />
          <div className="min-w-0 text-start">
            <p className="text-[12px] font-bold text-[#0D2046]">{t('safeBookingTitle')}</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-[#53637A]">
              {t('safeBookingSubtitle')}
            </p>
          </div>
        </div>

        <LegalCommitmentNotice testId="booking-legal-notice" />
      </div>
    </div>
  );
}
