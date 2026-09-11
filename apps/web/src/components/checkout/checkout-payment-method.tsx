'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { CreditCard, Loader2, Lock, RefreshCw, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import {
  extractPaylibToken,
  installManagedFormPaylibMock,
  loadPaylibScript,
  mapPaylibErrorToField,
  type PaylibApi,
} from '@/lib/paylib';

export type ManagedFormFieldErrors = {
  number?: string;
  expiry?: string;
  cvv?: string;
  form?: string;
};

export type CheckoutSavedCardOption = {
  id: string;
  brand: string | null;
  label: string;
  expiryLabel: string | null;
  isDefault?: boolean;
};

type Props = {
  clientKey: string;
  paylibScriptUrl: string | null;
  managedFormMock: boolean;
  disabled?: boolean;
  acting?: boolean;
  payCtaLabel: string;
  processingLabel: string;
  onTokenized: (paymentToken: string) => void | Promise<void>;
  onUseHostedFallback?: () => void;
  /** Clear CVV after failed attempts — parent can bump to remount. */
  formResetKey?: string | number;
  /** CB-5A — show save-card opt-in when server capability is on. Default unchecked. */
  savedCardsEnabled?: boolean;
  saveCard?: boolean;
  onSaveCardChange?: (checked: boolean) => void;
  /**
   * CB-5B — when charging is enabled and cards exist, show selectable rows.
   * `new` = Managed Form path.
   */
  savedCardChargeEnabled?: boolean;
  savedCards?: CheckoutSavedCardOption[];
  selectedPaymentSource?: string; // saved method id or 'new'
  onSelectPaymentSource?: (source: string) => void;
  /** ecom_cvv_redirect transparency notice when a saved card is selected. */
  savedCardChargeMode?: 'ecom_cvv_redirect' | 'recurring_direct' | null;
  onPaySavedCard?: () => void | Promise<void>;
};

/**
 * CB-4 native Mazare3 card form + CB-5B saved-card selector.
 * Sensitive inputs use data-paylib only — never name= for PAN/CVV/expiry.
 * Saved-card path never collects CVV inside Mazare3.
 */
export function CheckoutPaymentMethod(props: {
  mode: 'hosted_redirect' | 'managed_form';
  managedForm?: Props;
}) {
  const t = useTranslations('checkout');

  if (props.mode === 'managed_form' && props.managedForm) {
    return <ManagedFormCardSurface {...props.managedForm} />;
  }

  return (
    <section
      data-testid="checkout-payment-method"
      data-payment-ui-mode="hosted_redirect"
      className="rounded-[18px] border border-[#E0E8F3] bg-white px-3.5 py-3 shadow-[0_6px_18px_rgba(47,90,150,.06)] sm:px-4"
    >
      <h2 className="text-[13px] font-bold text-[#0D2046]">{t('paymentMethodTitle')}</h2>
      <div className="mt-2.5 flex items-center gap-3 rounded-[14px] border border-[#2F6EF6]/35 bg-[#F3F8FF] px-3 py-2.5">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#2F6EF6] shadow-sm">
          <CreditCard className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0 text-start">
          <p className="text-[13px] font-bold text-[#0D2046]">{t('methodBankCard')}</p>
          <p className="text-[11px] text-[#53637A]">{t('methodBankCardHint')}</p>
        </div>
      </div>
    </section>
  );
}

