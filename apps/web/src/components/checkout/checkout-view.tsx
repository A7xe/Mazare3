'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from '@/i18n/navigation';
import {
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  Loader2,
  Smartphone,
} from 'lucide-react';
import type {
  CheckoutBookingView,
  InitialPaymentChoice,
  PaymentMethod,
  PaymentPublicConfig,
  PaymentSummary,
  SavedPaymentMethodPublic,
} from '@mazare3/shared';
import {
  BALANCE_DUE_HOURS_BEFORE_START,
  CANCELLATION_FREE_UNTIL_HOURS,
  DEPOSIT_PERCENT,
} from '@mazare3/shared';
import { Button } from '@/components/ui/button';
import {
  createManagedFormPayment,
  createPaymentIntent,
  createSavedCardPayment,
  fetchCheckoutBooking,
  fetchPaymentConfig,
  PaymentApiError,
  simulatePaymentFailure,
  simulatePaymentSuccess,
} from '@/lib/api-payments';
import { listMyPaymentMethods } from '@/lib/api-payment-methods';
import { Link } from '@/i18n/navigation';
import { formatPlatformDateTime } from '@/lib/format-platform-time';
import { formatPrice } from '@/lib/property-helpers';
import {
  BookingLegalAck,
  type BookingLegalAckState,
} from '@/components/legal/booking-legal-ack';
import { FirstRunLegalGate } from '@/components/legal/first-run-legal-gate';
import {
  contractualActionsBlocked,
  legalAcceptHref,
  useMyLegalStatus,
} from '@/components/legal/legal-reacceptance';
import { ackBookingLegal } from '@/lib/api-legal';
import { CheckoutPropertySummary } from '@/components/checkout/checkout-property-summary';
import { CheckoutBookingDetails } from '@/components/checkout/checkout-booking-details';
import { CheckoutPaymentSummary } from '@/components/checkout/checkout-payment-summary';
import { CheckoutPaymentMethod } from '@/components/checkout/checkout-payment-method';
import { CheckoutPaymentContact } from '@/components/checkout/checkout-payment-contact';
import { CheckoutHoldBanner } from '@/components/checkout/checkout-hold-banner';
import { CheckoutInitialPaymentChoice } from '@/components/checkout/checkout-initial-payment-choice';

type ContactRequiredFields = Array<'email' | 'phone' | 'name'>;

