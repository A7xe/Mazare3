'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import {
  ArrowLeft,
  Clock3,
  CreditCard,
  Lightbulb,
  Loader2,
  Lock,
  MapPin,
  Phone,
  Search,
  Shield,
  Star,
  Trash2,
  Users,
} from 'lucide-react';
import type { SavedPaymentMethodPublic } from '@mazare3/shared';
import { Link, useRouter } from '@/i18n/navigation';
import { DEFAULT_PROFILE_AVATAR } from '@/components/layout/authenticated-top-header';
import {
  fetchAuthIdentities,
  getMe,
  type AuthUser,
} from '@/lib/api-auth';
import {
  listMyPaymentMethods,
  revokeMyPaymentMethod,
  setDefaultMyPaymentMethod,
} from '@/lib/api-payment-methods';
import { cn } from '@/lib/utils';

function formatExpiry(month: number | null, year: number | null): string | null {
  if (!month || !year) return null;
  const mm = String(month).padStart(2, '0');
  const yy = year >= 100 ? String(year).slice(-2) : String(year).padStart(2, '0');
  return `${mm}/${yy}`;
}

function displayLabel(m: SavedPaymentMethodPublic): string {
  if (m.maskedDisplay?.trim()) return m.maskedDisplay.trim();
  if (m.brand && m.last4) return `${m.brand} •••• ${m.last4}`;
  if (m.last4) return `•••• ${m.last4}`;
  if (m.brand) return m.brand;
  return 'Card';
}

function brandKind(brand: string | null): 'visa' | 'mastercard' | 'other' {
  const b = (brand ?? '').toLowerCase();
  if (b.includes('visa')) return 'visa';
  if (b.includes('master') || b.includes('mc')) return 'mastercard';
  return 'other';
}

function resolveUserAvatarUrl(user: AuthUser): string | null {
  const extended = user as AuthUser & { avatarUrl?: string | null; imageUrl?: string | null };
  const raw = (extended.avatarUrl ?? extended.imageUrl)?.trim();
  return raw || null;
}

function BrandMark({ brand }: { brand: string | null }) {
  const kind = brandKind(brand);
  if (kind === 'visa') {
    return (
      <span className="rounded bg-[#1A1F71] px-2 py-0.5 text-[10px] font-bold tracking-wide text-white">
        VISA
      </span>
    );
  }
  if (kind === 'mastercard') {
    return (
      <span className="flex items-center" aria-hidden>
        <span className="h-5 w-5 rounded-full bg-[#EB001B]" />
        <span className="-ms-2 h-5 w-5 rounded-full bg-[#F79E1B]/90" />
      </span>
    );
  }
  return <CreditCard className="h-5 w-5 text-[#2F6EF6]" aria-hidden />;
}