function ManagedFormCardSurface({
  clientKey,
  paylibScriptUrl,
  managedFormMock,
  disabled,
  acting,
  payCtaLabel,
  processingLabel,
  onTokenized,
  onUseHostedFallback,
  formResetKey = 0,
  savedCardsEnabled = false,
  saveCard = false,
  onSaveCardChange,
  savedCardChargeEnabled = false,
  savedCards = [],
  selectedPaymentSource = 'new',
  onSelectPaymentSource,
  savedCardChargeMode = null,
  onPaySavedCard,
}: Props) {
  const t = useTranslations('checkout');
  const formId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const paylibBoundRef = useRef(false);
  const onTokenizedRef = useRef(onTokenized);
  onTokenizedRef.current = onTokenized;
  const [scriptState, setScriptState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [fieldErrors, setFieldErrors] = useState<ManagedFormFieldErrors>({});
  const [localActing, setLocalActing] = useState(false);
  const busy = Boolean(acting || localActing || disabled);
  const showSelector = savedCardChargeEnabled && savedCards.length > 0;
  const useNewCard = !showSelector || selectedPaymentSource === 'new';
  const selectedSaved = showSelector
    ? savedCards.find((c) => c.id === selectedPaymentSource)
    : undefined;

  useEffect(() => {
    if (!useNewCard) return;
    let cancelled = false;
    paylibBoundRef.current = false;

    async function boot() {
      setScriptState('loading');
      try {
        let api: PaylibApi;
        if (managedFormMock || !paylibScriptUrl) {
          api = installManagedFormPaylibMock();
        } else {
          api = await loadPaylibScript(paylibScriptUrl);
        }
        if (cancelled) return;
        const form = formRef.current;
        if (!form || paylibBoundRef.current) {
          setScriptState('ready');
          return;
        }
        api.inlineForm({
          key: clientKey,
          form,
          autoSubmit: false,
          callback: (response) => {
            void (async () => {
              if (response.error) {
                const mapped = mapPaylibErrorToField(response);
                setFieldErrors({
                  [mapped.field ?? 'form']: t(mapped.messageKey as 'cardNumberInvalid'),
                });
                setLocalActing(false);
                return;
              }
              const token = extractPaylibToken(response, form);
              if (!token) {
                setFieldErrors({ form: t('cardTokenizeFailed') });
                setLocalActing(false);
                return;
              }
              try {
                await onTokenizedRef.current(token);
              } finally {
                setLocalActing(false);
                const cvv = form.querySelector<HTMLInputElement>('[data-paylib="cvv"]');
                if (cvv) cvv.value = '';
              }
            })();
          },
        });
        paylibBoundRef.current = true;
        setScriptState('ready');
      } catch {
        if (!cancelled) setScriptState('error');
      }
    }

    void boot();
    return () => {
      cancelled = true;
    };
  }, [clientKey, paylibScriptUrl, managedFormMock, formResetKey, t, useNewCard]);

  function retryScript() {
    paylibBoundRef.current = false;
    setScriptState('loading');
    setFieldErrors({});
  }

  return (
    <section
      data-testid="checkout-payment-method"
      data-payment-ui-mode="managed_form"
      className="rounded-[18px] border border-[#E0E8F3] bg-white px-3.5 py-3 shadow-[0_6px_18px_rgba(47,90,150,.06)] sm:px-4"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[13px] font-bold text-[#0D2046]">{t('cardPayTitle')}</h2>
        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[#53637A]">
          <Shield className="h-3.5 w-3.5 text-[#2F6EF6]" aria-hidden />
          {t('cardSecureBadge')}
        </span>
      </div>

      {savedCardsEnabled && !savedCardChargeEnabled && savedCards.length > 0 ? (
        <div
          data-testid="checkout-saved-cards-preview"
          className="mt-3 rounded-[12px] border border-[#E0E8F3] bg-[#F8FBFF] px-3 py-2.5"
        >
          <p className="text-[12px] leading-relaxed text-[#53637A]">{t('savedCardsPreviewHint')}</p>
        </div>
      ) : null}

      {showSelector ? (
        <div className="mt-3 space-y-2" data-testid="checkout-saved-card-selector">
          {savedCards.map((card) => {
            const selected = selectedPaymentSource === card.id;
            return (
              <button
                key={card.id}
                type="button"
                data-testid="checkout-saved-card-option"
                data-method-id={card.id}
                disabled={busy}
                onClick={() => onSelectPaymentSource?.(card.id)}
                className={`flex w-full items-center gap-3 rounded-[12px] border px-3 py-2.5 text-start transition-colors ${
                  selected
                    ? 'border-[#2F6EF6] bg-[#F3F8FF]'
                    : 'border-[#E0E8F3] bg-white hover:border-[#2F6EF6]/40'
                }`}
              >
                <span
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                    selected ? 'border-[#2F6EF6]' : 'border-[#C5D0E0]'
                  }`}
                  aria-hidden
                >
                  {selected ? <span className="h-2 w-2 rounded-full bg-[#2F6EF6]" /> : null}
                </span>
                <CreditCard className="h-4 w-4 shrink-0 text-[#2F6EF6]" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold text-[#0D2046]">{card.label}</span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-[#53637A]">
                    {card.expiryLabel ? <span>{card.expiryLabel}</span> : null}
                    {card.isDefault ? (
                      <span className="font-medium text-[#2F6EF6]">{t('savedCardDefault')}</span>
                    ) : null}
                  </span>
                </span>
              </button>
            );
          })}
          <button
            type="button"
            data-testid="checkout-use-new-card"
            disabled={busy}
            onClick={() => onSelectPaymentSource?.('new')}
            className={`flex w-full items-center gap-3 rounded-[12px] border px-3 py-2.5 text-start transition-colors ${
              useNewCard
                ? 'border-[#2F6EF6] bg-[#F3F8FF]'
                : 'border-[#E0E8F3] bg-white hover:border-[#2F6EF6]/40'
            }`}
          >
            <span
              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                useNewCard ? 'border-[#2F6EF6]' : 'border-[#C5D0E0]'
              }`}
              aria-hidden
            >
              {useNewCard ? <span className="h-2 w-2 rounded-full bg-[#2F6EF6]" /> : null}
            </span>
            <span className="text-[13px] font-semibold text-[#0D2046]">{t('useNewCard')}</span>
          </button>
          <Link
            href="/account/payment-methods"
            data-testid="checkout-manage-payment-methods"
            className="inline-block text-[11px] font-semibold text-[#2F6EF6] hover:underline"
          >
            {t('managePaymentMethods')}
          </Link>
        </div>
      ) : null}

      {!useNewCard && selectedSaved ? (
        <div className="mt-3 space-y-3" data-testid="checkout-saved-card-pay">
          {savedCardChargeMode === 'ecom_cvv_redirect' ? (
            <p
              data-testid="checkout-saved-card-ecom-notice"
              className="rounded-[12px] border border-[#E0E8F3] bg-[#F8FBFF] px-3 py-2.5 text-[12px] leading-relaxed text-[#0D2046]"
            >
              {t('savedCardEcomNotice')}
            </p>
          ) : null}
          <Button
            type="button"
            data-testid="checkout-saved-card-pay-btn"
            disabled={busy}
            onClick={() => {
              void onPaySavedCard?.();
            }}
            className="h-[46px] w-full rounded-[12px] bg-[linear-gradient(90deg,#2F6EF6_0%,#4B8CFF_100%)] text-[14px] font-semibold shadow-[0_8px_16px_rgba(47,110,246,.22)]"
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {processingLabel}
              </>
            ) : (
              <>
                <CreditCard className="h-4 w-4" />
                {payCtaLabel}
              </>
            )}
          </Button>
        </div>
      ) : null}

      {useNewCard ? (
        <>
          {scriptState === 'loading' && (
            <p
              data-testid="checkout-paylib-loading"
              className="mt-3 flex items-center gap-2 text-[12px] text-[#53637A]"
            >
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('cardFormLoading')}
            </p>
          )}

          {scriptState === 'error' && (
            <div
              data-testid="checkout-paylib-error"
              className="mt-3 space-y-2 rounded-[12px] border border-danger/20 bg-danger/10 px-3 py-2.5"
            >
              <p className="text-[12px] text-danger">{t('cardFormLoadError')}</p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" onClick={retryScript}>
                  <RefreshCw className="h-3.5 w-3.5" />
                  {t('cardFormRetry')}
                </Button>
                {onUseHostedFallback ? (
                  <Button type="button" size="sm" variant="ghost" onClick={onUseHostedFallback}>
                    {t('useSecureHostedPage')}
                  </Button>
                ) : null}
              </div>
            </div>
          )}

          <form
            key={formResetKey}
            ref={formRef}
            id={formId}
            data-testid="checkout-managed-form"
            className="mt-3 space-y-3"
            action="#"
            method="post"
            onSubmit={(e) => {
              e.preventDefault();
              if (busy || scriptState !== 'ready') return;
              setFieldErrors({});
              setLocalActing(true);
            }}
          >
            <div>
              <label htmlFor={`${formId}-number`} className="text-[11px] font-semibold text-[#0D2046]">
                {t('cardNumberLabel')}
              </label>
              <div className="relative mt-1">
                <input
                  id={`${formId}-number`}
                  type="text"
                  inputMode="numeric"
                  autoComplete="cc-number"
                  data-paylib="number"
                  data-testid="checkout-card-number"
                  className="h-11 w-full rounded-[12px] border border-[#D7E2F0] bg-[#F8FBFF] px-3 pe-10 text-[14px] text-[#0D2046] outline-none focus:border-[#2F6EF6]"
                  disabled={busy || scriptState !== 'ready'}
                />
                <CreditCard
                  className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8794A7]"
                  aria-hidden
                />
              </div>
              {fieldErrors.number ? (
                <p className="mt-1 text-[11px] text-danger" role="alert">
                  {fieldErrors.number}
                </p>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[11px] font-semibold text-[#0D2046]">
                  {t('cardExpiryLabel')}
                </label>
                <div className="mt-1 flex gap-1.5">
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="cc-exp-month"
                    data-paylib="expmonth"
                    data-testid="checkout-card-expmonth"
                    placeholder={t('cardExpiryMonthPh')}
                    aria-label={t('cardExpiryMonthPh')}
                    className="h-11 w-full rounded-[12px] border border-[#D7E2F0] bg-[#F8FBFF] px-2 text-center text-[14px] outline-none focus:border-[#2F6EF6]"
                    disabled={busy || scriptState !== 'ready'}
                  />
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="cc-exp-year"
                    data-paylib="expyear"
                    data-testid="checkout-card-expyear"
                    placeholder={t('cardExpiryYearPh')}
                    aria-label={t('cardExpiryYearPh')}
                    className="h-11 w-full rounded-[12px] border border-[#D7E2F0] bg-[#F8FBFF] px-2 text-center text-[14px] outline-none focus:border-[#2F6EF6]"
                    disabled={busy || scriptState !== 'ready'}
                  />
                </div>
                {fieldErrors.expiry ? (
                  <p className="mt-1 text-[11px] text-danger" role="alert">
                    {fieldErrors.expiry}
                  </p>
                ) : null}
              </div>
              <div>
                <label htmlFor={`${formId}-cvv`} className="text-[11px] font-semibold text-[#0D2046]">
                  {t('cardCvvLabel')}
                </label>
                <input
                  id={`${formId}-cvv`}
                  type="password"
                  inputMode="numeric"
                  autoComplete="cc-csc"
                  data-paylib="cvv"
                  data-testid="checkout-card-cvv"
                  className="mt-1 h-11 w-full rounded-[12px] border border-[#D7E2F0] bg-[#F8FBFF] px-3 text-[14px] outline-none focus:border-[#2F6EF6]"
                  disabled={busy || scriptState !== 'ready'}
                />
                {fieldErrors.cvv ? (
                  <p className="mt-1 text-[11px] text-danger" role="alert">
                    {fieldErrors.cvv}
                  </p>
                ) : null}
              </div>
            </div>

            {fieldErrors.form ? (
              <p className="text-[12px] text-danger" role="alert" data-testid="checkout-card-form-error">
                {fieldErrors.form}
              </p>
            ) : null}

            {savedCardsEnabled ? (
              <label
                data-testid="checkout-save-card"
                className="flex cursor-pointer items-start gap-2 rounded-[12px] border border-[#E0E8F3] bg-[#F8FBFF] px-3 py-2.5"
              >
                <input
                  type="checkbox"
                  data-testid="checkout-save-card-checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-[#D7E2F0] text-[#2F6EF6]"
                  checked={saveCard}
                  disabled={busy}
                  onChange={(e) => onSaveCardChange?.(e.target.checked)}
                />
                <span className="text-[12px] leading-snug text-[#0D2046]">{t('saveCardLabel')}</span>
              </label>
            ) : null}

            <p className="flex items-center gap-1.5 text-[10px] text-[#8794A7]">
              <Lock className="h-3 w-3" aria-hidden />
              {t('cardPciHint')}
            </p>

            <Button
              type="submit"
              data-testid="checkout-managed-pay"
              disabled={busy || scriptState !== 'ready'}
              className="h-[46px] w-full rounded-[12px] bg-[linear-gradient(90deg,#2F6EF6_0%,#4B8CFF_100%)] text-[14px] font-semibold shadow-[0_8px_16px_rgba(47,110,246,.22)]"
            >
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {processingLabel}
                </>
              ) : (
                <>
                  <CreditCard className="h-4 w-4" />
                  {payCtaLabel}
                </>
              )}
            </Button>
          </form>
        </>
      ) : null}
    </section>
  );
}