function CheckoutSkeleton() {
  return (
    <div data-testid="checkout-loading" className="mx-auto max-w-5xl space-y-3">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-[#EAF1FB]" />
      <div className="h-28 animate-pulse rounded-[18px] bg-[#EAF1FB]" />
      <div className="h-36 animate-pulse rounded-[18px] bg-[#EAF1FB]" />
      <div className="h-44 animate-pulse rounded-[18px] bg-[#EAF1FB]" />
    </div>
  );
}

export function CheckoutView({ bookingId }: { bookingId: string }) {
  const t = useTranslations('checkout');
  const locale = useLocale() as 'ar' | 'en';
  const router = useRouter();

  const [booking, setBooking] = useState<CheckoutBookingView | null>(null);
  const [payment, setPayment] = useState<PaymentSummary | null>(null);
  const [payConfig, setPayConfig] = useState<PaymentPublicConfig | null>(null);
  const [method, setMethod] = useState<PaymentMethod>('card');
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contactRequired, setContactRequired] = useState<ContactRequiredFields | null>(null);
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [managedFormResetKey, setManagedFormResetKey] = useState(0);
  const [preferHostedFallback, setPreferHostedFallback] = useState(false);
  const [saveCard, setSaveCard] = useState(false);
  const [savedMethods, setSavedMethods] = useState<SavedPaymentMethodPublic[]>([]);
  const [paymentSource, setPaymentSource] = useState<string>('new');
  /** CB-6 — UI-only until Pay; never PATCHes collection mode on radio click. */
  const [initialPaymentChoice, setInitialPaymentChoice] =
    useState<InitialPaymentChoice>('deposit');
  const [legalAck, setLegalAck] = useState<BookingLegalAckState | null>(null);
  const [planRevalidatedNotice, setPlanRevalidatedNotice] = useState<string | null>(null);
  const { status: legalStatus } = useMyLegalStatus();
  const managedPayLockRef = useRef(false);
  const managedIdempotencyRef = useRef<string | null>(null);
  const savedCardIdempotencyRef = useRef<string | null>(null);

  async function handlePaymentPlanUpdated(e: PaymentApiError): Promise<boolean> {
    if (e.code !== 'PAYMENT_PLAN_UPDATED') return false;
    setPlanRevalidatedNotice(t('fullPaymentRequiredWithin72h'));
    setInitialPaymentChoice('full');
    setError(t('fullPaymentRequiredWithin72h'));
    await load();
    return true;
  }

  function notePlanRevalidated(payment: PaymentSummary) {
    if (payment.paymentPlanRevalidated?.code === 'FULL_PAYMENT_REQUIRED_WITHIN_72H') {
      setPlanRevalidatedNotice(t('fullPaymentRequiredWithin72h'));
    }
  }

  function applyPaymentContactError(e: unknown): boolean {
    if (!(e instanceof PaymentApiError)) return false;
    if (e.code === 'PAYMENT_CONTACT_EMAIL_UNAVAILABLE') {
      setError(t('paymentContactEmailUnavailable'));
      return true;
    }
    if (e.code === 'PAYMENT_CONTACT_REQUIRED') {
      const details = e.details as { requiredFields?: ContactRequiredFields } | undefined;
      const fields = details?.requiredFields?.filter((f) => f === 'email' || f === 'phone') ?? [
        'email',
      ];
      setContactRequired(fields.length ? fields : ['email']);
      setError(null);
      return true;
    }
    return false;
  }

  function assertCheckoutLegalReady(): boolean {
    if (!legalAck?.isValid) {
      setError(t('legalAckRequired'));
      return false;
    }
    if (contractualActionsBlocked(legalStatus)) {
      router.push(legalAcceptHref(`/checkout/${bookingId}`));
      return false;
    }
    return true;
  }

  async function ensureBookingLegalAck(): Promise<boolean> {
    if (!assertCheckoutLegalReady() || !legalAck?.versionIds) return false;
    try {
      await ackBookingLegal(bookingId, {
        acceptedDocumentVersionIds: legalAck.versionIds,
      });
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : t('legalAckRequired'));
      return false;
    }
  }

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [configRes, res] = await Promise.all([
        fetchPaymentConfig(),
        fetchCheckoutBooking(bookingId),
      ]);
      setPayConfig(configRes.data);
      setBooking(res.data);
      setPayment(res.data.payment);
      setSaveCard(false);

      if (res.data.initialPaymentOptions?.length) {
        const locked = res.data.initialPaymentChoiceLocked
          ? res.data.lockedInitialPaymentChoice
          : null;
        setInitialPaymentChoice(
          locked ??
            res.data.defaultInitialPaymentChoice ??
            'deposit',
        );
      }

      if (configRes.data.savedCardChargeEnabled || configRes.data.savedCardsEnabled) {
        try {
          const methods = await listMyPaymentMethods();
          const usable = methods.data.filter((m) => !m.expired);
          setSavedMethods(usable);
          const defaultId = usable.find((m) => m.isDefault)?.id ?? usable[0]?.id;
          if (configRes.data.savedCardChargeEnabled && defaultId) {
            setPaymentSource(defaultId);
          } else {
            setPaymentSource('new');
          }
        } catch {
          setSavedMethods([]);
          setPaymentSource('new');
        }
      } else {
        setSavedMethods([]);
        setPaymentSource('new');
      }

      const canCreateIntent =
        configRes.data.simulateEnabled ||
        (configRes.data.livePaymentsEnabled && configRes.data.provider !== 'test');

      const duePurpose = res.data.duePurpose;
      // CB-4: do not pre-create HPP/simulate intents when Managed Form owns Pay.
      // CB-6: do not pre-create when Deposit/Full choice is available (no Payment until Pay).
      const managedUi = configRes.data.paymentUiMode === 'managed_form';
      const hasAmountChoice = Boolean(res.data.initialPaymentOptions?.length);
      const needsIntent =
        Boolean(duePurpose) &&
        !res.data.isFullyPaid &&
        canCreateIntent &&
        configRes.data.simulateEnabled &&
        !managedUi &&
        !hasAmountChoice;

      const activeMatches =
        res.data.payment &&
        ['initiated', 'pending'].includes(res.data.payment.status) &&
        (res.data.payment.purpose === duePurpose || !duePurpose);

      if (needsIntent && !activeMatches && duePurpose) {
        try {
          const intent = await createPaymentIntent({
            bookingId,
            method,
            purpose: duePurpose,
          });
          setPayment(intent.data);
        } catch (intentErr) {
          /* Live PayTabs may need JIT contact; simulate path can create intent on click. */
          applyPaymentContactError(intentErr);
        }
      } else if (activeMatches) {
        setPayment(res.data.payment);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t('loadError'));
    } finally {
      setLoading(false);
    }
  }, [bookingId, method, t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function ensureSimulatePayment(): Promise<PaymentSummary> {
    if (payment) return payment;
    const duePurpose = booking?.duePurpose;
    if (!duePurpose && !booking?.initialPaymentOptions?.length) {
      throw new Error(t('payError'));
    }
    const intent = await createPaymentIntent({
      bookingId,
      method,
      ...(booking?.initialPaymentOptions?.length
        ? { initialPaymentChoice }
        : duePurpose
          ? { purpose: duePurpose }
          : {}),
    });
    setPayment(intent.data);
    return intent.data;
  }

  async function handleSimulateSuccess() {
    setActing(true);
    setError(null);
    try {
      if (!(await ensureBookingLegalAck())) return;
      const pay = await ensureSimulatePayment();
      await simulatePaymentSuccess(pay.id);
      router.push('/account/bookings');
      router.refresh();
    } catch (e) {
      if (applyPaymentContactError(e)) return;
      setError(e instanceof Error ? e.message : t('payError'));
    } finally {
      setActing(false);
    }
  }

  async function handleSimulateFailure() {
    setActing(true);
    setError(null);
    try {
      if (!(await ensureBookingLegalAck())) return;
      const pay = await ensureSimulatePayment();
      await simulatePaymentFailure(pay.id);
      setError(t('paymentFailed'));
      await load();
    } catch (e) {
      if (applyPaymentContactError(e)) return;
      setError(e instanceof Error ? e.message : t('payError'));
    } finally {
      setActing(false);
    }
  }

  async function handlePaytabsCheckout(opts?: { withContact?: boolean }) {
    setActing(true);
    setError(null);
    try {
      if (!(await ensureBookingLegalAck())) return;
      const duePurpose = booking?.duePurpose;
      if (!duePurpose && !booking?.initialPaymentOptions?.length) {
        throw new Error(t('payError'));
      }
      const payload: Parameters<typeof createPaymentIntent>[0] = {
        bookingId,
        method: 'card',
        ...(booking?.initialPaymentOptions?.length
          ? { initialPaymentChoice }
          : duePurpose
            ? { purpose: duePurpose }
            : {}),
      };
      if (opts?.withContact || contactRequired) {
        if (contactRequired?.includes('email') || contactEmail.trim()) {
          payload.contactEmail = contactEmail.trim();
        }
        if (contactRequired?.includes('phone') || contactPhone.trim()) {
          payload.contactPhone = contactPhone.trim();
        }
      }
      const intent = await createPaymentIntent(payload);
      setPayment(intent.data);
      notePlanRevalidated(intent.data);
      setContactRequired(null);
      if (intent.data.redirectUrl) {
        window.location.assign(intent.data.redirectUrl);
        return;
      }
      setError(t('payError'));
    } catch (e) {
      if (e instanceof PaymentApiError && e.code === 'HOLD_EXPIRED') {
        setError(t('holdExpiredTitle'));
        await load();
        return;
      }
      if (e instanceof PaymentApiError && (await handlePaymentPlanUpdated(e))) return;
      if (e instanceof PaymentApiError && e.code === 'PAYMENT_CHOICE_LOCKED') {
        setError(t('verifyingPayment'));
        await load();
        return;
      }
      if (applyPaymentContactError(e)) return;
      setError(e instanceof Error ? e.message : t('payError'));
    } finally {
      setActing(false);
    }
  }

  async function handleManagedFormToken(paymentToken: string) {
    if (managedPayLockRef.current) return;
    managedPayLockRef.current = true;
    setActing(true);
    setError(null);
    try {
      if (!(await ensureBookingLegalAck())) return;
      if (!managedIdempotencyRef.current) {
        managedIdempotencyRef.current = `mf_${bookingId.slice(0, 8)}_${Date.now().toString(36)}`;
      }
      const payload: Parameters<typeof createManagedFormPayment>[0] = {
        bookingId,
        paymentToken,
        idempotencyKey: managedIdempotencyRef.current,
        ...(saveCard ? { saveCard: true } : {}),
        ...(booking?.initialPaymentOptions?.length
          ? { initialPaymentChoice }
          : {}),
      };
      if (contactRequired) {
        if (contactRequired.includes('email') || contactEmail.trim()) {
          payload.contactEmail = contactEmail.trim();
        }
        if (contactRequired.includes('phone') || contactPhone.trim()) {
          payload.contactPhone = contactPhone.trim();
        }
      }
      const result = await createManagedFormPayment(payload);
      setPayment(result.data);
      notePlanRevalidated(result.data);
      setContactRequired(null);

      if (result.data.managedFormOutcome === 'declined' || result.data.status === 'failed') {
        managedIdempotencyRef.current = null;
        setManagedFormResetKey((k) => k + 1);
        await load();
        setError(t('paymentDeclined'));
        return;
      }

      if (result.data.redirectUrl) {
        window.location.assign(result.data.redirectUrl);
        return;
      }

      if (result.data.managedFormOutcome === 'authorised' || result.data.status === 'succeeded') {
        router.push(`/checkout/${bookingId}/return?paymentId=${result.data.id}`);
        router.refresh();
        return;
      }

      setError(t('verifyingPayment'));
      router.push(`/checkout/${bookingId}/return?paymentId=${result.data.id}`);
    } catch (e) {
      if (e instanceof PaymentApiError && e.code === 'HOLD_EXPIRED') {
        setError(t('holdExpiredTitle'));
        managedIdempotencyRef.current = null;
        setManagedFormResetKey((k) => k + 1);
        await load();
        return;
      }
      if (e instanceof PaymentApiError && (await handlePaymentPlanUpdated(e))) {
        managedIdempotencyRef.current = null;
        setManagedFormResetKey((k) => k + 1);
        return;
      }
      if (e instanceof PaymentApiError && e.code === 'PAYMENT_CHOICE_LOCKED') {
        setError(t('verifyingPayment'));
        managedIdempotencyRef.current = null;
        setManagedFormResetKey((k) => k + 1);
        await load();
        return;
      }
      if (e instanceof PaymentApiError && e.code === 'PAYMENT_STATUS_UNKNOWN') {
        setError(t('verifyingPayment'));
        router.push(`/checkout/${bookingId}/return`);
        return;
      }
      if (applyPaymentContactError(e)) {
        managedIdempotencyRef.current = null;
        setManagedFormResetKey((k) => k + 1);
        return;
      }
      setError(e instanceof Error ? e.message : t('payError'));
      managedIdempotencyRef.current = null;
      setManagedFormResetKey((k) => k + 1);
    } finally {
      setActing(false);
      managedPayLockRef.current = false;
    }
  }

  async function handleSavedCardPay() {
    if (managedPayLockRef.current) return;
    if (!paymentSource || paymentSource === 'new') return;
    managedPayLockRef.current = true;
    setActing(true);
    setError(null);
    try {
      if (!(await ensureBookingLegalAck())) return;
      if (!savedCardIdempotencyRef.current) {
        savedCardIdempotencyRef.current = `sc_${bookingId.slice(0, 8)}_${Date.now().toString(36)}`;
      }
      const payload: Parameters<typeof createSavedCardPayment>[0] = {
        bookingId,
        savedPaymentMethodId: paymentSource,
        idempotencyKey: savedCardIdempotencyRef.current,
        ...(booking?.initialPaymentOptions?.length
          ? { initialPaymentChoice }
          : {}),
      };
      if (contactRequired) {
        if (contactRequired.includes('email') || contactEmail.trim()) {
          payload.contactEmail = contactEmail.trim();
        }
        if (contactRequired.includes('phone') || contactPhone.trim()) {
          payload.contactPhone = contactPhone.trim();
        }
      }
      const result = await createSavedCardPayment(payload);
      setPayment(result.data);
      setContactRequired(null);

      if (
        result.data.savedCardOutcome === 'declined' ||
        result.data.savedCardOutcome === 'invalid_token' ||
        result.data.status === 'failed'
      ) {
        savedCardIdempotencyRef.current = null;
        await load();
        setError(
          result.data.savedCardOutcome === 'invalid_token'
            ? t('savedCardInvalid')
            : t('paymentDeclined'),
        );
        return;
      }

      if (result.data.redirectUrl) {
        window.location.assign(result.data.redirectUrl);
        return;
      }

      if (result.data.savedCardOutcome === 'authorised' || result.data.status === 'succeeded') {
        router.push(`/checkout/${bookingId}/return?paymentId=${result.data.id}`);
        router.refresh();
        return;
      }

      setError(t('verifyingPayment'));
      router.push(`/checkout/${bookingId}/return?paymentId=${result.data.id}`);
    } catch (e) {
      if (e instanceof PaymentApiError && e.code === 'HOLD_EXPIRED') {
        setError(t('holdExpiredTitle'));
        savedCardIdempotencyRef.current = null;
        await load();
        return;
      }
      if (e instanceof PaymentApiError && (await handlePaymentPlanUpdated(e))) {
        savedCardIdempotencyRef.current = null;
        return;
      }
      if (e instanceof PaymentApiError && e.code === 'PAYMENT_CHOICE_LOCKED') {
        setError(t('verifyingPayment'));
        savedCardIdempotencyRef.current = null;
        await load();
        return;
      }
      if (e instanceof PaymentApiError && e.code === 'PAYMENT_STATUS_UNKNOWN') {
        setError(t('verifyingPayment'));
        router.push(`/checkout/${bookingId}/return`);
        return;
      }
      if (e instanceof PaymentApiError && e.code === 'SAVED_CARD_EXPIRED') {
        setError(t('savedCardExpired'));
        savedCardIdempotencyRef.current = null;
        await load();
        return;
      }
      if (applyPaymentContactError(e)) {
        savedCardIdempotencyRef.current = null;
        return;
      }
      setError(e instanceof Error ? e.message : t('payError'));
      savedCardIdempotencyRef.current = null;
    } finally {
      setActing(false);
      managedPayLockRef.current = false;
    }
  }

  if (loading) return <CheckoutSkeleton />;

  if (error && !booking) {
    return (
      <div className="mx-auto max-w-lg space-y-3 rounded-[18px] border border-danger/20 bg-danger/10 px-4 py-5">
        <p className="text-danger" role="alert">
          {error}
        </p>
        <Button asChild variant="outline">
          <Link href="/account/bookings">{t('viewBookings')}</Link>
        </Button>
      </div>
    );
  }

  if (!booking) return null;

  if (booking.status === 'pending_owner_approval') {
    return (
      <div
        data-testid="checkout-page"
        data-checkout-state="pending_owner_approval"
        className="mx-auto max-w-lg space-y-4"
      >
        <h1 className="text-[22px] font-bold text-[#0D2046]">{t('title')}</h1>
        <div className="rounded-[18px] border border-[#E0E8F3] bg-white px-4 py-5 shadow-sm">
          <h2 className="text-[16px] font-bold text-[#0D2046]">{t('awaitingOwnerApprovalTitle')}</h2>
          <p className="mt-2 text-[13px] text-[#53637A]">{t('awaitingOwnerApprovalBody')}</p>
          {booking.ownerApprovalExpiresAt ? (
            <p className="mt-2 text-[12px] text-[#8794A7]">
              {formatPlatformDateTime(booking.ownerApprovalExpiresAt, locale, booking.timeZone)}
            </p>
          ) : null}
          <Button asChild className="mt-4 w-full rounded-[12px] bg-[#2F6EF6]">
            <Link href="/account/bookings">{t('viewBookings')}</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (booking.status === 'expired' || booking.status === 'cancelled') {
    return (
      <div
        data-testid="checkout-page"
        data-checkout-state={booking.status}
        className="mx-auto max-w-lg space-y-4"
      >
        <h1 className="text-[22px] font-bold text-[#0D2046]">{t('title')}</h1>
        <div className="rounded-[18px] border border-[#E0E8F3] bg-white px-4 py-5">
          <h2 className="text-[16px] font-bold text-[#0D2046]">
            {booking.status === 'expired' ? t('holdExpiredTitle') : t(`bookingStatus.${booking.status}`)}
          </h2>
          <p className="mt-2 text-[13px] text-[#53637A]">
            {booking.status === 'expired' ? t('holdExpiredBody') : t('bookingUnavailableBody')}
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Button asChild className="flex-1 rounded-[12px] bg-[#2F6EF6]">
              <Link href={`/properties/${booking.propertySlug}/book`}>{t('chooseAgain')}</Link>
            </Button>
            <Button asChild variant="outline" className="flex-1 rounded-[12px]">
              <Link href="/account/bookings">{t('viewBookings')}</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const isFullyPaid = booking.isFullyPaid === true;
  const showSimulate = payConfig?.simulateEnabled === true;
  const paymentUiMode =
    preferHostedFallback || payConfig?.paymentUiMode !== 'managed_form'
      ? 'hosted_redirect'
      : 'managed_form';
  const managedFormEnabled = paymentUiMode === 'managed_form';
  const liveHosted =
    payConfig?.livePaymentsEnabled === true &&
    (payConfig.provider === 'paytabs' || payConfig.provider === 'card_gateway');
  const managedFormPayable =
    managedFormEnabled &&
    (liveHosted || payConfig?.managedFormMock === true || showSimulate);
  const holdExpiredClient =
    booking.status === 'pending_payment' &&
    Boolean(booking.holdExpiresAt) &&
    new Date(booking.holdExpiresAt!).getTime() <= Date.now();
  const amountOptions = booking.initialPaymentOptions ?? null;
  const selectedOption =
    amountOptions?.find((o) => o.choice === initialPaymentChoice) ?? amountOptions?.[0] ?? null;
  const displayDueNow = selectedOption?.dueNowAmount ?? booking.dueNowAmount;
  const displayDuePurpose =
    selectedOption?.choice === 'full'
      ? 'full'
      : selectedOption?.choice === 'deposit'
        ? 'deposit'
        : booking.duePurpose;
  const awaitingPay =
    Boolean(displayDuePurpose || booking.duePurpose) && !isFullyPaid && !holdExpiredClient;
  const showLiveNotReady =
    !showSimulate &&
    !payConfig?.livePaymentsEnabled &&
    !payConfig?.managedFormMock &&
    awaitingPay;
  const isBalance = booking.duePurpose === 'balance';
  const payCtaLabel = isBalance
    ? t('payBalanceCta', {
        amount: formatPrice(displayDueNow, booking.currency, locale),
      })
    : t('payAmountCta', {
        amount: formatPrice(displayDueNow, booking.currency, locale),
      });
  const choiceLocked = booking.initialPaymentChoiceLocked === true;

  return (
    <div
      data-testid="checkout-page"
      data-checkout-state={holdExpiredClient ? 'expired' : booking.status}
      className="mx-auto max-w-5xl pb-28 lg:pb-8"
    >
      <header className="mb-4 text-start">
        <h1 className="text-[22px] font-bold text-[#0D2046] sm:text-[24px]">{t('title')}</h1>
        <p className="mt-1 text-[12px] text-[#53637A]">{t('subtitle')}</p>
      </header>

      {showSimulate && (
        <div className="mb-3 rounded-[14px] border border-amber-300/50 bg-amber-50 px-4 py-3 text-[12px] text-amber-900">
          <div className="flex gap-2">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <p>{t('devNotice')}</p>
          </div>
        </div>
      )}

      {showLiveNotReady && (
        <div
          data-testid="checkout-live-not-ready"
          className="mb-3 rounded-[14px] border border-primary/20 bg-primary-soft/30 px-4 py-3 text-[12px] text-navy"
        >
          <div className="flex gap-2">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <p>{t('liveNotEnabled')}</p>
          </div>
        </div>
      )}

      {holdExpiredClient && (
        <div
          data-testid="checkout-hold-expired"
          className="mb-3 rounded-[14px] border border-danger/20 bg-danger/10 px-4 py-3 text-[13px] text-danger"
        >
          <p className="font-bold">{t('holdExpiredTitle')}</p>
          <p className="mt-1">{t('holdExpiredBody')}</p>
          <Button asChild className="mt-3 rounded-[12px] bg-[#2F6EF6]">
            <Link href={`/properties/${booking.propertySlug}/book`}>{t('chooseAgain')}</Link>
          </Button>
        </div>
      )}

      {planRevalidatedNotice && (
        <p
          className="mb-3 rounded-[14px] border border-primary/20 bg-primary/5 px-4 py-3 text-[13px] text-navy"
          role="status"
          data-testid="checkout-plan-revalidated"
        >
          {planRevalidatedNotice}
        </p>
      )}

      {error && (
        <p
          className="mb-3 rounded-[14px] border border-danger/20 bg-danger/10 px-4 py-3 text-[13px] text-danger"
          role="alert"
        >
          {error}
        </p>
      )}

      {booking.holdExpiresAt &&
      booking.status === 'pending_payment' &&
      awaitingPay ? (
        <div className="mb-3">
          <CheckoutHoldBanner holdExpiresAt={booking.holdExpiresAt} locale={locale} />
        </div>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-start lg:gap-5">
        <div className="space-y-3">
          <CheckoutPropertySummary booking={booking} />
          <CheckoutBookingDetails booking={booking} />
          {awaitingPay && amountOptions && amountOptions.length >= 2 ? (
            <CheckoutInitialPaymentChoice
              options={amountOptions}
              value={initialPaymentChoice}
              locked={choiceLocked}
              currency={booking.currency}
              onChange={(choice) => {
                if (choiceLocked || choice === initialPaymentChoice) return;
                setInitialPaymentChoice(choice);
                // Selection must not create Payment rows or mutate collection mode.
                managedIdempotencyRef.current = null;
                savedCardIdempotencyRef.current = null;
                setPayment(null);
              }}
            />
          ) : null}
          {((liveHosted && !managedFormEnabled) || (managedFormPayable && liveHosted)) &&
          awaitingPay &&
          contactRequired ? (
            <CheckoutPaymentContact
              fields={contactRequired}
              email={contactEmail}
              phone={contactPhone}
              acting={acting}
              onEmailChange={setContactEmail}
              onPhoneChange={setContactPhone}
              onContinue={() => {
                setContactRequired(null);
                if (!managedFormEnabled) {
                  void handlePaytabsCheckout({ withContact: true });
                }
              }}
            />
          ) : null}
          {awaitingPay ? (
            <CheckoutPaymentMethod
              mode={managedFormPayable ? 'managed_form' : 'hosted_redirect'}
              managedForm={
                managedFormPayable
                  ? {
                      clientKey: payConfig?.paytabsClientKey || 'mock_client_key',
                      paylibScriptUrl: payConfig?.paylibScriptUrl ?? null,
                      managedFormMock: payConfig?.managedFormMock === true || showSimulate,
                      disabled: holdExpiredClient,
                      acting,
                      payCtaLabel,
                      processingLabel: t('processingPayment'),
                      formResetKey: managedFormResetKey,
                      onTokenized: handleManagedFormToken,
                      onUseHostedFallback: () => setPreferHostedFallback(true),
                      savedCardsEnabled: payConfig?.savedCardsEnabled === true,
                      saveCard,
                      onSaveCardChange: setSaveCard,
                      savedCardChargeEnabled: payConfig?.savedCardChargeEnabled === true,
                      savedCardChargeMode: payConfig?.savedCardChargeMode ?? null,
                      selectedPaymentSource: paymentSource,
                      onSelectPaymentSource: setPaymentSource,
                      onPaySavedCard: handleSavedCardPay,
                      savedCards: savedMethods.map((m) => {
                        const mm = m.expiryMonth
                          ? String(m.expiryMonth).padStart(2, '0')
                          : null;
                        const yy = m.expiryYear
                          ? m.expiryYear >= 100
                            ? String(m.expiryYear).slice(-2)
                            : String(m.expiryYear).padStart(2, '0')
                          : null;
                        return {
                          id: m.id,
                          brand: m.brand,
                          label:
                            m.maskedDisplay?.trim() ||
                            (m.brand && m.last4
                              ? `${m.brand} •••• ${m.last4}`
                              : m.last4
                                ? `•••• ${m.last4}`
                                : m.brand || 'Card'),
                          expiryLabel: mm && yy ? `${mm}/${yy}` : null,
                          isDefault: m.isDefault,
                        };
                      }),
                    }
                  : undefined
              }
            />
          ) : null}
        </div>

        <div className="space-y-3 lg:sticky lg:top-24">
          <CheckoutPaymentSummary
            booking={booking}
            selectedInitialChoice={amountOptions ? initialPaymentChoice : null}
          />

          {awaitingPay ? (
            <div className="rounded-[18px] border border-[#E0E8F3] bg-white px-3.5 py-3 shadow-[0_6px_18px_rgba(47,90,150,.06)]">
              <BookingLegalAck
                testIdPrefix="checkout-legal"
                summary={{
                  depositPercent: DEPOSIT_PERCENT,
                  freeCancelUntilHours: CANCELLATION_FREE_UNTIL_HOURS,
                  balanceDueHoursBeforeStart: BALANCE_DUE_HOURS_BEFORE_START,
                  showCancelTiers: true,
                  amountDueNow: displayDueNow,
                  currency: booking.currency,
                  remainingBalance:
                    displayDuePurpose === 'deposit'
                      ? (selectedOption?.remainingAfterPayment ??
                        booking.remainingAmount ??
                        null)
                      : null,
                  balanceDueAtIso:
                    displayDuePurpose === 'deposit' || displayDuePurpose === 'balance'
                      ? (booking.balanceDueAt ?? null)
                      : null,
                  showDepositDisclosure: displayDuePurpose === 'deposit',
                  showFullPaymentDisclosure:
                    displayDuePurpose === 'full' ||
                    selectedOption?.choice === 'full' ||
                    booking.paymentCollectionMode === 'full',
                }}
                disabled={acting}
                onChange={setLegalAck}
              />
              <FirstRunLegalGate enforceOnPaths={['/checkout']} />

              {showSimulate && (
                <>
                  <div className="mt-3 space-y-2">
                    <p className="text-[12px] font-medium text-[#0D2046]">{t('chooseMethod')}</p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant={method === 'card' ? 'default' : 'outline'}
                        onClick={() => setMethod('card')}
                      >
                        <CreditCard className="h-4 w-4" />
                        {t('methodCard')}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={method === 'cliq' ? 'default' : 'outline'}
                        onClick={() => setMethod('cliq')}
                      >
                        <Smartphone className="h-4 w-4" />
                        {t('methodCliq')}
                      </Button>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <Button
                      className="flex-1 rounded-[12px]"
                      data-testid="checkout-simulate-success"
                      disabled={acting}
                      onClick={() => void handleSimulateSuccess()}
                    >
                      {acting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                      {t('simulateSuccess')}
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 rounded-[12px]"
                      data-testid="checkout-simulate-failure"
                      disabled={acting}
                      onClick={() => void handleSimulateFailure()}
                    >
                      {t('simulateFailure')}
                    </Button>
                  </div>
                </>
              )}

              {liveHosted && !contactRequired && !managedFormPayable && (
                <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#E0E8F3] bg-white/95 px-3 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur lg:static lg:mt-3 lg:border-0 lg:bg-transparent lg:p-0 lg:pb-0 lg:backdrop-blur-none">
                  <Button
                    className="h-[46px] w-full rounded-[12px] bg-[linear-gradient(90deg,#2F6EF6_0%,#4B8CFF_100%)] text-[14px] font-semibold shadow-[0_8px_16px_rgba(47,110,246,.22)]"
                    data-testid="checkout-paytabs-pay"
                    disabled={acting}
                    onClick={() => void handlePaytabsCheckout()}
                  >
                    {acting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t('preparingSecurePayment')}
                      </>
                    ) : (
                      <>
                        <CreditCard className="h-4 w-4" />
                        {payCtaLabel}
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          ) : null}

          {isFullyPaid && (
            <Button asChild className="w-full rounded-[12px] bg-[#2F6EF6]">
              <Link href="/account/bookings">{t('viewBookings')}</Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