export function PaymentMethodsView() {
  const t = useTranslations('paymentMethods');
  const ta = useTranslations('accountHome.profileEdit');
  const locale = useLocale();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [items, setItems] = useState<SavedPaymentMethodPublic[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [phoneMasked, setPhoneMasked] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const me = await getMe();
      if (me.data.user.role !== 'customer') {
        router.push('/');
        return;
      }
      setUser(me.data.user);
      try {
        const idRes = await fetchAuthIdentities();
        setPhoneMasked(idRes.data.phone.linked ? idRes.data.phone.masked : null);
      } catch {
        setPhoneMasked(null);
      }
      const res = await listMyPaymentMethods();
      setItems(res.data);
    } catch {
      router.push('/auth?returnUrl=' + encodeURIComponent('/account/payment-methods'));
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleDefault(id: string) {
    setActingId(id);
    setError(null);
    try {
      await setDefaultMyPaymentMethod(id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('error'));
    } finally {
      setActingId(null);
    }
  }

  async function handleRemove(id: string) {
    setActingId(id);
    setError(null);
    try {
      await revokeMyPaymentMethod(id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('error'));
    } finally {
      setActingId(null);
    }
  }

  const displayName = user?.name?.trim() || '—';
  const displayEmail = user?.email?.trim() || '—';
  const customAvatar = user ? resolveUserAvatarUrl(user) : null;
  const avatarSrc = customAvatar || DEFAULT_PROFILE_AVATAR;

  if (loading) {
    return (
      <div className="flex justify-center py-20" data-testid="payment-methods-loading">
        <Loader2 className="h-8 w-8 animate-spin text-[#2F6EF6]" aria-hidden />
      </div>
    );
  }

  return (
    <div data-testid="payment-methods-page" className="pb-10" dir={locale === 'en' ? 'ltr' : 'rtl'}>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,320px)] lg:items-start lg:gap-6">
        <div className="min-w-0 space-y-4">
          <header>
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <span className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#E8F8EF]">
                  <CreditCard className="h-5 w-5 text-[#16A34A]" aria-hidden />
                </span>
                <div className="min-w-0">
                  <h1
                    className="text-2xl font-bold leading-tight text-[#0D2046] sm:text-[28px]"
                    data-testid="payment-methods-title"
                  >
                    {t('title')}
                  </h1>
                  <p className="mt-1.5 text-sm leading-relaxed text-[#7A879B]">{t('subtitle')}</p>
                </div>
              </div>
              <Link
                href="/account"
                className="mt-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#F06A4D] transition hover:bg-[#FFF1EC]"
                aria-label={t('backToAccount')}
                data-testid="payment-methods-back"
              >
                <ArrowLeft className={cn('h-5 w-5', locale === 'en' && 'rotate-180')} aria-hidden />
              </Link>
            </div>
          </header>

          {error ? (
            <p
              className="rounded-xl border border-[#FEE8EC] bg-[#FFF5F7] px-4 py-3 text-sm text-[#E11D48]"
              role="alert"
            >
              {error}
            </p>
          ) : null}

          <section className="rounded-2xl border border-[#E4EAF3] bg-white p-5 shadow-[0_2px_12px_rgba(35,72,120,.04)] sm:p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-[#2F6EF6]" aria-hidden />
                <h2 className="text-base font-bold text-[#0D2046]">{t('savedCardsTitle')}</h2>
              </div>
              <Link
                href="/"
                data-testid="payment-methods-add-hint"
                className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#2F6EF6] px-4 text-[13px] font-semibold text-white shadow-[0_8px_18px_-10px_rgba(47,110,246,.9)] transition hover:bg-[#255FE0]"
              >
                <Search className="h-4 w-4" aria-hidden />
                {t('addCardCta')}
              </Link>
            </div>
            <p className="mb-4 text-[12.5px] text-[#7A879B]">{t('addCardHint')}</p>

            {items.length === 0 ? (
              <div
                className="rounded-2xl border border-dashed border-[#D5DCE8] bg-[#F8FAFC] px-4 py-12 text-center"
                data-testid="payment-methods-empty"
              >
                <CreditCard className="mx-auto h-10 w-10 text-[#9AA6B8]" aria-hidden />
                <p className="mt-3 text-[15px] font-semibold text-[#0D2046]">{t('empty')}</p>
                <p className="mt-1 text-[13px] text-[#7A879B]">{t('emptyHint')}</p>
              </div>
            ) : (
              <ul
                className="grid gap-3 sm:grid-cols-2"
                data-testid="payment-methods-list"
              >
                {items.map((m) => {
                  const expiry = formatExpiry(m.expiryMonth, m.expiryYear);
                  const busy = actingId === m.id;
                  return (
                    <li
                      key={m.id}
                      data-testid="payment-method-row"
                      data-method-id={m.id}
                      className="relative rounded-2xl border border-[#E4EAF3] bg-[#F8FAFC] p-4"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <BrandMark brand={m.brand} />
                        {m.isDefault ? (
                          <span
                            data-testid="payment-method-default-badge"
                            className="inline-flex items-center gap-1 rounded-full bg-[#EAF2FF] px-2.5 py-0.5 text-[11px] font-semibold text-[#2F6EF6]"
                          >
                            <Star className="h-3 w-3" aria-hidden />
                            {t('defaultBadge')}
                          </span>
                        ) : null}
                      </div>

                      <p
                        className="mt-5 font-mono text-[15px] font-semibold tracking-wide text-[#0D2046]"
                        data-testid="payment-method-label"
                        dir="ltr"
                      >
                        {displayLabel(m)}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {expiry ? (
                          <p className="text-[12px] text-[#7A879B]" data-testid="payment-method-expiry">
                            {t('expires', { date: expiry })}
                          </p>
                        ) : null}
                        {m.expired ? (
                          <p
                            className="text-[12px] font-semibold text-[#E11D48]"
                            data-testid="payment-method-expired"
                          >
                            {t('expired')}
                          </p>
                        ) : null}
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2 border-t border-[#E8EEF6] pt-3">
                        {!m.isDefault ? (
                          <button
                            type="button"
                            data-testid="payment-method-set-default"
                            disabled={busy}
                            onClick={() => void handleDefault(m.id)}
                            className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#E4EAF3] bg-white px-2.5 text-[12px] font-semibold text-[#0D2046] hover:border-[#2F6EF6]/30 disabled:opacity-50"
                          >
                            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Star className="h-3.5 w-3.5 text-[#2F6EF6]" />}
                            {t('setDefault')}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          data-testid="payment-method-remove"
                          disabled={busy}
                          onClick={() => void handleRemove(m.id)}
                          className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#FEE8EC] bg-white px-2.5 text-[12px] font-semibold text-[#E11D48] hover:bg-[#FFF5F7] disabled:opacity-50"
                        >
                          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                          {t('remove')}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="rounded-2xl border border-[#E4EAF3] bg-white p-5 shadow-[0_2px_12px_rgba(35,72,120,.04)] sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-[#2F6EF6]" aria-hidden />
                  <h2 className="text-base font-bold text-[#0D2046]">{t('billingTitle')}</h2>
                </div>
                <p className="mt-1 text-[13px] text-[#7A879B]">{t('billingSubtitle')}</p>
                <p className="mt-3 text-[13px] leading-relaxed text-[#0D2046]">{t('billingUnavailable')}</p>
              </div>
              <span className="inline-flex h-9 cursor-not-allowed items-center gap-1.5 rounded-xl border border-[#E4EAF3] bg-[#F8FAFC] px-3 text-[12.5px] font-semibold text-[#9AA6B8]">
                {t('billingEditSoon')}
              </span>
            </div>
          </section>

          <section className="rounded-2xl border border-[#E4EAF3] bg-white p-5 shadow-[0_2px_12px_rgba(35,72,120,.04)] sm:p-6">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Clock3 className="h-4 w-4 text-[#2F6EF6]" aria-hidden />
                <h2 className="text-base font-bold text-[#0D2046]">{t('historyTitle')}</h2>
              </div>
              <Link
                href="/account/bookings"
                className="text-[13px] font-semibold text-[#2F6EF6] hover:underline"
              >
                {t('historyViewAll')}
              </Link>
            </div>
            <p className="text-[13px] text-[#7A879B]">{t('historySubtitle')}</p>
            <div className="mt-4 rounded-xl border border-dashed border-[#D5DCE8] bg-[#F8FAFC] px-4 py-8 text-center text-[13px] text-[#7A879B]">
              {t('historyEmpty')}
            </div>
          </section>
        </div>

        <aside className="space-y-3 lg:sticky lg:top-24">
          <section className="rounded-2xl border border-[#E4EAF3] bg-white p-5 text-center shadow-[0_2px_12px_rgba(35,72,120,.04)] sm:p-6">
            <div className="relative mx-auto h-24 w-24">
              <span className="relative block h-24 w-24 overflow-hidden rounded-full bg-[#E8F0FE]">
                <Image
                  src={avatarSrc}
                  alt=""
                  width={96}
                  height={96}
                  className="h-full w-full object-cover"
                />
              </span>
            </div>
            <p className="mt-4 text-lg font-bold text-[#0D2046]">{displayName}</p>
            <p className="mt-1 text-[13px] text-[#7A879B]" dir="ltr">
              {displayEmail}
            </p>
            <div className="mt-3 space-y-1.5 text-[13px] text-[#7A879B]">
              <p className="flex items-center justify-center gap-1.5">
                <Phone className="h-3.5 w-3.5 text-[#2F6EF6]" aria-hidden />
                <span dir="ltr">{phoneMasked || ta('phoneEmpty')}</span>
              </p>
            </div>
          </section>

          <section className="rounded-2xl border border-[#E4EAF3] bg-white p-5 shadow-[0_2px_12px_rgba(35,72,120,.04)]">
            <div className="flex items-start gap-2">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#EAF2FF] text-[#2F6EF6]">
                <Lightbulb className="h-4 w-4" aria-hidden />
              </span>
              <h2 className="text-[14px] font-bold leading-snug text-[#0D2046]">{t('tipsTitle')}</h2>
            </div>
            <ul className="mt-4 space-y-3">
              <li className="flex gap-3">
                <Shield className="mt-0.5 h-4 w-4 shrink-0 text-[#2F6EF6]" aria-hidden />
                <p className="text-[12.5px] leading-relaxed text-[#7A879B]">{t('tip1')}</p>
              </li>
              <li className="flex gap-3">
                <Lock className="mt-0.5 h-4 w-4 shrink-0 text-[#2F6EF6]" aria-hidden />
                <p className="text-[12.5px] leading-relaxed text-[#7A879B]">{t('tip2')}</p>
              </li>
              <li className="flex gap-3">
                <Users className="mt-0.5 h-4 w-4 shrink-0 text-[#2F6EF6]" aria-hidden />
                <p className="text-[12.5px] leading-relaxed text-[#7A879B]">{t('tip3')}</p>
              </li>
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
